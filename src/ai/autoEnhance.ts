// Auto-enhance: client-side photo improvement using Canvas pixel manipulation.
// No ML required — fast, deterministic, works offline.

import type { Pixels } from './pixels'

export interface EnhanceOptions {
  autoContrast?: boolean
  autoWhiteBalance?: boolean
  sharpen?: boolean
  denoise?: boolean
}

export function enhancePixels(imgData: Pixels, opts: EnhanceOptions = {}): void {
  const data = imgData.data

  if (opts.autoContrast) {
    // Compute histogram
    let minR = 255, minG = 255, minB = 255
    let maxR = 0, maxG = 0, maxB = 0

    for (let i = 0; i < data.length; i += 4) {
      minR = Math.min(minR, data[i])
      minG = Math.min(minG, data[i + 1])
      minB = Math.min(minB, data[i + 2])
      maxR = Math.max(maxR, data[i])
      maxG = Math.max(maxG, data[i + 1])
      maxB = Math.max(maxB, data[i + 2])
    }

    const scaleR = 255 / (maxR - minR + 1)
    const scaleG = 255 / (maxG - minG + 1)
    const scaleB = 255 / (maxB - minB + 1)

    for (let i = 0; i < data.length; i += 4) {
      data[i] = (data[i] - minR) * scaleR
      data[i + 1] = (data[i + 1] - minG) * scaleG
      data[i + 2] = (data[i + 2] - minB) * scaleB
    }
  }

  if (opts.autoWhiteBalance) {
    // Gray-world assumption
    let sumR = 0, sumG = 0, sumB = 0
    const pixelCount = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
      sumR += data[i]
      sumG += data[i + 1]
      sumB += data[i + 2]
    }

    const avgR = sumR / pixelCount
    const avgG = sumG / pixelCount
    const avgB = sumB / pixelCount
    const avgGray = (avgR + avgG + avgB) / 3

    const gainR = avgGray / avgR
    const gainG = avgGray / avgG
    const gainB = avgGray / avgB

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * gainR)
      data[i + 1] = Math.min(255, data[i + 1] * gainG)
      data[i + 2] = Math.min(255, data[i + 2] * gainB)
    }
  }

  if (opts.sharpen) {
    applyConvolution(data, imgData.width, imgData.height, SHARPEN_KERNEL)
  }

  if (opts.denoise) {
    applyConvolution(data, imgData.width, imgData.height, GAUSSIAN_KERNEL)
  }
}

const SHARPEN_KERNEL = [
  0, -1, 0,
  -1, 5, -1,
  0, -1, 0,
]

const GAUSSIAN_KERNEL = [
  1, 2, 1,
  2, 4, 2,
  1, 2, 1,
]

function applyConvolution(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  kernel: number[],
): void {
  const output = new Uint8ClampedArray(data.length)
  const kSum = kernel.reduce((a, b) => a + b, 0) || 1

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4
          const k = kernel[(ky + 1) * 3 + (kx + 1)]
          r += data[idx] * k
          g += data[idx + 1] * k
          b += data[idx + 2] * k
        }
      }
      const idx = (y * width + x) * 4
      output[idx] = Math.min(255, Math.max(0, r / kSum))
      output[idx + 1] = Math.min(255, Math.max(0, g / kSum))
      output[idx + 2] = Math.min(255, Math.max(0, b / kSum))
      output[idx + 3] = data[idx + 3]
    }
  }

  // Copy back interior pixels
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      data[idx] = output[idx]
      data[idx + 1] = output[idx + 1]
      data[idx + 2] = output[idx + 2]
    }
  }
}
