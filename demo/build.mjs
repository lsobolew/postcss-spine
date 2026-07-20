/*
 * Generates the demo variants from a single source stylesheet + markup:
 *
 *   demo/styles.css  --postcss-spine-->  spine.css      (mode: 'spine')
 *                                         complement.css (mode: 'complement')
 *
 *   full.html    full styles.css                       (baseline)
 *   spine.html   spine.css only                        (layout skeleton)
 *   lazy.html    spine inlined + complement lazy-loaded (zero layout shift)
 *   index.html   landing page comparing all three
 *
 * Run:  npm run demo:build   (builds the plugin first, then this script)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import postcss from 'postcss'

import spine from '../dist/index.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const read = (f) => readFileSync(join(here, f), 'utf8')
const write = (f, s) => {
  writeFileSync(join(here, f), s)
  console.log('  wrote', f, `(${s.length} bytes)`)
}

const source = read('styles.css')
const body = read('page.html')
const clientJs = read('assets/demo.js')

console.log('Splitting styles.css with postcss-spine…')
const spineCss = (await postcss([spine()]).process(source, { from: undefined })).css
const complementCss = (
  await postcss([spine({ mode: 'complement' })]).process(source, { from: undefined })
).css

write('spine.css', spineCss)
write('complement.css', complementCss)

const bar = (active) => {
  const link = (href, key, label) =>
    `<a href="${href}"${key === active ? ' class="is-active"' : ''}>${label}</a>`
  return `<div class="demo-bar">
  <span class="demo-bar__title">postcss-spine demo</span>
  <nav>
    ${link('index.html', 'index', 'Overview')}
    ${link('full.html', 'full', 'Full CSS')}
    ${link('spine.html', 'spine', 'Spine only')}
    ${link('lazy.html', 'lazy', 'Spine + lazy paint')}
  </nav>
</div>`
}

const BAR_CSS = `
  .demo-bar{position:sticky;top:0;z-index:1000;display:flex;flex-wrap:wrap;gap:16px;
    align-items:center;justify-content:space-between;padding:10px 20px;font:600 14px/1.2
    ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8e8f5;background:#171728;
    border-bottom:1px solid #2b2b45}
  .demo-bar__title{opacity:.7}
  .demo-bar nav{display:flex;gap:6px;flex-wrap:wrap}
  .demo-bar a{padding:6px 12px;border-radius:8px;color:#cfcfe6;text-decoration:none}
  .demo-bar a:hover{background:#242440}
  .demo-bar a.is-active{background:#6d5efc;color:#fff}
`

const page = ({ title, active, head = '', pre = '', post = '' }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${BAR_CSS}</style>
${head}</head>
<body>
${bar(active)}
${pre}${body}${post}
</body>
</html>
`

// --- full.html: the untouched stylesheet -----------------------------------
write(
  'full.html',
  page({
    title: 'Full CSS · postcss-spine demo',
    active: 'full',
    head: '  <link rel="stylesheet" href="styles.css" />\n',
  }),
)

// --- spine.html: layout skeleton only ---------------------------------------
write(
  'spine.html',
  page({
    title: 'Spine only · postcss-spine demo',
    active: 'spine',
    head: '  <link rel="stylesheet" href="spine.css" />\n',
    pre: `<div class="demo-note">Only <code>spine.css</code> is loaded — every box keeps its final
size and position, but all paint (colors, backgrounds, shadows, radii, animations) is gone.</div>
<style>.demo-note{padding:12px 20px;background:#fff7d6;border-bottom:1px solid #ece0a0;
font:14px/1.5 system-ui;color:#5b520e}.demo-note code{font-weight:700}</style>
`,
  }),
)

// --- lazy.html: spine inlined, complement loaded on demand ------------------
const lazyHead = `  <style id="spine">
${spineCss}
  </style>
  <style>
    .demo-panel{position:fixed;right:16px;bottom:16px;z-index:1000;width:260px;padding:16px;
      border-radius:14px;background:#171728;color:#e8e8f5;box-shadow:0 20px 50px rgba(0,0,0,.35);
      font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
    .demo-panel h3{margin:0 0 4px;font-size:14px}
    .demo-panel p{margin:0 0 12px;color:#a5a5c4}
    .demo-panel button{width:100%;padding:10px;border:0;border-radius:9px;cursor:pointer;
      font:600 14px system-ui;color:#fff;background:#6d5efc}
    .demo-panel button:disabled{background:#2fae66;cursor:default}
    .metric{display:flex;justify-content:space-between;margin-top:8px}
    .metric__val{font-weight:700}
    .metric__val.is-ok{color:#54e39a}.metric__val.is-bad{color:#ff8080}
    #m-status{margin-top:12px;color:#a5a5c4;font-size:12px}
  </style>
`
const lazyPanel = `<aside class="demo-panel">
  <h3>Lazy paint</h3>
  <p>Spine is inlined. Load the complement and watch the geometry stay put.</p>
  <button id="load-btn">Load complement.css</button>
  <div class="metric"><span>Max box shift</span><span id="m-shift" class="metric__val">—</span></div>
  <div class="metric"><span>Browser CLS</span><span id="m-cls" class="metric__val">—</span></div>
  <div id="m-status">Waiting…</div>
</aside>
`
write(
  'lazy.html',
  page({
    title: 'Spine + lazy paint · postcss-spine demo',
    active: 'lazy',
    head: lazyHead,
    post: `\n${lazyPanel}<script src="assets/demo.js"></script>`,
  }),
)

// --- index.html: overview with side-by-side iframes -------------------------
const overview = `<style>
  .ov{max-width:1120px;margin:0 auto;padding:40px 24px 64px;font:16px/1.6 system-ui,sans-serif;color:#1b1b2b}
  .ov h1{font-size:34px;letter-spacing:-.02em;margin:0 0 8px}
  .ov p.lead{font-size:18px;color:#5b5b74;margin:0 0 28px;max-width:60ch}
  .ov code{background:#f0f0f7;padding:2px 6px;border-radius:6px;font-size:.9em}
  .ov__cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:40px}
  .ov__card{padding:20px;border:1px solid #e7e7f0;border-radius:14px;background:#fff}
  .ov__card h3{margin:0 0 6px;font-size:17px}
  .ov__card p{margin:0 0 14px;font-size:14px;color:#5b5b74}
  .ov__card a{display:inline-block;padding:8px 14px;border-radius:999px;background:#6d5efc;
    color:#fff;text-decoration:none;font-weight:600;font-size:14px}
  .ov__compare{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .ov__frame{border:1px solid #e7e7f0;border-radius:14px;overflow:hidden;background:#fff}
  .ov__frame figcaption{padding:10px 14px;font-weight:700;font-size:13px;border-bottom:1px solid #e7e7f0}
  .ov__frame iframe{display:block;width:100%;height:520px;border:0}
  @media(max-width:800px){.ov__cards,.ov__compare{grid-template-columns:1fr}}
</style>
<div class="ov">
  <h1>postcss-spine — layout-first CSS</h1>
  <p class="lead">The same landing page, split by <code>postcss-spine</code> into a layout
    <strong>spine</strong> and a paint <strong>complement</strong>. Load the spine and every element is
    already at its final size; add the complement and the browser only repaints.</p>
  <div class="ov__cards">
    <div class="ov__card"><h3>1 · Full CSS</h3><p>The original stylesheet, for reference.</p><a href="full.html">Open</a></div>
    <div class="ov__card"><h3>2 · Spine only</h3><p>Layout skeleton — geometry without paint.</p><a href="spine.html">Open</a></div>
    <div class="ov__card"><h3>3 · Spine + lazy paint</h3><p>Spine inlined, complement lazy-loaded, shift measured.</p><a href="lazy.html">Open</a></div>
  </div>
  <div class="ov__compare">
    <figure class="ov__frame" style="margin:0"><figcaption>Full CSS</figcaption><iframe src="full.html" title="Full"></iframe></figure>
    <figure class="ov__frame" style="margin:0"><figcaption>Spine only (identical geometry)</figcaption><iframe src="spine.html" title="Spine"></iframe></figure>
  </div>
</div>`
writeFileSync(
  join(here, 'index.html'),
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>postcss-spine demo</title>
  <style>${BAR_CSS}body{margin:0;background:#fafafe}</style>
</head>
<body>
${bar('index')}
${overview}
</body>
</html>
`,
)
console.log('  wrote index.html')
console.log('Done.')
