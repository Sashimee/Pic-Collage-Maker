import { describe, it, expect } from 'vitest'
import { aspectBox, cropBasisScale, scaleCrop, straightenScale } from '../photoCrop'

const img = (naturalWidth: number) => ({ naturalWidth }) as HTMLImageElement

describe('aspectBox', () => {
  it('fills the width when the ratio is taller than the frame', () => {
    expect(aspectBox(1, 400, 300)).toEqual({ x: 50, y: 0, width: 300, height: 300 })
  })

  it('fills the height when the ratio is wider than the frame', () => {
    const b = aspectBox(16 / 9, 300, 400)
    expect(b.width).toBe(300)
    expect(b.height).toBeCloseTo(168.75)
    expect(b.y).toBeCloseTo((400 - 168.75) / 2)
    expect(b.x).toBe(0)
  })

  it('covers the whole frame when the ratio matches it', () => {
    expect(aspectBox(4 / 5, 400, 500)).toEqual({ x: 0, y: 0, width: 400, height: 500 })
  })
})

describe('straightenScale', () => {
  it('is 1 at no tilt, and for a degenerate frame', () => {
    expect(straightenScale(0, 400, 300)).toBe(1)
    expect(straightenScale(10, 0, 300)).toBe(1)
  })

  it('is symmetric in the tilt direction', () => {
    expect(straightenScale(-12, 400, 300)).toBeCloseTo(straightenScale(12, 400, 300))
  })

  it('grows enough that the rotated image still covers every frame corner', () => {
    const w = 400
    const h = 300
    for (const deg of [1, 7.5, 20, 45]) {
      const s = straightenScale(deg, w, h)
      const a = (deg * Math.PI) / 180
      for (const [cx, cy] of [
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ]) {
        const ix = cx * Math.cos(a) + cy * Math.sin(a)
        const iy = -cx * Math.sin(a) + cy * Math.cos(a)
        expect(Math.abs(ix)).toBeLessThanOrEqual((s * w) / 2 + 1e-9)
        expect(Math.abs(iy)).toBeLessThanOrEqual((s * h) / 2 + 1e-9)
      }
    }
  })
})

describe('scaleCrop', () => {
  it('returns the same rect when nothing changes', () => {
    const crop = { x: 1, y: 2, width: 3, height: 4 }
    expect(scaleCrop(crop, 1)).toBe(crop)
  })

  it('maps a preview-pixel crop onto a larger original', () => {
    expect(scaleCrop({ x: 10, y: 20, width: 100, height: 50 }, 4)).toEqual({
      x: 40,
      y: 80,
      width: 400,
      height: 200,
    })
  })
})

describe('cropBasisScale', () => {
  it('is null until both images have decoded', () => {
    expect(cropBasisScale(undefined, img(1080))).toBeNull()
    expect(cropBasisScale(img(4320), undefined)).toBeNull()
    expect(cropBasisScale(img(4320), img(0))).toBeNull()
  })

  it('is the width ratio of the drawn image to the one the crop was made on', () => {
    expect(cropBasisScale(img(4320), img(1080))).toBe(4)
    expect(cropBasisScale(img(1080), img(1080))).toBe(1)
  })
})
