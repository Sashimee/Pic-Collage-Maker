import { describe, it, expect } from 'vitest'
import { snapAngle, twoFingerPlacement, type FingerPair, type Placement } from '../twoFinger'

const start: Placement = { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1 }
const pair = (ax: number, ay: number, bx: number, by: number): FingerPair => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
})
const horizontal = pair(0, 0, 100, 0)

/** Fingers centred on (cx, cy), `len` apart, at `deg` degrees. */
const fingersAt = (cx: number, cy: number, len: number, deg: number): FingerPair => {
  const r = (deg * Math.PI) / 180
  const hx = (Math.cos(r) * len) / 2
  const hy = (Math.sin(r) * len) / 2
  return pair(cx - hx, cy - hy, cx + hx, cy + hy)
}

describe('snapAngle', () => {
  it('snaps within 4° of a 15° step, in either direction', () => {
    expect(snapAngle(29)).toBe(30)
    expect(snapAngle(34)).toBe(30)
    expect(snapAngle(-46)).toBe(-45)
    expect(snapAngle(0.5)).toBe(0)
  })

  it('leaves angles between steps free', () => {
    expect(snapAngle(37)).toBeNull()
    expect(snapAngle(-52)).toBeNull()
  })

  it('treats exactly 4° off as snapped and just past it as free', () => {
    expect(snapAngle(49)).toBe(45)
    expect(snapAngle(49.01)).toBeNull()
  })
})

describe('twoFingerPlacement', () => {
  it('is the identity when the fingers have not moved', () => {
    const p = twoFingerPlacement(start, horizontal, horizontal)
    expect(p).toMatchObject(start)
  })

  it('translates with the midpoint', () => {
    const p = twoFingerPlacement(start, horizontal, pair(20, 30, 120, 30))
    expect(p.x).toBeCloseTo(120)
    expect(p.y).toBeCloseTo(80)
    expect(p.rotation).toBe(0)
    expect(p.scaleX).toBeCloseTo(1)
  })

  it('scales with the spread about the midpoint', () => {
    const p = twoFingerPlacement(start, fingersAt(50, 0, 100, 0), fingersAt(50, 0, 200, 0))
    expect(p.scaleX).toBeCloseTo(2)
    expect(p.scaleY).toBeCloseTo(2)
    expect(p.x).toBeCloseTo(150)
    expect(p.y).toBeCloseTo(100)
  })

  it('rotates the element about the midpoint of the fingers', () => {
    const p = twoFingerPlacement(start, fingersAt(0, 0, 100, 0), fingersAt(0, 0, 100, 37))
    expect(p.rotation).toBeCloseTo(37)
    const r = (37 * Math.PI) / 180
    expect(p.x).toBeCloseTo(100 * Math.cos(r) - 50 * Math.sin(r))
    expect(p.y).toBeCloseTo(100 * Math.sin(r) + 50 * Math.cos(r))
  })

  it('snaps to 15° steps and keeps the position consistent with the snapped angle', () => {
    const p = twoFingerPlacement(start, fingersAt(0, 0, 100, 0), fingersAt(0, 0, 100, 43))
    expect(p.snapped).toBe(45)
    expect(p.rotation).toBe(45)
    const r = Math.PI / 4
    expect(p.x).toBeCloseTo(100 * Math.cos(r) - 50 * Math.sin(r))
    expect(p.y).toBeCloseTo(100 * Math.sin(r) + 50 * Math.cos(r))
  })

  it('snaps relative to the absolute angle, not the gesture delta', () => {
    const tilted = { ...start, rotation: 10 }
    const p = twoFingerPlacement(tilted, fingersAt(0, 0, 100, 0), fingersAt(0, 0, 100, 18))
    expect(p.rotation).toBe(30)
    expect(p.snapped).toBe(30)
  })

  it('reports no snap while between steps', () => {
    const p = twoFingerPlacement(start, fingersAt(0, 0, 100, 0), fingersAt(0, 0, 100, 22))
    expect(p.snapped).toBeNull()
    expect(p.rotation).toBeCloseTo(22)
  })

  it('handles the angle wrapping past 180°', () => {
    const p = twoFingerPlacement(start, fingersAt(0, 0, 100, 170), fingersAt(0, 0, 100, -170))
    expect(p.rotation).toBeCloseTo(20)
    const back = twoFingerPlacement(start, fingersAt(0, 0, 100, -170), fingersAt(0, 0, 100, 170))
    expect(back.rotation).toBeCloseTo(-20)
  })

  it('keeps flipped elements flipped while scaling', () => {
    const flipped = { ...start, scaleX: -1 }
    const p = twoFingerPlacement(flipped, fingersAt(0, 0, 100, 0), fingersAt(0, 0, 150, 0))
    expect(p.scaleX).toBeCloseTo(-1.5)
    expect(p.scaleY).toBeCloseTo(1.5)
  })

  it('clamps the scale so an element cannot vanish or explode', () => {
    const tiny = twoFingerPlacement(start, fingersAt(0, 0, 1000, 0), fingersAt(0, 0, 1, 0))
    expect(tiny.scaleX).toBeCloseTo(0.05)
    const huge = twoFingerPlacement(start, fingersAt(0, 0, 1, 0), fingersAt(0, 0, 1000, 0))
    expect(huge.scaleX).toBeCloseTo(20)
  })

  it('does not divide by zero when both fingers start on the same point', () => {
    const p = twoFingerPlacement(start, pair(5, 5, 5, 5), pair(0, 0, 100, 0))
    expect(Number.isFinite(p.x)).toBe(true)
    expect(p.scaleX).toBe(1)
  })
})
