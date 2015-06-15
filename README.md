# PostCSS Spine [![Build Status][ci-img]][ci]

[PostCSS] plugin generates "layout only" css.

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/lsobolew/postcss-spine.svg
[ci]:      https://travis-ci.org/lsobolew/postcss-spine

```css
.foo {
    /* Input example */
}
```

```css
.foo {
  /* Output example */
}
```

## Usage

```js
postcss([ require('postcss-spine') ])
```

See [PostCSS] docs for examples for your environment.
