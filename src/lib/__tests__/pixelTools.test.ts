import { describe, it, expect } from 'vitest'
import { enhancePixels } from '../../ai/autoEnhance'
import { removeBackgroundPixels } from '../../ai/bgRemoval'
import { stylePixels } from '../../ai/styleTransfer'
import { retouchPixels } from '../../ai/portraitRetouch'
import { faceRegionsIn } from '../../ai/faceDetection'
import type { Pixels } from '../../ai/pixels'
import { runPixelJob } from '../../workers/runPixelJob'

function image(
  width: number,
  height: number,
  at: (x: number, y: number) => [number, number, number],
): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data.set([...at(x, y), 255], i)
    }
  return { data, width, height }
}

const at = (px: Pixels, x: number, y: number) =>
  Array.from(px.data.slice((y * px.width + x) * 4, (y * px.width + x) * 4 + 4))

describe('enhancePixels', () => {
  it('stretches a dull image to the full range', () => {
    const px = image(4, 1, (x) => [100 + x * 10, 100 + x * 10, 100 + x * 10])
    enhancePixels(px, { autoContrast: true })
    expect(at(px, 0, 0)[0]).toBe(0)
    expect(at(px, 3, 0)[0]).toBeGreaterThan(240)
  })

  it('pulls a colour cast back to grey', () => {
    const px = image(2, 2, () => [200, 100, 100])
    enhancePixels(px, { autoWhiteBalance: true })
    const [r, g, b] = at(px, 0, 0)
    expect(r).toBe(g)
    expect(g).toBe(b)
  })

  it('changes nothing without options', () => {
    const px = image(3, 3, (x, y) => [x * 40, y * 40, 90])
    const before = px.data.slice()
    enhancePixels(px)
    expect(px.data).toEqual(before)
  })
})

describe('removeBackgroundPixels', () => {
  it('clears a plain backdrop and keeps the subject', () => {
    const px = image(60, 60, (x, y) =>
      Math.abs(x - 30) < 8 && Math.abs(y - 30) < 8 ? [200, 20, 20] : [250, 250, 250],
    )
    removeBackgroundPixels(px, { feather: 0 })
    expect(at(px, 0, 0)[3]).toBe(0)
    expect(at(px, 30, 30)[3]).toBe(255)
  })
})

describe('stylePixels', () => {
  it('turns a colour photo grey for a sketch', () => {
    const px = image(8, 8, (x, y) => [x * 30, y * 30, 120])
    stylePixels(px, 'sketch', 1)
    const [r, g, b] = at(px, 4, 4)
    expect(r).toBe(g)
    expect(g).toBe(b)
  })

  it('leaves the photo alone for none', () => {
    const px = image(4, 4, (x) => [x * 50, 10, 10])
    const before = px.data.slice()
    stylePixels(px, 'none', 1)
    expect(px.data).toEqual(before)
  })
})

describe('retouchPixels', () => {
  it('leaves a flat photo with no face unchanged', () => {
    const px = image(20, 20, () => [10, 60, 200])
    expect(faceRegionsIn(px)).toEqual([])
    const before = px.data.slice()
    retouchPixels(px, { skinSmooth: 1 })
    expect(px.data).toEqual(before)
  })
})

describe('runPixelJob', () => {
  it('fails loudly where the browser cannot decode off the page', async () => {
    await expect(runPixelJob(new Blob(['x']), null, [{ type: 'image/png' }])).rejects.toThrow()
  })
})
