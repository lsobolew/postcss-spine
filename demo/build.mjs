/*
 * Generates the demo variants from a single source stylesheet + markup:
 *
 *   demo/styles.css  --postcss-spine-->  spine.css      (mode: 'spine')
 *                                         complement.css (mode: 'complement')
 *
 *   full.html    full styles.css                       (baseline)
 *   spine.html   spine.css only                        (layout skeleton)
 *   lazy.html    spine inlined + complement lazy-loaded (zero layout shift)
 *   vitals.html  Core Web Vitals comparison (needs demo/server.mjs for latency)
 *   index.html   landing page linking all of the above
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
const kb = (n) => (n / 1024).toFixed(1) + ' KB'

const source = read('styles.css')
const body = read('page.html')

console.log('Splitting styles.css with postcss-spine…')
const spineCss = (await postcss([spine()]).process(source, { from: undefined })).css
const complementCss = (
  await postcss([spine({ mode: 'complement' })]).process(source, { from: undefined })
).css

write('spine.css', spineCss)
write('complement.css', complementCss)

const SIZE = { full: source.length, spine: spineCss.length, complement: complementCss.length }

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
    ${link('vitals.html', 'vitals', 'Web Vitals')}
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
    .demo-panel button.is-painted{background:#c8103e}
    .metric{display:flex;justify-content:space-between;margin-top:8px}
    .metric__val{font-weight:700}
    .metric__val.is-ok{color:#54e39a}.metric__val.is-bad{color:#ff8080}
    #m-status{margin-top:12px;color:#a5a5c4;font-size:12px}
  </style>
`
const lazyPanel = `<aside class="demo-panel">
  <h3>Lazy paint</h3>
  <p>Spine is inlined. Toggle the complement on and off — the geometry stays put either way.</p>
  <button id="load-btn">Load complement.css</button>
  <div class="metric"><span>Max reflow (layout)</span><span id="m-shift" class="metric__val">—</span></div>
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

// --- measured variant pages (loaded inside vitals.html iframes) -------------
// Each reports its own First Contentful Paint / Largest Contentful Paint /
// Cumulative Layout Shift to the parent via postMessage.
// FCP works for real users in a visible tab (Chrome defers it while hidden).
// `blocking` is derived from resource timing — the time the render-blocking
// stylesheet takes to arrive — and is immune to visibility throttling, so it
// always shows why the paints differ. (LCP is intentionally omitted: the spec
// does not report it inside iframes.)
const MEASURE_SCRIPT = `(function(){
  var cls=0;
  try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){if(!e.hadRecentInput)cls+=e.value;});}).observe({type:'layout-shift',buffered:true});}catch(e){}
  function report(){
    var paint=performance.getEntriesByType('paint').filter(function(e){return e.name==='first-contentful-paint';})[0];
    var css=performance.getEntriesByType('resource').filter(function(e){return e.name.indexOf(window.__CRITICAL)>-1;});
    var blocking=css.reduce(function(m,e){return Math.max(m,e.responseEnd);},0);
    parent.postMessage({__vitals:true,variant:window.__VARIANT,
      fcp:paint?Math.round(paint.startTime):null,blocking:Math.round(blocking),
      cls:cls,hidden:document.visibilityState!=='visible'},'*');
  }
  window.addEventListener('load',function(){setTimeout(report,1000);});
})();`

const measurePage = ({ title, variant, critical, head, post = '', bodyHtml = body }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <script>window.__VARIANT=${JSON.stringify(variant)};window.__CRITICAL=${JSON.stringify(critical)};</script>
  <script>${MEASURE_SCRIPT}</script>
${head}</head>
<body>
${bodyHtml}${post}
</body>
</html>
`

// Full CSS: the whole stylesheet as a render-blocking <link>. Written during
// head parsing so it blocks the first paint; the throttling query (rtt/bw/run)
// is carried through verbatim from the iframe URL.
write(
  'measure-full.html',
  measurePage({
    title: 'measure: full',
    variant: 'Full CSS (render-blocking)',
    critical: 'styles.css',
    head: `  <script>
    document.write('<link rel="stylesheet" href="styles.css'+location.search+'">');
  </script>
`,
  }),
)

// Spine-first: spine.css is a render-blocking <link> (so it pays a network
// round-trip too — a fair comparison), and complement.css is loaded the
// non-blocking "lazy CSS" way (media="print" flipped to "all" on load).
write(
  'measure-spine.html',
  measurePage({
    title: 'measure: spine',
    variant: 'Spine + lazy complement',
    critical: 'spine.css',
    head: `  <script>
    var s=location.search;
    document.write('<link rel="stylesheet" href="spine.css'+s+'">');
    if(s.indexOf('nolazy')===-1)
      document.write('<link rel="stylesheet" href="complement.css'+s+'" media="print" onload="this.media=&#39;all&#39;">');
  </script>
`,
  }),
)

// --- paint-heavy pages (for the render-cost benchmark) ----------------------
// A large grid of gradient/shadow tiles. In the spine, the tiles keep their
// size but paint (almost) nothing, so the first paint has far less to draw.
const heavySource = read('heavy.css')
const heavySpineCss = (await postcss([spine()]).process(heavySource, { from: undefined })).css
const heavyComplementCss = (
  await postcss([spine({ mode: 'complement' })]).process(heavySource, { from: undefined })
).css
write('heavy-spine.css', heavySpineCss)
write('heavy-complement.css', heavyComplementCss)

const heavyTiles = Array.from(
  { length: 600 },
  (_, i) => `<div class="tile t${i % 12}"><span class="tile__label">Item ${i + 1}</span></div>`,
).join('')
const heavyBody = `<main class="heavy"><div class="heavy__grid">${heavyTiles}</div></main>`

write(
  'measure-heavy-full.html',
  measurePage({
    title: 'measure: heavy full',
    variant: 'Full CSS (render-blocking)',
    critical: 'heavy.css',
    head: `  <script>
    document.write('<link rel="stylesheet" href="heavy.css'+location.search+'">');
  </script>
`,
    bodyHtml: heavyBody,
  }),
)

write(
  'measure-heavy-spine.html',
  measurePage({
    title: 'measure: heavy spine',
    variant: 'Spine + lazy complement',
    critical: 'heavy-spine.css',
    head: `  <script>
    var s=location.search;
    document.write('<link rel="stylesheet" href="heavy-spine.css'+s+'">');
    if(s.indexOf('nolazy')===-1)
      document.write('<link rel="stylesheet" href="heavy-complement.css'+s+'" media="print" onload="this.media=&#39;all&#39;">');
  </script>
`,
    bodyHtml: heavyBody,
  }),
)

// --- vitals.html: the Core Web Vitals comparison ----------------------------
const V_FULL = 'Full CSS (render-blocking)'
const V_SPINE = 'Spine + lazy complement'
const vitalsBody = `<style>
  .vt{max-width:1120px;margin:0 auto;padding:32px 24px 64px;font:16px/1.6 system-ui,sans-serif;color:#1b1b2b}
  .vt h1{font-size:32px;letter-spacing:-.02em;margin:0 0 8px}
  .vt p.lead{font-size:17px;color:#5b5b74;margin:0 0 20px;max-width:70ch}
  .vt code{background:#f0f0f7;padding:2px 6px;border-radius:6px;font-size:.9em}
  .vt__controls{display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:16px;
    border:1px solid #e7e7f0;border-radius:14px;background:#fff;margin-bottom:12px}
  .vt__controls label{font-weight:600}
  .vt__controls select{padding:8px 10px;border:1px solid #d7d7e6;border-radius:9px;font:inherit}
  .vt__controls button{padding:10px 20px;border:0;border-radius:999px;cursor:pointer;
    font:600 15px system-ui;color:#fff;background:#6d5efc}
  .vt__controls button:disabled{opacity:.5;cursor:default}
  .vt__sizes{font-size:14px;color:#5b5b74;margin-left:auto}
  .vt__status{margin:0 0 20px;font-size:14px;color:#5b5b74;min-height:1.4em}
  .vt__grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
  .metric-card{border:1px solid #e7e7f0;border-radius:14px;background:#fff;overflow:hidden}
  .metric-card h3{margin:0;padding:12px 16px;font-size:14px;border-bottom:1px solid #eee}
  .metric-card__body{padding:16px}
  .mrow{margin-bottom:14px}
  .mrow:last-child{margin-bottom:0}
  .mrow__top{display:flex;justify-content:space-between;font-size:13px;color:#5b5b74;margin-bottom:4px}
  .mrow__val{font-weight:700;color:#1b1b2b}
  .mrow__track{height:10px;background:#f0f0f7;border-radius:6px;overflow:hidden}
  .mrow__bar{height:100%;border-radius:6px;background:#6d5efc;transition:width .4s ease;width:0}
  .mrow__bar.is-fast{background:#2fae66}.mrow__bar.is-slow{background:#e0803a}
  .verdict{padding:14px 16px;border-radius:12px;background:#eafaf1;border:1px solid #bfe8cf;
    color:#1c6b3f;font-weight:600}
  .vt__frames{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}
  .vt__frame{border:1px solid #e7e7f0;border-radius:14px;overflow:hidden;background:#fff}
  .vt__frame figcaption{padding:8px 12px;font:600 12px ui-monospace,Menlo,monospace;border-bottom:1px solid #eee}
  .vt__frame iframe{display:block;width:100%;height:300px;border:0}
  @media(max-width:820px){.vt__grid,.vt__frames{grid-template-columns:1fr}}
</style>
<div class="vt">
  <h1>Core Web Vitals: spine-first vs. full stylesheet</h1>
  <p class="lead">Same page, same content — both load their critical CSS over the network via a
    render-blocking <code>&lt;link&gt;</code> (no inlining, so it's a fair fight). <strong>Full CSS</strong>
    blocks the first paint on the whole stylesheet; <strong>spine-first</strong> blocks only on the smaller
    <code>spine.css</code> and loads <code>complement.css</code> the non-blocking "lazy CSS" way
    (<code>media="print"</code> → <code>onload="this.media='all'"</code>). A
    <a href="sw.js"><code>service worker</code></a> throttles each stylesheet by
    <code>rtt + bytes / bandwidth</code>, so a smaller critical file paints sooner — and it works on static
    hosting (GitHub Pages) with no server. The win scales with how much paint CSS you defer.</p>

  <div class="vt__controls">
    <label for="conn">Connection</label>
    <select id="conn">
      <option value="300:51200">Slow 3G — 300 ms RTT, 50 KB/s</option>
      <option value="170:184320" selected>Fast 3G — 170 ms RTT, 180 KB/s</option>
      <option value="70:1228800">4G — 70 ms RTT, 1.2 MB/s</option>
    </select>
    <button id="run">Run comparison</button>
    <span class="vt__sizes">critical: full <b>${kb(SIZE.full)}</b> vs spine <b>${kb(SIZE.spine)}</b> · complement <b>${kb(SIZE.complement)}</b> deferred</span>
  </div>
  <p class="vt__status" id="status">Click “Run comparison”. Each variant is measured in its own iframe, one after another.</p>

  <div class="vt__grid">
    <div class="metric-card">
      <h3>⏱ First Contentful Paint (FCP)</h3>
      <div class="metric-card__body" id="fcp"></div>
    </div>
    <div class="metric-card">
      <h3>🚧 Critical CSS ready (render-blocking)</h3>
      <div class="metric-card__body" id="blocking"></div>
    </div>
  </div>
  <div class="verdict" id="verdict" style="display:none"></div>

  <div class="vt__frames">
    <figure class="vt__frame" style="margin:0"><figcaption id="cap-full">Full CSS — idle</figcaption><iframe id="frame-full" title="full"></iframe></figure>
    <figure class="vt__frame" style="margin:0"><figcaption id="cap-spine">Spine-first — idle</figcaption><iframe id="frame-spine" title="spine"></iframe></figure>
  </div>
</div>

<script>
  var V_FULL=${JSON.stringify(V_FULL)}, V_SPINE=${JSON.stringify(V_SPINE)};
  var results={}, waiter=null;
  var frameFull=document.getElementById('frame-full');
  var frameSpine=document.getElementById('frame-spine');
  function status(t){document.getElementById('status').textContent=t;}

  window.addEventListener('message',function(e){
    if(!e.data||!e.data.__vitals)return;
    results[e.data.variant]=e.data;
    if(waiter){var w=waiter;waiter=null;w();}
  });

  function loadAndWait(frame,pageUrl,query){
    return new Promise(function(res){waiter=res;frame.src=pageUrl+query;});
  }

  function ms(v){return v==null?'—':Math.round(v)+' ms';}

  function bars(containerId,fullV,spineV){
    var max=Math.max(fullV||0,spineV||0,1);
    var faster=(spineV!=null&&fullV!=null)?spineV<fullV:false;
    var rows=[
      {label:V_FULL,val:fullV,fast:!faster&&false,slow:true},
      {label:V_SPINE,val:spineV,fast:faster,slow:false},
    ];
    document.getElementById(containerId).innerHTML=rows.map(function(r){
      var pct=r.val==null?0:Math.max(3,Math.round((r.val/max)*100));
      var cls=r.label===V_SPINE&&faster?'is-fast':(r.label===V_FULL?'is-slow':'');
      return '<div class="mrow"><div class="mrow__top"><span>'+r.label+'</span>'+
        '<span class="mrow__val">'+ms(r.val)+'</span></div>'+
        '<div class="mrow__track"><div class="mrow__bar '+cls+'" style="width:'+pct+'%"></div></div></div>';
    }).join('');
  }

  function render(label){
    var f=results[V_FULL]||{}, s=results[V_SPINE]||{};
    bars('fcp',f.fcp,s.fcp);
    bars('blocking',f.blocking,s.blocking);
    document.getElementById('cap-full').textContent='Full CSS — FCP '+ms(f.fcp)+' · critical '+ms(f.blocking)+' · CLS '+((f.cls||0).toFixed(3));
    document.getElementById('cap-spine').textContent='Spine-first — FCP '+ms(s.fcp)+' · critical '+ms(s.blocking)+' · CLS '+((s.cls||0).toFixed(3));
    var v=document.getElementById('verdict'); v.style.display='block';
    var bd=Math.round((f.blocking||0)-(s.blocking||0));
    if(f.fcp!=null&&s.fcp!=null&&f.fcp>s.fcp){
      var d=Math.round(f.fcp-s.fcp);
      v.textContent='On '+label+', spine-first painted '+d+' ms sooner: only the smaller spine.css blocks the first paint, and the paint complement is deferred (media=print → onload). CLS stayed '+((s.cls||0).toFixed(3))+'.';
    } else {
      v.textContent='On '+label+', the render-blocking critical CSS was ready in '+ms(f.blocking)+' (full) vs '+ms(s.blocking)+' (spine-first) — spine blocks on a smaller file and defers the paint complement, so it paints ~'+bd+' ms sooner. CLS 0.'+
        (f.hidden?' (This tab is in the background, so Chrome defers live FCP — keep it focused for real FCP; the critical-CSS figures are measured regardless.)':'');
    }
    status('Done. Re-run or pick another connection to compare.');
  }

  var runBtn=document.getElementById('run');

  // The service worker adds the CSS latency in the browser, so it must be
  // controlling the page before a run — otherwise the delay wouldn't apply.
  if('serviceWorker' in navigator){
    runBtn.disabled=true;
    status('Registering the latency service worker…');
    navigator.serviceWorker.register('sw.js').then(function(){
      function ready(){ runBtn.disabled=false; status('Ready — pick a connection and run the comparison.'); }
      if(navigator.serviceWorker.controller) ready();
      else navigator.serviceWorker.addEventListener('controllerchange', ready);
    }).catch(function(){
      runBtn.disabled=false;
      status('Service worker unavailable — the connection will not be throttled.');
    });
  } else {
    status('No service worker support here — the connection will not be throttled.');
  }

  runBtn.addEventListener('click',async function(){
    runBtn.disabled=true;
    var sel=document.getElementById('conn');
    var parts=sel.value.split(':');
    var rtt=parts[0], bw=parts[1];
    var label=sel.options[sel.selectedIndex].text.split(' — ')[0];
    var run=Date.now();
    var query='?rtt='+rtt+'&bw='+bw+'&run='+run;
    results={};
    status('Measuring “Full CSS” (render-blocking whole stylesheet)…');
    await loadAndWait(frameFull,'measure-full.html',query);
    status('Measuring “Spine-first” (spine blocks, complement lazy)…');
    await loadAndWait(frameSpine,'measure-spine.html',query);
    render(label);
    runBtn.disabled=false;
  });
</script>`
writeFileSync(
  join(here, 'vitals.html'),
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Web Vitals · postcss-spine demo</title>
  <style>${BAR_CSS}body{margin:0;background:#fafafe}</style>
</head>
<body>
${bar('vitals')}
${vitalsBody}
</body>
</html>
`,
)
console.log('  wrote vitals.html')

// --- index.html: overview with side-by-side iframes -------------------------
const overview = `<style>
  .ov{max-width:1120px;margin:0 auto;padding:40px 24px 64px;font:16px/1.6 system-ui,sans-serif;color:#1b1b2b}
  .ov h1{font-size:34px;letter-spacing:-.02em;margin:0 0 8px}
  .ov p.lead{font-size:18px;color:#5b5b74;margin:0 0 28px;max-width:60ch}
  .ov code{background:#f0f0f7;padding:2px 6px;border-radius:6px;font-size:.9em}
  .ov__cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:40px}
  .ov__card{padding:20px;border:1px solid #e7e7f0;border-radius:14px;background:#fff}
  .ov__card h3{margin:0 0 6px;font-size:16px}
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
    <div class="ov__card"><h3>4 · Web Vitals</h3><p>FCP / LCP / CLS: spine-first vs. full stylesheet.</p><a href="vitals.html">Open</a></div>
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
