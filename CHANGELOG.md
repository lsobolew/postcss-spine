# [0.2.0](https://github.com/lsobolew/postcss-spine/compare/v0.1.0...v0.2.0) (2026-07-21)


### Features

* add removeEmpty option to drop rules left empty after stripping ([e2bb94b](https://github.com/lsobolew/postcss-spine/commit/e2bb94b4b7eed868a60b137f208ce2ebcf48f898))

# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0]

Ground-up rewrite.

### Changed

- Migrated the plugin to **TypeScript** and the **PostCSS 8** visitor API
  (was PostCSS 4).
- Replaced the `complementary` / `fallback` booleans with a single
  `mode: 'spine' | 'complement'` option.
- Border shorthands now also split the side variants
  (`border-top/right/bottom/left`) and no longer depend on a color-name
  dictionary; width/style tokens are detected directly.
- Ships a dual **ESM + CommonJS** bundle with type declarations.

### Added

- Expanded non-layout property coverage (filters, masks, individual transform
  properties, interaction properties, and more).
- `@keyframes` / `@font-face` inner declarations are preserved untouched.
- Vitest test suite, ESLint (flat config) + TypeScript type checking, and a
  GitHub Actions CI matrix (Node 18/20/22).

### Removed

- Gulp, Mocha/Chai, Travis CI, and the unused `css-*` / `extend` dependencies.

[0.1.0]: https://github.com/lsobolew/postcss-spine/releases/tag/v0.1.0
