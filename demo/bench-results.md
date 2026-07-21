# Benchmark results

Representative output of `npm run demo:bench` (see [`bench.mjs`](./bench.mjs)).
Numbers are machine- and load-dependent — re-run to reproduce on your hardware.

- **Date:** 2026-07-21
- **Method:** headless Chrome (system Chrome via `puppeteer-core`), each variant
  loaded repeatedly, warm-up runs discarded, variants interleaved. This is a
  **fair comparison** — both variants load their critical CSS over the network
  via a render-blocking `<link>` (no inlining). Each CSS response is throttled by
  `rtt + bytes / bandwidth`, so a smaller critical file arrives sooner. The HTML
  document is never delayed. First Contentful Paint is read from the Paint
  Timing API.
- **Both variants render identical content.**

## 150 runs per variant · Fast 3G (170 ms RTT, 180 KB/s)

```
node demo/bench.mjs 150 170 180
```

Critical CSS on the render-blocking path: full `styles.css` **9.8 KB** vs
spine `spine.css` **7.1 KB**; `complement.css` **5.9 KB** is loaded non-blocking
(`media="print"` → `onload="this.media='all'"`).

| FCP metric | Full CSS (render-blocking) | Spine-first |
| ---------- | -------------------------: | ----------: |
| median     |                   264.0 ms |    244.0 ms |
| mean       |                   263.4 ms |    246.9 ms |
| p95        |                   268.0 ms |    256.0 ms |
| min        |                   256.0 ms |    240.0 ms |
| max        |                   280.0 ms |    300.0 ms |
| std dev    |                     3.6 ms |      6.2 ms |
| samples    |                        150 |         150 |

**Spine-first painted ~20 ms sooner at the median.**

## Reading the numbers

- Both variants pay one render-blocking request with the same RTT, so the FCP
  gap comes purely from **critical-CSS size**: the full stylesheet is 9.8 KB, the
  spine is 7.1 KB. The ~2.7 KB the spine defers is ~20 ms at 180 KB/s — which is
  the measured gap.
- The win is **proportional to how much paint CSS you defer**. This demo's CSS is
  layout-heavy (the spine is ~72 % of the whole), so the gap is modest. A
  paint-heavy site (large color/shadow/animation layer) defers far more, so the
  spine is a small fraction of the critical path and the FCP win is much larger.
- Inlining the spine instead of loading it over the network removes the request
  entirely and widens the gap further, but that's a separate optimisation — this
  benchmark keeps both on an equal `<link>` footing to isolate the size effect.
- LCP is omitted — headless Chrome does not report it.

## Render cost: Recalculate Style + Paint (main thread)

`npm run demo:bench:render` (see [`bench-render.mjs`](./bench-render.mjs)) measures
the main-thread work of the **first render** from a Chrome DevTools trace, with no
network throttling. Hypothesis: a smaller spine should compute styles and paint
faster. Result (60 runs, medians):

| metric (median)      | Full CSS  | Spine-first |
| -------------------- | --------: | ----------: |
| CSS parse (critical) | 0.081 ms  |   0.071 ms  |
| Recalculate Style    | 0.049 ms  |   0.048 ms  |
| Paint (record)       | 1.947 ms  |   1.937 ms  |

**On this page the difference is within noise** — and that's informative:

- **Recalculate Style is dominated by selector matching**, and the split keeps the
  *same selectors* in both stylesheets (only the declarations differ), so recalc is
  essentially identical. Spine has fewer declarations to apply, but that's a tiny
  fraction of the cost.
- The DevTools **"Paint" event records the display list on the main thread**; the
  expensive part of gradients/shadows is **rasterization** on the raster/GPU thread,
  which isn't in this event. So the main-thread paint barely differs.
- With a small DOM and viewport, both are sub-millisecond and lost in noise.

The measurable spine-first win is on the **critical path / network (FCP above)**, not
main-thread recalc/paint at this scale. Recalc/paint savings only become significant
on a large, paint-heavy DOM (many shadowed/gradient/filtered elements).

## Reproduce

```bash
npm run demo:build                 # regenerate the demo pages
npm run demo:bench                 # FCP: defaults 300 runs, 170 ms RTT, 180 KB/s
node demo/bench.mjs 1000 300 50    # FCP: 1000 runs on Slow 3G (300 ms, 50 KB/s)
npm run demo:bench:render          # Recalculate Style + Paint (main thread)
```

Set `PUPPETEER_EXECUTABLE_PATH` if your Chrome/Chromium is not auto-detected.
