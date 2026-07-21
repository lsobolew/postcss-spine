/*
 * Render benchmark: loads each strategy many times in headless Chrome and
 * compares First Contentful Paint. Both load their critical CSS over the
 * network via a render-blocking <link> — a fair comparison, no inlining:
 *
 *   - Full CSS   : the whole stylesheet blocks the first paint
 *   - Spine-first: only spine.css blocks; complement.css is loaded non-blocking
 *
 * The server (demo/server.mjs) throttles each CSS response by
 * `rtt + bytes / bandwidth`, so a smaller critical file paints sooner. The HTML
 * document is never delayed.
 *
 * Headless pages report FCP normally (they count as visible), unlike a
 * backgrounded real tab where Chrome defers it.
 *
 * Usage:  node demo/bench.mjs [runs] [rttMs] [bandwidthKBps]
 *   e.g.  node demo/bench.mjs 1000 170 180
 *   defaults: runs=300, rtt=170 ms, bandwidth=180 KB/s (Fast 3G-ish)
 */
import { existsSync } from 'node:fs'

import puppeteer from 'puppeteer-core'

import { startDemoServer } from './server.mjs'

const RUNS = Number(process.argv[2]) || 300
const RTT = process.argv[3] === undefined ? 170 : Number(process.argv[3])
const BW_KBPS = process.argv[4] === undefined ? 180 : Number(process.argv[4])
const BW = Math.round(BW_KBPS * 1024)
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
  { key: 'full', label: 'Full CSS (render-blocking <link>)', page: 'measure-full.html' },
  { key: 'spine', label: 'Spine-first (spine blocks, complement lazy)', page: 'measure-spine.html' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function stats(arr) {
  const s = [...arr].sort((a, b) => a - b)
  const n = s.length
  if (!n) return null
  const q = (p) => s[Math.min(n - 1, Math.round(p * (n - 1)))]
  const mean = arr.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  return { n, min: s[0], p50: q(0.5), mean, p95: q(0.95), max: s[n - 1], sd }
}

async function measure(page, origin, variant, run) {
  await page.goto(`${origin}/${variant.page}?rtt=${RTT}&bw=${BW}&run=${run}`, {
    waitUntil: 'load',
    timeout: 30000,
  })
  await sleep(40)
  return page.evaluate(() => {
    const paint = performance.getEntriesByType('paint')
    const fcp = paint.find((e) => e.name === 'first-contentful-paint')
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
    return {
      fcp: fcp ? fcp.startTime : null,
      lcp: lcpEntries.length ? lcpEntries[lcpEntries.length - 1].startTime : null,
    }
  })
}

const ms = (v) => (v == null ? '   n/a' : v.toFixed(1).padStart(7))

function printMetric(title, full, spine) {
  const f = stats(full)
  const s = stats(spine)
  console.log(`\n${title}`)
  console.log('  metric        Full CSS (blocking)   Spine-first')
  const line = (label, fv, sv) =>
    console.log('  ' + label.padEnd(12) + ms(fv) + ' ms       ' + ms(sv) + ' ms')
  if (!f || !s) {
    console.log('  (not reported in this browser)')
    return
  }
  line('median', f.p50, s.p50)
  line('mean', f.mean, s.mean)
  line('p95', f.p95, s.p95)
  line('min', f.min, s.min)
  line('max', f.max, s.max)
  line('std dev', f.sd, s.sd)
  const delta = f.p50 - s.p50
  const factor = s.p50 > 0 ? (f.p50 / s.p50).toFixed(1) : '∞'
  console.log(
    `  → spine painted ${delta.toFixed(1)} ms sooner at the median (${factor}× faster), n=${f.n}/${s.n}`,
  )
}

console.log('\npostcss-spine render benchmark')
console.log(
  `runs=${RUNS} per variant (+${WARMUP} warmup discarded) · ${RTT} ms RTT, ${BW_KBPS} KB/s · ${CHROME.split('/').pop()}`,
)

const { server, origin } = await startDemoServer(0)
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setCacheEnabled(false)
await page.setViewport({ width: 1280, height: 800 })

const data = { full: { fcp: [], lcp: [] }, spine: { fcp: [], lcp: [] } }
let runId = 0

// Warm-up (JIT, first-load noise) — measured but discarded.
for (const v of VARIANTS) {
  for (let i = 0; i < WARMUP; i++) await measure(page, origin, v, ++runId)
}

// Interleave variants so any drift affects both equally.
const t0 = Date.now()
for (let i = 0; i < RUNS; i++) {
  for (const v of VARIANTS) {
    const m = await measure(page, origin, v, ++runId)
    if (m.fcp != null) data[v.key].fcp.push(m.fcp)
    if (m.lcp != null) data[v.key].lcp.push(m.lcp)
  }
  if ((i + 1) % 25 === 0 || i + 1 === RUNS) {
    const secs = ((Date.now() - t0) / 1000).toFixed(0)
    process.stdout.write(`\r  progress: ${i + 1}/${RUNS}  (${secs}s)`)
  }
}
process.stdout.write('\n')

await browser.close()
server.close()

printMetric('First Contentful Paint', data.full.fcp, data.spine.fcp)
if (data.full.lcp.length && data.spine.lcp.length) {
  printMetric('Largest Contentful Paint', data.full.lcp, data.spine.lcp)
} else {
  console.log('\nLargest Contentful Paint: not reported by headless Chrome (skipped).')
}
console.log(
  `\nEach variant renders identical content; only the CSS delivery differs.\nDone in ${((Date.now() - t0) / 1000).toFixed(0)}s.\n`,
)
