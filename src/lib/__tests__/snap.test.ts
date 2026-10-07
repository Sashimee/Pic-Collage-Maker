import { describe, it, expect } from 'vitest'
import { computeSnap } from '../snap'
import type { PhotoElement, TextElement } from '../../types'

function makePhoto(id: string, x: number, y: number, w = 100, h = 100): PhotoElement {
  return {
    id,
    type: 'photo',
    x,
    y,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    src: '',
    width: w,
    height: h,
    filters: { brightness: 0, contrast: 0, saturation: 0, blur: 0, vignette: 0, preset: 'none' },
  }
}

function makeText(id: string, x: number, y: number, text: string, fontSize = 24): TextElement {
  return {
    id,
    type: 'text',
    x,
    y,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    text,
    fontFamily: 'Arial',
    fontSize,
    fill: '#000',
    fontStyle: 'normal',
  }
}

const BOARD_W = 1080
const BOARD_H = 1350

describe('computeSnap', () => {
  it('does not snap when far apart', () => {
    const dragged = makePhoto('a', 200, 200)
    const others = [makePhoto('b', 500, 500)]
    const result = computeSnap(dragged, others, BOARD_W, BOARD_H, 200, 200)
    expect(result.x).toBe(200)
    expect(result.y).toBe(200)
    expect(result.guides).toHaveLength(0)
  })

  it('snaps dragged element to board left edge', () => {
    const dragged = makePhoto('a', 10, 200)
    const result = computeSnap(dragged, [], BOARD_W, BOARD_H, 10, 200)
    expect(result.x).toBe(0)
    expect(result.y).toBe(200)
    expect(result.guides.length).toBeGreaterThanOrEqual(1)
    expect(result.guides.some((g) => g.axis === 'x' && g.pos === 0)).toBe(true)
  })

  it('snaps dragged element to another element edge', () => {
    const other = makePhoto('b', 300, 400)
    // Dragged right edge (x=190 + w=100 => right=290) is 10 px away from other's left edge (300)
    const dragged = makePhoto('a', 190, 400)
    const result = computeSnap(dragged, [other], BOARD_W, BOARD_H, 190, 400)
    expect(result.x).toBe(200) // snap so right edge aligns with other's left edge
    expect(result.y).toBe(400)
  })

  it('snaps to vertical board center', () => {
    // 100-wide photo whose centre sits 5px left of the board centre.
    const dragged = makePhoto('a', BOARD_W / 2 - 55, 200, 100, 100)
    const result = computeSnap(dragged, [], BOARD_W, BOARD_H, dragged.x, 200)
    expect(result.x).toBe(BOARD_W / 2 - 50) // center x of dragged should be board center
    // guides should include center line
    expect(result.guides.some((g) => g.axis === 'x' && Math.abs(g.pos - BOARD_W / 2) < 1)).toBe(true)
  })

  it('snaps with equal spacing distribution between two elements', () => {
    // Two fixed elements at x=100 (width 100 => right=200) and x=400 (left=400)
    // Space between = 200. Dragged element width=100.
    // If dragged center is placed at x=250, its left=200, right=300.
    // For equal spacing: gap1 = 200-200 = 0, gap2 = 400-300 = 100. Not equal.
    // Let's position dragged at x=245. left=245, right=345.
    // center snap to middle: center should be at (200+400)/2 = 300.
    // dragged center = 245 + 50 = 295, 5px away from 300 -> should snap to 250.
    const left = makePhoto('left', 100, 0, 100, 100)
    const right = makePhoto('right', 400, 0, 100, 100)
    const dragged = makePhoto('mid', 240, 0, 100, 100)
    const result = computeSnap(dragged, [left, right], BOARD_W, BOARD_H, 240, 0)
    // The centre of dragged (290) is 10px from the midpoint between the two
    // neighbours' centres (150 and 450 → 300). After snap, dragged.x should be
    // 250 so its centre sits at 300 — equal spacing on both sides.
    expect(result.x).toBe(250)
  })

  it('snaps to horizontal board center', () => {
    // 100-tall photo whose centre sits 5px above the board centre.
    const dragged = makePhoto('a', 200, BOARD_H / 2 - 55, 100, 100)
    const result = computeSnap(dragged, [], BOARD_W, BOARD_H, 200, dragged.y)
    expect(result.y).toBe(BOARD_H / 2 - 50)
    expect(result.guides.some((g) => g.axis === 'y' && Math.abs(g.pos - BOARD_H / 2) < 1)).toBe(true)
  })

  it('snaps text element to photo edge using approximate bounds', () => {
    const photo = makePhoto('p', 300, 500, 200, 200)
    // Text approx width = fontSize * text.length * 0.6 = 20 * 4 * 0.6 = 48
    const text = makeText('t', 200, 500, 'Hola', 20)
    const result = computeSnap(text, [photo], BOARD_W, BOARD_H, 200, 500)
    // text spans 200..248; nearest photo edge (left 300) is 52px away and the
    // adjacent edge (right 500) is far too — beyond threshold (12) => no x snap.
    expect(result.x).toBe(200)

    // Move closer: text left edge 295, diff = 5
    const textClose = makeText('t2', 295, 500, 'Hola', 20)
    const result2 = computeSnap(textClose, [photo], BOARD_W, BOARD_H, 295, 500)
    expect(result2.x).toBe(300)
  })

  describe('equal spacing', () => {
    const a = makePhoto('a', 100, 300, 100, 100)
    const b = makePhoto('b', 260, 300, 100, 100)

    it('centres between two neighbours of different sizes by their gaps', () => {
      const wide = makePhoto('w', 500, 300, 300, 100)
      const dragged = makePhoto('d', 395, 300, 60, 100)
      const result = computeSnap(dragged, [b, wide], BOARD_W, BOARD_H, 395, 300)
      // b ends at 360, wide starts at 500: 140 of room, 60 wide → 40 each side.
      expect(result.x).toBe(400)
      expect(result.spacing).toEqual([
        { axis: 'x', from: 360, to: 400, at: 350 },
        { axis: 'x', from: 460, to: 500, at: 350 },
      ])
      expect(result.guides.filter((g) => g.axis === 'x')).toEqual([])
    })

    it('repeats a pair’s gap beyond the right-hand one', () => {
      const dragged = makePhoto('d', 425, 305, 100, 100)
      const result = computeSnap(dragged, [a, b], BOARD_W, BOARD_H, 425, 305)
      expect(result.x).toBe(420)
      expect(result.spacing.filter((h) => h.axis === 'x')).toEqual([
        { axis: 'x', from: 200, to: 260, at: 350 },
        { axis: 'x', from: 360, to: 420, at: 350 },
      ])
    })

    it('repeats a pair’s gap before the left-hand one', () => {
      const pair = [makePhoto('p', 400, 300), makePhoto('q', 560, 300)]
      const dragged = makePhoto('d', 245, 300, 100, 100)
      const result = computeSnap(dragged, pair, BOARD_W, BOARD_H, 245, 300)
      expect(result.x).toBe(240)
      expect(result.spacing[0]).toEqual({ axis: 'x', from: 340, to: 400, at: 350 })
    })

    it('works down a column too', () => {
      const top = makePhoto('t', 300, 100, 100, 100)
      const bottom = makePhoto('u', 300, 250, 100, 100)
      const dragged = makePhoto('d', 300, 396, 100, 100)
      const result = computeSnap(dragged, [top, bottom], BOARD_W, BOARD_H, 300, 396)
      expect(result.y).toBe(400)
      expect(result.spacing.filter((h) => h.axis === 'y')).toEqual([
        { axis: 'y', from: 200, to: 250, at: 350 },
        { axis: 'y', from: 350, to: 400, at: 350 },
      ])
    })

    it('ignores a pair that is not in the dragged element’s row', () => {
      const dragged = makePhoto('d', 425, 700, 100, 100)
      const result = computeSnap(dragged, [a, b], BOARD_W, BOARD_H, 425, 700)
      expect(result.x).toBe(425)
      expect(result.spacing).toEqual([])
    })

    it('only pairs adjacent neighbours, never across one in between', () => {
      const row = [makePhoto('p', 100, 300), makePhoto('q', 260, 300), makePhoto('r', 420, 300)]
      // Midway between p and r is exactly where q sits.
      const dragged = makePhoto('d', 258, 300, 100, 100)
      const result = computeSnap(dragged, row, BOARD_W, BOARD_H, 258, 300)
      expect(result.spacing).toEqual([])
      // Past r, the q–r gap repeats.
      const after = computeSnap(dragged, row, BOARD_W, BOARD_H, 583, 300)
      expect(after.x).toBe(580)
      expect(after.spacing[0]).toEqual({ axis: 'x', from: 360, to: 420, at: 350 })
    })

    it('does not centre an element too wide for the gap', () => {
      const dragged = makePhoto('d', 175, 305, 100, 100)
      const result = computeSnap(dragged, [a, b], BOARD_W, BOARD_H, 175, 305)
      expect(result.spacing).toEqual([])
    })

    it('is off when spacing is turned off', () => {
      const dragged = makePhoto('d', 425, 305, 100, 100)
      const result = computeSnap(dragged, [a, b], BOARD_W, BOARD_H, 425, 305, { spacing: false })
      expect(result.x).toBe(425)
      expect(result.spacing).toEqual([])
    })
  })
})
