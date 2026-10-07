import { describe, it, expect } from 'vitest'
import { exportSVG } from '../exportSVG'
import type { Background, StickerElement } from '../../types'

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
})
