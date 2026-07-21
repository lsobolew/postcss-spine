import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

import spine, { type SpineOptions } from '../src/index'

async function run(input: string, opts?: SpineOptions): Promise<string> {
  const result = await postcss([spine(opts)]).process(input, { from: undefined })
  expect(result.warnings()).toHaveLength(0)
  return result.css
}

const complement: SpineOptions = { mode: 'complement' }

describe('spine mode (default) — keeps layout, drops paint', () => {
  it('keeps layout-affecting declarations untouched', async () => {
    const css = 'a { width: 100px; height: 50px; margin: 10px; padding: 5px }'
    expect(await run(css)).toBe(css)
  })

  it('removes background shorthand', async () => {
    expect(await run('a { background: #dcdcdc url(foo.png) no-repeat center top }')).toBe('a { }')
  })

  it('removes background-color and color', async () => {
    expect(await run('a { background-color: red; color: pink }')).toBe('a { }')
  })

  it('removes box-shadow, text-shadow and outline-offset', async () => {
    expect(await run('a { box-shadow: 0 0 10px red; text-shadow: 1px 1px red; outline-offset: 10px }')).toBe(
      'a { }',
    )
  })

  it('keeps border width and style but drops the color', async () => {
    expect(await run('a { border: 2px dashed green }')).toBe('a { border: 2px dashed }')
  })

  it('keeps border longhand width and style, drops border-color', async () => {
    expect(await run('a { border-width: 2px; border-style: solid; border-color: red }')).toBe(
      'a { border-width: 2px; border-style: solid }',
    )
  })

  it('removes border-radius (paint)', async () => {
    expect(await run('a { border-radius: 4px }')).toBe('a { }')
  })

  it('removes animation longhands and shorthand', async () => {
    expect(await run('a { animation-name: x; animation-duration: 4s }')).toBe('a { }')
    expect(await run('a { animation: x 5s infinite }')).toBe('a { }')
  })

  it('removes transition longhands and shorthand', async () => {
    expect(await run('a { transition-property: all; transition-duration: 4s }')).toBe('a { }')
    expect(await run('a { transition: all 5s ease }')).toBe('a { }')
  })

  it('removes @keyframes at-rules entirely', async () => {
    expect(await run('@keyframes slide { from { opacity: 0 } to { opacity: 1 } }')).toBe('')
  })

  it('removes transform, opacity and z-index (composite, not layout)', async () => {
    expect(await run('a { transform: scale(2); opacity: 0.5; z-index: 3 }')).toBe('a { }')
  })

  it('strips vendor-prefixed paint properties', async () => {
    expect(await run('a { -webkit-box-shadow: 0 0 2px red; -webkit-transform: none }')).toBe('a { }')
  })

  it('keeps custom properties', async () => {
    expect(await run('a { --gap: 8px; color: red }')).toBe('a { --gap: 8px }')
  })
})

describe('complement mode — keeps paint, drops layout', () => {
  it('removes layout-affecting declarations', async () => {
    expect(await run('a { width: 100px; margin: 10px }', complement)).toBe('a { }')
  })

  it('keeps background, color, box-shadow', async () => {
    const css = 'a { background: red; color: blue; box-shadow: 0 0 2px black }'
    expect(await run(css, complement)).toBe(css)
  })

  it('extracts border-color from the border shorthand', async () => {
    expect(await run('a { border: 2px dashed green }', complement)).toBe('a { border-color: green }')
  })

  it('extracts border-top-color from a side shorthand', async () => {
    expect(await run('a { border-top: 1px solid red }', complement)).toBe('a { border-top-color: red }')
  })

  it('keeps border-color, drops border width and style', async () => {
    expect(await run('a { border-width: 2px; border-style: solid; border-color: red }', complement)).toBe(
      'a { border-color: red }',
    )
  })

  it('keeps animation and transition', async () => {
    const css = 'a { animation: x 5s infinite; transition: all 5s ease }'
    expect(await run(css, complement)).toBe(css)
  })

  it('keeps @keyframes with its inner declarations untouched', async () => {
    const css = '@keyframes slide { from { opacity: 0; margin: 0 } to { opacity: 1; margin: 10px } }'
    expect(await run(css, complement)).toBe(css)
  })

  it('keeps opacity, transform and z-index', async () => {
    const css = 'a { transform: scale(2); opacity: 0.5; z-index: 3 }'
    expect(await run(css, complement)).toBe(css)
  })

  it('keeps custom properties', async () => {
    expect(await run('a { --gap: 8px; width: 10px }', complement)).toBe('a { --gap: 8px }')
  })
})

describe('removeEmpty option', () => {
  it('leaves empty rules in place by default', async () => {
    expect(await run('a { color: red }')).toBe('a { }')
  })

  it('removes rules left empty after stripping', async () => {
    expect(await run('a { color: red }', { removeEmpty: true })).toBe('')
  })

  it('keeps rules that still have declarations', async () => {
    expect(await run('a { width: 10px; color: red }', { removeEmpty: true })).toBe('a { width: 10px }')
  })

  it('removes an @media block that became empty', async () => {
    expect(await run('@media (min-width: 600px) { a { color: red } }', { removeEmpty: true })).toBe('')
  })

  it('keeps an @media block that still has content', async () => {
    const css = '@media (min-width: 600px) { a { width: 10px; color: red } }'
    expect(await run(css, { removeEmpty: true })).toBe('@media (min-width: 600px) { a { width: 10px } }')
  })

  it('works in complement mode too', async () => {
    expect(await run('a { width: 10px }', { mode: 'complement', removeEmpty: true })).toBe('')
  })
})

describe('spine + complement round trip', () => {
  it('together preserve every declaration of a border shorthand', async () => {
    const input = 'a { border: 2px dashed green }'
    expect(await run(input)).toBe('a { border: 2px dashed }')
    expect(await run(input, complement)).toBe('a { border-color: green }')
  })
})
