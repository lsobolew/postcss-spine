# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm test` — Vitest run (single pass). `npm run test:watch` for watch mode, `npm run test:coverage` for coverage.
- Run a single test: `npx vitest run -t "extracts border-color"` (matches the `it(...)` name).
- `npm run lint` / `npm run lint:fix` — ESLint (flat config, typescript-eslint).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — tsup, emits dual CJS (`dist/index.js`) + ESM (`dist/index.mjs`) + declarations.
- `prepublishOnly` runs lint + typecheck + test + build.

## Architecture

A PostCSS 8 plugin (TypeScript) that splits a stylesheet into two complementary halves:

- **spine** (`mode: 'spine'`, default) — only declarations that affect **layout** (box size/position), so the page settles at final dimensions.
- **complement** (`mode: 'complement'`) — only the **paint/composite** declarations the spine dropped; adding it triggers repaint, never reflow.

Two source files:

- `src/properties.ts` — the classification data and pure helpers. `isNonLayoutProperty(prop)` is the core decision: a property is non-layout if it's in the curated `NON_LAYOUT_PROPERTIES` set or matches the `animation*`/`transition*` regex. **Everything not listed is treated as layout** — a deliberate safe bias (wrongly dropping a layout rule breaks dimensions; keeping an extra paint rule in the spine is harmless). `isBorderShorthand` / `isBorderLayoutToken` support border splitting.
- `src/index.ts` — the plugin. Uses the PostCSS 8 visitor API (`Declaration`, `AtRule`), not the old `eachDecl`/`removeSelf`. The keep/drop rule is one line: `isNonLayoutProperty(prop) !== keepNonLayout`.

### Behaviors that require reading multiple files to understand

- **Border shorthands are the only "mixed" case.** `border` / `border-{top,right,bottom,left}` contain both layout tokens (width, style) and a paint token (color). `handleBorderShorthand` tokenizes the value (regex keeps `rgb(…)`/`calc(…)` intact), then the spine keeps width+style while the complement keeps the color and renames the prop to `border[-side]-color`. `border-width`/`border-style` longhands are layout (kept in spine); `border-color`/`border-radius`/`border-image` are paint.
- **Border token classification is heuristic** (`isBorderLayoutToken`): a token is layout if it's a known style keyword, a width keyword (`thin`/`medium`/`thick`), a `<length>`, or a length function. Anything else — including an ambiguous `var(--x)` — is treated as the color.
- **Custom properties (`--*`) are kept in both halves** (either half may reference them), so they short-circuit `handleDeclaration`.
- **`@keyframes` / `@font-face` inner declarations are never touched** (`inPreservedAtRule` walks ancestors). `@keyframes` as a whole is dropped from the spine (the `AtRule` visitor) and kept intact in the complement.
- **Vendor prefixes** are stripped via `unprefixed()` before classification.

### Design decisions

- Public API is a single `mode` option (replaced the old `complementary`/`fallback` booleans; the pre-rewrite v0.0.0 was effectively unpublished).
- `postcss` is a **peer dependency**; the runtime bundle has no dependencies (the old `css-color-names` etc. were removed — border color detection is now keyword-based).
- The CJS bundle ends with `module.exports = <fn>` (tsup default), so `require('postcss-spine')` returns the callable plugin directly. If tsup's output ever regresses to `{ default }`, restore the `esbuildOptions` cjs footer (see git history of `tsup.config.ts`).
- Tests assert exact CSS output-string equality, so whitespace in expected output matters.

## Notes

- `npm audit` reports vulnerabilities in dev-only transitive deps (tsup/vitest → esbuild/glob chain). They don't ship (runtime deps: none). Don't `audit fix --force` — it breaks the toolchain.
