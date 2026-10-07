import { describe, it, expect } from 'vitest'
import { exportSVG } from '../exportSVG'
import type { Background, PhotoElement, PhotoStyling, StickerElement } from '../../types'

const bg: Background = {
  type: 'solid',
  color: '#ffffff',
  gradientFrom: '#ffffff',
  gradientTo: '#000000',
  gradientAngle: 0,
  patternId: 'dots',
  patternColor: '#000000',
}

const sticker = (patch: Partial<StickerElement> = {}): StickerElement => ({
  id: 's1',
  type: 'sticker',
  x: 10,
  y: 20,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  emoji: '⭐',
  fontSize: 80,
  ...patch,
})

describe('exportSVG', () => {
  it('leaves hidden layers out', () => {
    const svg = exportSVG([sticker({ hidden: true })], 100, 100, bg)
    expect(svg).not.toContain('⭐')
  })

  it('wraps a blended layer in a mix-blend-mode group', () => {
    const svg = exportSVG([sticker({ blendMode: 'multiply' })], 100, 100, bg)
    expect(svg).toMatch(/<g style="mix-blend-mode:multiply">\s*<text[^>]*>⭐<\/text>\s*<\/g>/)
  })

  it('adds no blend group for the normal mode', () => {
    const svg = exportSVG([sticker({ blendMode: 'normal', opacity: 0.4 })], 100, 100, bg)
    expect(svg).not.toContain('mix-blend-mode')
    expect(svg).toContain('opacity="0.4"')
  })

  describe('photo styling', () => {
    const photo = (styling?: PhotoStyling, patch: Partial<PhotoElement> = {}): PhotoElement => ({
      id: 'p1',
      type: 'photo',
      x: 10,
      y: 20,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      src: 'data:image/png;base64,AAAA',
      width: 400,
      height: 300,
      filters: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        preset: 'none',
        vignette: 0,
      } as PhotoElement['filters'],
      styling,
      ...patch,
    })
    const parse = (el: PhotoElement) =>
      new DOMParser().parseFromString(
        exportSVG([el], 1000, 1000, bg, { includeBackground: false }),
        'image/svg+xml',
      )

    it('keeps an unstyled photo a bare image', () => {
      const doc = parse(photo())
      expect(doc.querySelector('image')?.getAttribute('transform')).toContain(
        'translate(10.00, 20.00)',
      )
      expect(doc.querySelector('filter')).toBeNull()
    })

    it('rounds the clip, and draws the border inside it', () => {
      const doc = parse(photo({ radius: 24, borderWidth: 8, borderColor: '#ff0000' }))
      expect(doc.querySelector('parsererror')).toBeNull()
      expect(doc.querySelector('clipPath path')?.getAttribute('d')).toMatch(/A 24,24/)
      const border = doc.querySelector('path[stroke]')!
      expect(border.getAttribute('stroke')).toBe('#ff0000')
      expect(border.getAttribute('stroke-width')).toBe('16')
      expect(border.getAttribute('clip-path')).toBe('url(#clip-p1)')
    })

    it('puts a drop shadow and the polaroid card beneath the photo', () => {
      const doc = parse(photo({ polaroid: true, shadowBlur: 20, shadowOffset: 6 }))
      const shadow = doc.querySelector('feDropShadow')!
      expect(shadow.getAttribute('stdDeviation')).toBe('10')
      expect(shadow.getAttribute('dy')).toBe('6')
      const knockout = shadow.nextElementSibling!
      expect(knockout.tagName).toBe('feComposite')
      expect(knockout.getAttribute('operator')).toBe('out')
      expect(knockout.getAttribute('in2')).toBe('SourceAlpha')
      const g = doc.querySelector('g[transform]')!
      const order = [...g.children].map((c) => c.tagName)
      expect(order).toEqual(['path', 'path', 'image'])
      expect(g.children[0].getAttribute('filter')).toBe('url(#shadow-p1)')
      expect(g.children[1].getAttribute('fill')).toBe('#ffffff')
    })

    it('escapes a hostile colour', () => {
      const svg = exportSVG([photo({ borderWidth: 2, borderColor: '"/><script>' })], 100, 100, bg)
      expect(svg).not.toContain('<script>')
    })
  })
})
