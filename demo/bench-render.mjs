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
 *   - CSS parse   : sum of ParseAuthorStyleSheet
 *   - Recalc(1st) : duration of the first UpdateLayoutTree
 *   - Paint(1st)  : duration of the first Paint
 *
 * Usage:  node demo/bench-render.mjs [runs]   (default 40)
 */
import { existsSync } from 'node:fs'

import puppeteer from 'puppeteer-core'

import { startDemoServer } from './server.mjs'

const RUNS = Number(process.argv[2]) || 40
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

const VARIANTS = [
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
  return {
    // First stylesheet parse = the critical CSS (styles.css / spine.css); the
    // spine variant's deferred complement parses later and is excluded.
    parse: firstBy((e) => e.name === 'ParseAuthorStyleSheet'),
    recalc1: firstBy((e) => RECALC_NAMES.has(e.name)),
    paint1: firstBy((e) => e.name === 'Paint'),
  }
}

async function trace(browser, origin, variant) {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  await page.setViewport({ width: 1280, height: 800 })
  await page.tracing.start({ screenshots: false })
  // No throttle query -> CSS served instantly; we're measuring CPU, not network.
  await page.goto(`${origin}/${variant.page}`, { waitUntil: 'load', timeout: 30000 })
  await sleep(150)
  const raw = await page.tracing.stop()
  await page.close()
  return analyze(JSON.parse(Buffer.from(raw).toString('utf8')))
}

console.log('\npostcss-spine render-cost benchmark (Recalculate Style + Paint)')
console.log(`runs=${RUNS} per variant (+${WARMUP} warmup) · no network throttle · ${CHROME.split('/').pop()}`)

const { server, origin } = await startDemoServer(0)
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})

const data = { full: { parse: [], recalc1: [], paint1: [] }, spine: { parse: [], recalc1: [], paint1: [] } }
const t0 = Date.now()

for (const v of VARIANTS) {
  for (let i = 0; i < WARMUP; i++) await trace(browser, origin, v)
}
for (let i = 0; i < RUNS; i++) {
  for (const v of VARIANTS) {
    const m = await trace(browser, origin, v)
    data[v.key].parse.push(m.parse)
    data[v.key].recalc1.push(m.recalc1)
    data[v.key].paint1.push(m.paint1)
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
row('Recalc style (1st)', f.recalc1, s.recalc1)
row('Paint (1st)', f.paint1, s.paint1)

const fTotal = (median(f.recalc1) || 0) + (median(f.paint1) || 0)
const sTotal = (median(s.recalc1) || 0) + (median(s.paint1) || 0)
console.log(
  `\n  first recalc + paint: full ${fTotal.toFixed(3)} ms vs spine ${sTotal.toFixed(3)} ms` +
    (sTotal < fTotal ? ` (spine ${(fTotal - sTotal).toFixed(3)} ms cheaper)` : ''),
)
console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(0)}s.\n`)
