import type { AtRule, ChildNode, Container, Declaration, Document, Plugin } from 'postcss'

import { isBorderLayoutToken, isBorderShorthand, isNonLayoutProperty } from './properties'

/** Which half of the stylesheet to keep. */
export type SpineMode = 'spine' | 'complement'

export interface SpineOptions {
  /**
   * - `'spine'` (default) keeps only layout-affecting declarations, so the
   *   rendered page locks in every element's dimensions and position.
   * - `'complement'` keeps only the paint/composite declarations that the spine
   *   dropped. Loading it after the spine repaints the page without any reflow.
   */
  mode?: SpineMode
}

const PLUGIN_NAME = 'postcss-spine'
const KEYFRAMES_RE = /keyframes$/i
const VENDOR_PREFIX_RE = /^-\w+-/
/** Token splitter that keeps `rgb(…)`, `calc(…)` etc. intact as single tokens. */
const VALUE_TOKEN_RE = /[^\s]+\([^)]*\)|[^\s]+/g

/** Strip a leading vendor prefix (`-webkit-`, `-moz-`, `-ms-`, `-o-`). */
function unprefixed(prop: string): string {
  return prop.replace(VENDOR_PREFIX_RE, '')
}

/**
 * Declarations inside `@keyframes` / `@font-face` are left untouched: keyframes
 * belong wholly to the complement (and the whole at-rule is dropped from the
 * spine), and a partially-stripped `@font-face` would be broken.
 */
function inPreservedAtRule(node: ChildNode): boolean {
  let current: Container | Document | undefined = node.parent
  while (current) {
    if (current.type === 'atrule') {
      const name = unprefixed((current as AtRule).name).toLowerCase()
      if (name === 'font-face' || KEYFRAMES_RE.test(name)) return true
    }
    current = current.parent
  }
  return false
}

/** Split a `border` shorthand between the spine (width/style) and complement (color). */
function handleBorderShorthand(decl: Declaration, prop: string, keepNonLayout: boolean): void {
  const tokens = decl.value.match(VALUE_TOKEN_RE) ?? []

  if (keepNonLayout) {
    const colorTokens = tokens.filter((token) => !isBorderLayoutToken(token))
    if (colorTokens.length === 0) {
      decl.remove()
      return
    }
    decl.prop = prop === 'border' ? 'border-color' : `${prop}-color`
    decl.value = colorTokens.join(' ')
    return
  }

  const layoutTokens = tokens.filter(isBorderLayoutToken)
  if (layoutTokens.length === 0) {
    decl.remove()
    return
  }
  decl.value = layoutTokens.join(' ')
}

function handleDeclaration(decl: Declaration, keepNonLayout: boolean): void {
  // Custom properties may feed either half, so keep them everywhere.
  if (decl.prop.startsWith('--')) return
  if (inPreservedAtRule(decl)) return

  const prop = unprefixed(decl.prop).toLowerCase()

  if (isBorderShorthand(prop)) {
    handleBorderShorthand(decl, prop, keepNonLayout)
    return
  }

  // Spine keeps layout (drops non-layout); complement keeps non-layout.
  if (isNonLayoutProperty(prop) !== keepNonLayout) {
    decl.remove()
  }
}

/**
 * PostCSS plugin that splits a stylesheet into its layout-affecting "spine" and
 * the paint/composite "complement".
 */
const postcssSpine = (opts: SpineOptions = {}): Plugin => {
  const keepNonLayout = (opts.mode ?? 'spine') === 'complement'

  return {
    postcssPlugin: PLUGIN_NAME,
    Declaration(decl) {
      handleDeclaration(decl, keepNonLayout)
    },
    AtRule(atRule) {
      // @keyframes is an animation concern: drop it from the spine, keep it in
      // the complement (its inner declarations are preserved untouched).
      if (!keepNonLayout && KEYFRAMES_RE.test(unprefixed(atRule.name))) {
        atRule.remove()
      }
    },
  }
}

postcssSpine.postcss = true

export default postcssSpine
