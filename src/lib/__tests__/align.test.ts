import { describe, it, expect } from 'vitest'
import { alignOffsets, unionBox, type Box } from '../align'

const board: Box = { x: 0, y: 0, width: 1000, height: 800 }
const boxes: Record<string, Box> = {
  a: { x: 100, y: 50, width: 100, height: 40 },
  b: { x: 400, y: 300, width: 200, height: 100 },
}
const moved = (offsets: Record<string, { dx: number; dy: number }>, src = boxes) =>
  Object.fromEntries(
    Object.entries(src).map(([id, b]) => [
      id,
      { ...b, x: b.x + offsets[id].dx, y: b.y + offsets[id].dy },
    ]),
  )

describe('unionBox', () => {
  it('spans every box', () => {
    expect(unionBox(Object.values(boxes))).toEqual({ x: 100, y: 50, width: 500, height: 350 })
  })
  it('is null for nothing', () => {
    expect(unionBox([])).toBeNull()
  })
})

describe('alignOffsets', () => {
  const sel = unionBox(Object.values(boxes))!

  it('left / right line up the edges and leave the other axis alone', () => {
    const l = moved(alignOffsets(boxes, 'left', sel))
    expect([l.a.x, l.b.x]).toEqual([100, 100])
    expect([l.a.y, l.b.y]).toEqual([50, 300])
    const r = moved(alignOffsets(boxes, 'right', sel))
    expect([r.a.x + r.a.width, r.b.x + r.b.width]).toEqual([600, 600])
  })

  it('top / bottom line up the edges', () => {
    const t = moved(alignOffsets(boxes, 'top', sel))
    expect([t.a.y, t.b.y]).toEqual([50, 50])
    expect([t.a.x, t.b.x]).toEqual([100, 400])
    const b = moved(alignOffsets(boxes, 'bottom', sel))
    expect([b.a.y + b.a.height, b.b.y + b.b.height]).toEqual([400, 400])
  })

  it('centres on the reference, here the board', () => {
    const c = moved(alignOffsets(boxes, 'centerX', board))
    expect(c.a.x + c.a.width / 2).toBe(500)
    expect(c.b.x + c.b.width / 2).toBe(500)
    const m = moved(alignOffsets(boxes, 'centerY', board))
    expect(m.a.y + m.a.height / 2).toBe(400)
    expect(m.b.y + m.b.height / 2).toBe(400)
  })

  it('a single box aligns to the board', () => {
    const one = { a: boxes.a }
    expect(alignOffsets(one, 'right', board)).toEqual({ a: { dx: 800, dy: 0 } })
    expect(alignOffsets(one, 'bottom', board)).toEqual({ a: { dx: 0, dy: 710 } })
  })

  it('nothing selected moves nothing', () => {
    expect(alignOffsets({}, 'left', board)).toEqual({})
    expect(alignOffsets({}, 'distributeX', board)).toEqual({})
  })
})

describe('distribute', () => {
  const row: Record<string, Box> = {
    c: { x: 900, y: 0, width: 100, height: 10 },
    a: { x: 0, y: 5, width: 100, height: 10 },
    b: { x: 150, y: 9, width: 50, height: 10 },
    d: { x: 300, y: 2, width: 150, height: 10 },
  }

  it('evens the gaps between neighbours and keeps the outermost in place', () => {
    const out = moved(alignOffsets(row, 'distributeX', board), row)
    // span 1000, boxes 400 wide → three gaps of 200
    expect(out.a.x).toBe(0)
    expect(out.b.x).toBe(300)
    expect(out.d.x).toBe(550)
    expect(out.c.x).toBe(900)
    expect(Object.values(out).map((b) => b.y)).toEqual([0, 5, 9, 2])
  })

  it('orders by centre, so a large box keeps its place in the sequence', () => {
    const col: Record<string, Box> = {
      top: { x: 0, y: 0, width: 10, height: 100 },
      tall: { x: 0, y: 50, width: 10, height: 400 },
      bottom: { x: 0, y: 500, width: 10, height: 100 },
    }
    const out = moved(alignOffsets(col, 'distributeY', board), col)
    expect(out.top.y).toBe(0)
    expect(out.tall.y).toBe(100)
    expect(out.bottom.y).toBe(500)
  })

  it('does nothing with fewer than three boxes', () => {
    expect(alignOffsets(boxes, 'distributeX', board)).toEqual({
      a: { dx: 0, dy: 0 },
      b: { dx: 0, dy: 0 },
    })
  })
})
