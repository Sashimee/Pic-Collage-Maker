import { describe, it, expect } from 'vitest'
import { GRID_LAYOUTS, cellRect, maxGridMargin } from '../grids'

const full = { x: 0, y: 0, width: 1, height: 1 }

describe('cellRect', () => {
  it('fills the board less half a gap on each side without a margin', () => {
    expect(cellRect(full, 1000, 800, 10)).toEqual({ x: 5, y: 5, w: 990, h: 790 })
  })

  it('insets every cell by the outer margin', () => {
    expect(cellRect(full, 1000, 800, 0, 50)).toEqual({ x: 50, y: 50, w: 900, h: 700 })
    const right = cellRect({ x: 0.5, y: 0, width: 0.5, height: 1 }, 1000, 800, 0, 50)
    expect(right.x + right.w).toBe(950)
  })

  it('caps the margin at a quarter of the short side', () => {
    expect(cellRect(full, 400, 200, 0, 500)).toEqual({ x: 50, y: 50, w: 300, h: 100 })
  })

  it('treats a negative margin as none', () => {
    expect(cellRect(full, 400, 200, 0, -20)).toEqual(cellRect(full, 400, 200, 0))
  })
})

describe('GRID_LAYOUTS', () => {
  it('has unique ids', () => {
    const ids = GRID_LAYOUTS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('declares as many slots as it has cells, all inside the unit square', () => {
    for (const l of GRID_LAYOUTS) {
      expect(l.count, l.id).toBe(l.cells.length)
      for (const c of l.cells) {
        expect(c.x, l.id).toBeGreaterThanOrEqual(0)
        expect(c.y, l.id).toBeGreaterThanOrEqual(0)
        expect(c.x + c.width, l.id).toBeLessThanOrEqual(1 + 1e-9)
        expect(c.y + c.height, l.id).toBeLessThanOrEqual(1 + 1e-9)
      }
    }
  })

  it('ships magazine, filmstrip, polaroid and story presets', () => {
    for (const tag of ['magazine', 'filmstrip', 'polaroid', 'story']) {
      expect(GRID_LAYOUTS.filter((l) => l.tags?.includes(tag)).length, tag).toBeGreaterThan(2)
    }
  })
})

describe('maxGridMargin', () => {
  it('is the slider cap on a big board and the cellRect clamp on a small one', () => {
    expect(maxGridMargin(1080, 1350)).toBe(160)
    expect(maxGridMargin(1080, 566)).toBe(141)
    expect(cellRect(full, 1080, 566, 0, 500).x).toBeGreaterThanOrEqual(maxGridMargin(1080, 566))
  })
})
