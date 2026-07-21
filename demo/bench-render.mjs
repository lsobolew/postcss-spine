/*
 * Render-cost benchmark: measures the main-thread work of the FIRST render —
 * "Recalculate Style" (trace event UpdateLayoutTree) and "Paint" — for each
 * strategy, using a Chrome DevTools trace (via puppeteer-core). This is CPU
 * work, not network, so it runs with no throttling.
 *
 *   - Full CSS   : first paint applies the whole stylesheet (backgrounds,
 *                  gradients, shadows … — expensive to compute and paint)
 *   - Spine-first: first paint applies only spine.css (layout, no paint); the
 *                  complement is deferred, so it isn't in the first render
 *
 * Reported per variant (median over N loads):
 *   - CSS parse : first ParseAuthorStyleSheet (the critical stylesheet)
 *   - Recalc    : total UpdateLayoutTree (style recalculation)
 *   - Paint     : total Paint (display-list recording on the main thread)
 *
 * The spine variant is loaded with `?nolazy` (spine CSS only, no complement),
 * so this compares the cost of the *first render* of each stylesheet on the
 * same DOM.
 *
 * Usage:  node demo/bench-render.mjs [runs] [scenario] [cpuThrottle]
 *   scenario    : "landing" (default) or "heavy" (a large grid of
 *                 gradient/shadow tiles, where paint cost diverges)
 *   cpuThrottle : CPU slowdown factor (default 1); e.g. 4 or 6 to emulate a
 *                 mid-tier mobile device, which magnifies the difference
 */
import { existsSync } from 'node:fs'

import puppeteer from 'puppeteer-core'

import { startDemoServer } from './server.mjs'

const RUNS = Number(process.argv[2]) || 40
const SCENARIO = process.argv[3] === 'heavy' ? 'heavy' : 'landing'
const CPU = Number(process.argv[4]) || 1
const WARMUP = 3

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p))

if (!CHROME) {
  console.error('Could not find a Chrome/Chromium binary. Set PUPPETEER_EXECUTABLE_PATH.')
  process.exit(1)
}

const VARIANTS =
  SCENARIO === 'heavy'
    ? [
        { key: 'full', label: 'Full CSS', page: 'measure-heavy-full.html' },
        { key: 'spine', label: 'Spine-first', page: 'measure-heavy-spine.html' },
      ]
    : [
        { key: 'full', label: 'Full CSS', page: 'measure-full.html' },
        { key: 'spine', label: 'Spine-first', page: 'measure-spine.html' },
      ]

const RECALC_NAMES = new Set(['UpdateLayoutTree', 'RecalculateStyles'])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function median(arr) {
  const s = [...arr].filter((v) => v != null).sort((a, b) => a - b)
  if (!s.length) return null
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function analyze(trace) {
  const ev = trace.traceEvents.filter((e) => typeof e.dur === 'number')
  const firstBy = (pred) => {
    const hits = ev.filter(pred).sort((a, b) => a.ts - b.ts)
    return hits.length ? hits[0].dur / 1000 : null
  }
  const sumBy = (pred) => ev.filter(pred).reduce((s, e) => s + e.dur, 0) / 1000
  return {
    parse: firstBy((e) => e.name === 'ParseAuthorStyleSheet'),
    recalc: sumBy((e) => RECALC_NAMES.has(e.name)),
    paint: sumBy((e) => e.name === 'Paint'),
  }
}

async function trace(browser, origin, variant) {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  await page.setViewport({ width: 1280, height: 800 })
  if (CPU > 1) {
    const client = await page.createCDPSession()
    await client.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  }
  await page.tracing.start({ screenshots: false })
  // No network throttle (we're measuring CPU); `nolazy` keeps the spine variant
  // to its critical CSS only, so this is the cost of the first render.
  await page.goto(`${origin}/${variant.page}?nolazy`, { waitUntil: 'load', timeout: 60000 })
  await sleep(150)
  const raw = await page.tracing.stop()
  await page.close()
  return analyze(JSON.parse(Buffer.from(raw).toString('utf8')))
}

console.log('\npostcss-spine render-cost benchmark (Recalculate Style + Paint)')
console.log(
  `scenario=${SCENARIO} · CPU ${CPU}x · runs=${RUNS} per variant (+${WARMUP} warmup) · ${CHROME.split('/').pop()}`,
)

const { server, origin } = await startDemoServer(0)
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})

const data = { full: { parse: [], recalc: [], paint: [] }, spine: { parse: [], recalc: [], paint: [] } }
const t0 = Date.now()

for (const v of VARIANTS) {
  for (let i = 0; i < WARMUP; i++) await trace(browser, origin, v)
}
for (let i = 0; i < RUNS; i++) {
  for (const v of VARIANTS) {
    const m = await trace(browser, origin, v)
    data[v.key].parse.push(m.parse)
    data[v.key].recalc.push(m.recalc)
    data[v.key].paint.push(m.paint)
  }
  if ((i + 1) % 10 === 0 || i + 1 === RUNS) {
    process.stdout.write(`\r  progress: ${i + 1}/${RUNS}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
}
process.stdout.write('\n')

await browser.close()
server.close()

const ms = (v) => (v == null ? '   n/a' : v.toFixed(3).padStart(7))
const f = data.full
const s = data.spine
console.log('\n  metric (median ms)   Full CSS     Spine-first')
const row = (label, fa, sa) => console.log('  ' + label.padEnd(18) + ms(median(fa)) + '     ' + ms(median(sa)))
row('CSS parse', f.parse, s.parse)
row('Recalc style', f.recalc, s.recalc)
row('Paint', f.paint, s.paint)

const fTotal = (median(f.recalc) || 0) + (median(f.paint) || 0)
const sTotal = (median(s.recalc) || 0) + (median(s.paint) || 0)
const factor = sTotal > 0 ? (fTotal / sTotal).toFixed(1) : '∞'
console.log(
  `\n  recalc + paint: full ${fTotal.toFixed(3)} ms vs spine ${sTotal.toFixed(3)} ms` +
    (sTotal < fTotal ? ` — spine ${(fTotal - sTotal).toFixed(3)} ms cheaper (${factor}x)` : ''),
)
console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(0)}s.\n`)
