/**
 * Property classification for postcss-spine.
 *
 * A declaration is either **layout-affecting** (it can change an element's box
 * dimensions or position, forcing the browser to relayout) or **non-layout**
 * (paint / composite only — colors, shadows, transforms, opacity, animations…).
 *
 * The "spine" is the layout-affecting half: load it and every element settles
 * into its final size and position. Adding the non-layout "complement" later
 * only triggers a repaint/composite, never a reflow.
 *
 * The list below enumerates non-layout properties, because layout is
 * open-ended (any unknown property is assumed to affect layout — the safe
 * bias, since wrongly dropping a layout rule would break dimensions, whereas
 * wrongly keeping a paint rule in the spine is harmless).
 */
const NON_LAYOUT_PROPERTIES: ReadonlySet<string> = new Set([
  // Backgrounds
  'background',
  'background-attachment',
  'background-blend-mode',
  'background-clip',
  'background-color',
  'background-image',
  'background-origin',
  'background-position',
  'background-position-x',
  'background-position-y',
  'background-repeat',
  'background-repeat-x',
  'background-repeat-y',
  'background-size',

  // Text / foreground paint
  'color',
  'box-shadow',
  'text-shadow',
  'caret-color',
  'accent-color',
  'text-decoration',
  'text-decoration-color',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-thickness',

  // Border paint (widths & styles stay in the spine — they take up space)
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'border-image',
  'border-image-source',
  'border-image-slice',
  'border-image-width',
  'border-image-outset',
  'border-image-repeat',

  // Outline (never occupies space)
  'outline',
  'outline-color',
  'outline-style',
  'outline-width',
  'outline-offset',

  // Filters & compositing
  'filter',
  'backdrop-filter',
  'mix-blend-mode',
  'isolation',
  'opacity',
  'mask',
  'mask-image',

  // Transforms & 3D (composited, do not reflow surrounding boxes)
  'transform',
  'transform-origin',
  'transform-style',
  'transform-box',
  'translate',
  'rotate',
  'scale',
  'perspective',
  'perspective-origin',
  'backface-visibility',

  // Visibility & clipping
  'visibility',
  'z-index',
  'clip',
  'clip-path',
  'will-change',

  // Interaction (no layout impact)
  'cursor',
  'pointer-events',
  'user-select',
])

/** `animation`, `animation-*`, `transition`, `transition-*`. */
const ANIMATION_TRANSITION_RE = /^(?:animation|transition)(?:-|$)/

/**
 * Returns `true` if `prop` (already unprefixed & lowercased) is paint/composite
 * only and therefore does not belong in the spine.
 */
export function isNonLayoutProperty(prop: string): boolean {
  return NON_LAYOUT_PROPERTIES.has(prop) || ANIMATION_TRANSITION_RE.test(prop)
}

/**
 * Shorthands that mix layout tokens (width, style) with paint tokens (color)
 * and therefore need to be split between the two halves.
 */
const BORDER_SHORTHANDS: ReadonlySet<string> = new Set([
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
])

export function isBorderShorthand(prop: string): boolean {
  return BORDER_SHORTHANDS.has(prop)
}

const BORDER_STYLE_KEYWORDS: ReadonlySet<string> = new Set([
  'none',
  'hidden',
  'dotted',
  'dashed',
  'solid',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
])

const BORDER_WIDTH_KEYWORDS: ReadonlySet<string> = new Set(['thin', 'medium', 'thick'])

const LENGTH_RE = /^-?[\d.]+[a-z%]*$/i
const LENGTH_FUNCTION_RE = /^(?:calc|min|max|clamp)\(/i

/**
 * Within a `border` shorthand value, is this token a layout token (width or
 * style) rather than a color?
 *
 * Border values only ever contain three kinds of token, so anything that is
 * not a recognised width or style is treated as the color. This is heuristic:
 * an ambiguous `var(--x)` is classified as a color (kept by the complement).
 */
export function isBorderLayoutToken(token: string): boolean {
  const t = token.toLowerCase()
  return (
    BORDER_STYLE_KEYWORDS.has(t) ||
    BORDER_WIDTH_KEYWORDS.has(t) ||
    LENGTH_RE.test(t) ||
    LENGTH_FUNCTION_RE.test(t)
  )
}
