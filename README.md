# PostCSS Spine

[![CI][ci-img]][ci]
[![npm][npm-img]][npm]

[PostCSS] plugin that splits a stylesheet into two halves:

- the **spine** — every declaration that affects **layout** (box dimensions and
  position); and
- the **complement** — everything that is **paint/composite only** (colors,
  backgrounds, shadows, transforms, opacity, animations…).

Load the spine first and the browser lays every element out at its final size
and position. Add the complement afterwards and the browser only has to
**repaint/composite** — no element changes its dimensions, so there is no
reflow. This is useful for shipping a lightweight "layout skeleton" first and
deferring the visual styling, without any layout shift when it arrives.

```css
/* input */
.card {
  width: 320px;
  padding: 16px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  color: #222;
  transition: box-shadow 0.2s;
}
```

```css
/* spine  — mode: 'spine' (default) */
.card {
  width: 320px;
  padding: 16px;
  border: 1px solid;
}
```

```css
/* complement — mode: 'complement' */
.card {
  border-color: #ccc;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  color: #222;
  transition: box-shadow 0.2s;
}
```

[PostCSS]: https://github.com/postcss/postcss
[ci-img]: https://github.com/lsobolew/postcss-spine/actions/workflows/ci.yml/badge.svg
[ci]: https://github.com/lsobolew/postcss-spine/actions/workflows/ci.yml
[npm-img]: https://img.shields.io/npm/v/postcss-spine.svg
[npm]: https://www.npmjs.com/package/postcss-spine

## Install

```bash
npm install --save-dev postcss-spine postcss
```

`postcss` is a peer dependency (`^8.4`).

## Usage

The plugin works like any other PostCSS plugin. Run it twice — once per mode —
to produce both stylesheets.

```js
import postcss from 'postcss'
import spine from 'postcss-spine'

const source = fs.readFileSync('styles.css', 'utf8')

const spineCss = (await postcss([spine()]).process(source, { from: undefined })).css
const complementCss = (
  await postcss([spine({ mode: 'complement' })]).process(source, { from: undefined })
).css
```

CommonJS works too:

```js
const spine = require('postcss-spine')
```

### With a PostCSS config

Because the mode is an option, you typically want two build passes rather than a
single `postcss.config.js`. For example, as npm scripts:

```jsonc
{
  "scripts": {
    "css:spine": "postcss styles.css -u postcss-spine -o dist/spine.css",
    "css:complement": "postcss styles.css -u postcss-spine -o dist/complement.css"
  }
}
```

(pass `mode: 'complement'` via your own wrapper for the second pass).

## Options

| Option | Type                       | Default   | Description                                                                                     |
| ------ | -------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `mode` | `'spine' \| 'complement'` | `'spine'` | `'spine'` keeps only layout-affecting declarations; `'complement'` keeps only the paint half. |

## How declarations are classified

The plugin keeps a curated list of **non-layout** (paint/composite) properties;
anything not on the list is assumed to affect layout. This bias is deliberate —
wrongly dropping a layout rule would break dimensions, whereas keeping an extra
paint rule in the spine is harmless.

- **Non-layout** (dropped from the spine, kept in the complement): `color`, all
  `background*`, `box-shadow`, `text-shadow`, `border-*-color`, `border-radius*`,
  `border-image*`, `outline*`, `opacity`, `filter`, `backdrop-filter`,
  `transform*`, `perspective*`, `visibility`, `z-index`, `clip`, `clip-path`,
  `mask*`, `cursor`, `pointer-events`, `user-select`, and any `animation*` /
  `transition*` property. `@keyframes` at-rules are dropped from the spine.
- **Layout** (kept in the spine): everything else — widths, heights, margins,
  padding, `display`, flexbox/grid, positioning, `font-*`, `border-width`,
  `border-style`, and so on.
- **Border shorthands** (`border`, `border-top/right/bottom/left`) are split:
  the width and style tokens go to the spine, the color token becomes a
  `border-color` (or `border-<side>-color`) declaration in the complement.
- **Custom properties** (`--*`) are kept in both halves, since either half may
  reference them.
- Declarations inside `@keyframes` and `@font-face` are left untouched.

Vendor-prefixed properties (`-webkit-`, `-moz-`, `-ms-`, `-o-`) are classified
by their unprefixed name.

### Known limitations

- Border shorthand splitting is heuristic. A token is treated as the color
  unless it is a recognised width (`<length>`, `thin`/`medium`/`thick`,
  `calc()`/`min()`/`max()`/`clamp()`) or style keyword. An ambiguous
  `var(--x)` inside a `border` value is therefore classified as a color.
- Empty rules left behind after stripping declarations are not removed.

## Contributing

```bash
npm install
npm run lint        # ESLint (flat config, typescript-eslint)
npm run typecheck   # tsc --noEmit
npm test            # Vitest
npm run build       # tsup — dual ESM + CJS bundle with type declarations
```

## Releases

Automated with [semantic-release](https://semantic-release.gitbook.io/) on every
push to `master`, publishing to npm via [trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers)
— no tokens. Commit with [Conventional Commits](https://www.conventionalcommits.org/).
See [RELEASING.md](./RELEASING.md) for the setup and workflow.

## License

[MIT](./LICENSE) © Łukasz Sobolewski
