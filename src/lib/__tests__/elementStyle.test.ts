import { describe, it, expect } from 'vitest'
import { styleOf, stylePatch } from '../elementStyle'
import {
  DEFAULT_FILTERS,
  type CanvasElement,
  type PhotoElement,
  type TextElement,
} from '../../types'

const base = { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 }

const photo = (over: Partial<PhotoElement> = {}): PhotoElement => ({
  ...base,
  id: 'p',
  type: 'photo',
  src: 'blob:p',
  width: 100,
  height: 80,
  filters: { ...DEFAULT_FILTERS },
  ...over,
})

const text = (over: Partial<TextElement> = {}): TextElement => ({
  ...base,
  id: 't',
  type: 'text',
  text: 'Hello',
  fontFamily: 'Poppins',
  fontSize: 40,
  fill: '#000000',
  fontStyle: 'normal',
  ...over,
})

describe('styleOf / stylePatch', () => {
  it('copies the look of a photo but not its pixels, crop or place', () => {
    const source = photo({
      opacity: 0.5,
      shape: 'circle',
      styling: { borderWidth: 8, borderColor: '#ff0000' },
      filterStack: [{ type: 'brightness', value: 0.3 }],
      crop: { x: 0, y: 0, width: 10, height: 10 },
    })
    const patch = stylePatch(styleOf(source), photo({ id: 'q', src: 'blob:q' }))
    expect(patch).toMatchObject({
      opacity: 0.5,
      shape: 'circle',
      styling: { borderWidth: 8, borderColor: '#ff0000' },
      filterStack: [{ type: 'brightness', value: 0.3 }],
    })
    for (const key of ['id', 'src', 'x', 'y', 'width', 'crop'])
      expect(patch).not.toHaveProperty(key)
  })

  it('clears what the source does not have', () => {
    const target = photo({ styling: { polaroid: true }, blendMode: 'multiply' })
    const patch = stylePatch(styleOf(photo()), target)
    const pasted = { ...target, ...patch } as PhotoElement
    expect(pasted.styling).toBeUndefined()
    expect(pasted.blendMode).toBeUndefined()
  })

  it('copies the typography of text but keeps its words', () => {
    const source = text({ fontFamily: 'Lobster', fill: '#ff00ff', letterSpacing: 4, text: 'Other' })
    const pasted = { ...text(), ...stylePatch(styleOf(source), text()) } as TextElement
    expect(pasted).toMatchObject({
      fontFamily: 'Lobster',
      fill: '#ff00ff',
      letterSpacing: 4,
      text: 'Hello',
    })
  })

  it('carries only opacity and blend mode across element types', () => {
    const source = text({ opacity: 0.4, blendMode: 'screen', fill: '#ff0000' })
    const sticker: CanvasElement = { ...base, id: 's', type: 'sticker', emoji: '⭐', fontSize: 60 }
    expect(stylePatch(styleOf(source), sticker)).toEqual({ opacity: 0.4, blendMode: 'screen' })
    expect(stylePatch(styleOf(source), photo())).toEqual({ opacity: 0.4, blendMode: 'screen' })
  })

  it('leaves a photo frame and clip shape alone when either side is in a grid', () => {
    const framed = photo({ shape: 'heart', styling: { borderWidth: 6 } })
    const tinted = photo({ filters: { ...DEFAULT_FILTERS, brightness: 0.2 } })
    const fromGrid = stylePatch(styleOf(tinted, true), framed)
    expect(fromGrid).not.toHaveProperty('styling')
    expect(fromGrid).not.toHaveProperty('shape')
    expect((fromGrid as Partial<PhotoElement>).filters).toMatchObject({ brightness: 0.2 })
    const intoGrid = stylePatch(styleOf(framed), tinted, true)
    expect(Object.keys(intoGrid).sort()).toEqual(['blendMode', 'filterStack', 'filters', 'opacity'])
  })
})
