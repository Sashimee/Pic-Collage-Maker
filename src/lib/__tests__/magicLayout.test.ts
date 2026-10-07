import { describe, it, expect } from 'vitest'
import { magicLayout } from '../magicLayout'
import { facePan } from '../../ai/faceDetection'
import type { GridCell } from '../../types'

const area = (cells: GridCell[]) => cells.reduce((sum, c) => sum + c.width * c.height, 0)
const cellAspect = (c: GridCell, W: number, H: number) => (c.width * W) / (c.height * H)

function expectTiles(cells: GridCell[]) {
  expect(area(cells)).toBeCloseTo(1, 9)
  for (const c of cells) {
    expect(c.x).toBeGreaterThanOrEqual(-1e-9)
    expect(c.y).toBeGreaterThanOrEqual(-1e-9)
    expect(c.x + c.width).toBeLessThanOrEqual(1 + 1e-9)
    expect(c.y + c.height).toBeLessThanOrEqual(1 + 1e-9)
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i]
      const b = cells[j]
      const overlapW = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const overlapH = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      expect(overlapW <= 1e-9 || overlapH <= 1e-9).toBe(true)
    }
  }
}

describe('magicLayout', () => {
  it('returns nothing for no photos', () => {
    expect(magicLayout([], 1080, 1350)).toEqual([])
  })

  it('gives one photo the whole board', () => {
    expect(magicLayout([1.5], 1080, 1350)).toEqual([{ x: 0, y: 0, width: 1, height: 1 }])
  })

  it('stacks two landscape photos on a portrait board without cropping', () => {
    const cells = magicLayout([1.5, 1.5], 1500, 2000)
    expect(cells).toEqual([
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ])
    for (const c of cells) expect(cellAspect(c, 1500, 2000)).toBeCloseTo(1.5)
  })

  it('puts two portrait photos side by side on a landscape board', () => {
    const cells = magicLayout([0.75, 0.75], 1500, 1000)
    expect(cells.map((c) => [c.x, c.y])).toEqual([
      [0, 0],
      [0.5, 0],
    ])
    for (const c of cells) expect(cellAspect(c, 1500, 1000)).toBeCloseTo(0.75)
  })

  it('makes cells the shape of their photos when the set packs exactly', () => {
    // A square board: row of two squares over one 2:1 panorama.
    const cells = magicLayout([1, 1, 2], 1000, 1000)
    expectTiles(cells)
    expect(cells.map((c) => cellAspect(c, 1000, 1000))).toEqual(
      [1, 1, 2].map((a) => expect.closeTo(a)),
    )
  })

  it('keeps the photo order and tiles the board for a mixed set', () => {
    const aspects = [1.5, 0.67, 1, 1.78, 0.75, 1.33, 0.56]
    const cells = magicLayout(aspects, 1080, 1350)
    expect(cells).toHaveLength(aspects.length)
    expectTiles(cells)
    const ids = [...cells.keys()]
    const byRows = [...ids].sort((a, b) => cells[a].y - cells[b].y || cells[a].x - cells[b].x)
    const byColumns = [...ids].sort((a, b) => cells[a].x - cells[b].x || cells[a].y - cells[b].y)
    expect([byRows, byColumns]).toContainEqual(ids)
  })

  it('is deterministic', () => {
    const aspects = [1.2, 0.8, 1.6, 0.9, 1.1]
    expect(magicLayout(aspects, 1080, 1080)).toEqual(magicLayout(aspects, 1080, 1080))
  })

  it('rejects a broken aspect ratio', () => {
    expect(() => magicLayout([1, 0], 100, 100)).toThrow(/positive/)
    expect(() => magicLayout([Number.NaN], 100, 100)).toThrow(/positive/)
  })
})

describe('facePan', () => {
  const W = 4000
  const H = 3000

  it('leaves the crop centred without faces', () => {
    expect(facePan([], W, H, 1)).toEqual({ x: 0, y: 0 })
  })

  it('pans a landscape photo in a square cell towards a face on the left', () => {
    // Shown width is 3000 of 4000, so the face centre at 1000 needs the full left pan.
    expect(facePan([{ x: 900, y: 1400, width: 200, height: 200 }], W, H, 1)).toEqual({ x: 1, y: 0 })
  })

  it('pans part-way for an off-centre face and stops at the edge', () => {
    expect(facePan([{ x: 2200, y: 1400, width: 200, height: 200 }], W, H, 1).x).toBeCloseTo(-0.6)
    expect(facePan([{ x: 3800, y: 0, width: 200, height: 200 }], W, H, 1).x).toBe(-1)
  })

  it('pans vertically when the cell is wider than the photo', () => {
    // Cell 2:1 shows 4000×2000 of 4000×3000; a face centred at y=700 wants the top.
    expect(facePan([{ x: 1900, y: 600, width: 200, height: 200 }], W, H, 2)).toEqual({ x: 0, y: 1 })
  })

  it('centres on the box around several faces', () => {
    const faces = [
      { x: 1000, y: 1400, width: 200, height: 200 },
      { x: 2800, y: 1400, width: 200, height: 200 },
    ]
    expect(facePan(faces, W, H, 1)).toEqual({ x: 0, y: 0 })
  })
})
