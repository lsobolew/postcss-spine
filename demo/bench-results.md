# Benchmark results

Representative output of `npm run demo:bench` (see [`bench.mjs`](./bench.mjs)).
Numbers are machine- and load-dependent — re-run to reproduce on your hardware.

- **Date:** 2026-07-20
- **Method:** headless Chrome (system Chrome via `puppeteer-core`), each variant
  loaded repeatedly, warm-up runs discarded, variants interleaved. Only the CSS
  response is delayed (never the HTML), so the sole difference is how the CSS is
  delivered. First Contentful Paint is read from the Paint Timing API.
- **Both variants render identical content.**

## 1000 runs per variant · 200 ms simulated CSS latency

```
node demo/bench.mjs 1000 200
```

| FCP metric | Full CSS (render-blocking `<link>`) | Spine (inlined) |
| ---------- | ----------------------------------: | --------------: |
| median     |                            244.0 ms |         44.0 ms |
| mean       |                            246.1 ms |         47.6 ms |
| p95        |                            264.0 ms |         68.0 ms |
| min        |                            232.0 ms |         32.0 ms |
| max        |                            752.0 ms |        312.0 ms |
| std dev    |                             22.9 ms |         15.7 ms |
| samples    |                                1000 |             995 |

**Spine painted 200.0 ms sooner at the median — ~5.5× faster FCP.**

## Reading the numbers

- The **median gap (~200 ms) equals the simulated CSS latency.** The full
  stylesheet blocks the first paint until it downloads; the inlined spine ships
  in the HTML and paints immediately (~44 ms is just parse + layout), then
  streams `complement.css` in afterwards with zero layout shift.
- Spine is also **more consistent** (lower std dev, p95 68 ms vs 264 ms) because
  its first paint does not depend on the network.
- The saving scales with real latency — higher latency, larger gap. Even at
  `0 ms` latency the spine still avoids one render-blocking request round-trip.
- `995` spine samples: a few runs did not emit an FCP entry (occasional headless
  noise) and were dropped; it does not affect the medians.
- LCP is omitted — headless Chrome does not report it.

## Reproduce

```bash
npm run demo:build            # regenerate the demo pages
npm run demo:bench            # defaults: 300 runs, 200 ms latency
node demo/bench.mjs 1000 600  # 1000 runs at 600 ms latency
```

Set `PUPPETEER_EXECUTABLE_PATH` if your Chrome/Chromium is not auto-detected.
