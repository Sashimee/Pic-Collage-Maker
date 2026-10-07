import { describe, it, expect } from 'vitest'
import { SHAPE_PACKS } from '../stickers/library'
import { en } from '../../i18n/translations'

/** Every absolute point the path visits, skipping relative arc arguments. */
function absolutePoints(d: string): [number, number][] {
  const points: [number, number][] = []
  for (const [, cmd, args] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    if (!'MLQC'.includes(cmd)) continue
    const nums = args
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]])
  }
  return points
}

describe('shape library', () => {
  const shapes = SHAPE_PACKS.flatMap((p) => p.shapes)

  it('gives every pack and shape a translated name and every shape a unique id', () => {
    for (const pack of SHAPE_PACKS) expect(en[pack.labelKey]).toBeTruthy()
    for (const shape of shapes) expect(en[`library.${shape.id}`], shape.id).toBeTruthy()
    expect(new Set(shapes.map((s) => s.id)).size).toBe(shapes.length)
  })

  it('draws every shape as a closed path inside its 120 × 120 box', () => {
    for (const shape of shapes) {
      expect(shape.d, shape.id).toMatch(/^M/)
      expect(shape.d.trim(), shape.id).toMatch(/Z$/)
      const points = absolutePoints(shape.d)
      expect(points.length, shape.id).toBeGreaterThan(2)
      for (const [x, y] of points) {
        expect(Number.isFinite(x) && Number.isFinite(y), shape.id).toBe(true)
        expect(Math.min(x, y), shape.id).toBeGreaterThanOrEqual(0)
        expect(Math.max(x, y), shape.id).toBeLessThanOrEqual(120)
      }
    }
  })
})
