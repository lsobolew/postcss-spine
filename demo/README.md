# postcss-spine demo

The same marketing landing page, split by `postcss-spine` into a layout
**spine** and a paint **complement**, shown three ways.

## View it

The pages are static — open `demo/index.html` directly, or serve the folder
(recommended, so the lazy page can fetch `complement.css`):

```bash
npx serve demo
# or
python3 -m http.server -d demo 8080
```

Then open <http://localhost:8080/>.

## The pages

| Page          | What it shows                                                                              |
| ------------- | ------------------------------------------------------------------------------------------ |
| `index.html`  | Overview with `full.html` and `spine.html` side by side — identical geometry.              |
| `full.html`   | The original `styles.css` (baseline).                                                      |
| `spine.html`  | **`spine.css` only** — every box keeps its size and position, but all paint is gone.       |
| `lazy.html`   | Spine **inlined** in `<head>`, `complement.css` **lazy-loaded** on a click.                |

On `lazy.html`, hit **Load complement.css** and the panel reports the maximum
per-element box shift and the browser's Cumulative Layout Shift — both stay at
~0 because the spine already locked in the geometry; adding the complement is a
pure repaint.

## Rebuild

`styles.css` (the full source) and `page.html` (shared markup) are the inputs.
Everything else — `spine.css`, `complement.css`, and the four HTML pages — is
generated:

```bash
npm run demo:build   # builds the plugin, then runs demo/build.mjs
```
