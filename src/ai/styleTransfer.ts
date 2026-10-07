// Simplified style transfer using canvas convolution kernels.
// Oil painting (median approximation), sketch (edge detect + grayscale), pop art (posterize + color boost).

import type { Pixels } from './pixels'

export type StyleId = 'oil' | 'sketch' | 'popart' | 'none'

export interface StyleTransferSettings {
  styleId: StyleId
  intensity: number // 0..1
}

export const STYLE_OPTIONS: { id: StyleId; label: string; emoji: string }[] = [
  { id: 'none', label: 'Original', emoji: '🖼️' },
  { id: 'oil', label: 'Oil Painting', emoji: '🎨' },
  { id: 'sketch', label: 'Sketch', emoji: '✏️' },
  { id: 'popart', label: 'Pop Art', emoji: '🌈' },
]

export function stylePixels(imgData: Pixels, styleId: StyleId, intensity: number): void {
  const { data, width, height } = imgData
  switch (styleId) {
    case 'oil':
      applyOilPainting(data, width, height, intensity)
      break
    case 'sketch':
      applySketch(data, width, height, intensity)
      break
    case 'popart':
      applyPopArt(data, width, height, intensity)
      break
  }
}

/** Approximate oil painting via adaptive nearest-neighbor color quantization + small block averaging. */
function applyOilPainting(data: Uint8ClampedArray, width: number, height: number, intensity: number) {
  const radius = Math.max(2, Math.round(3 + intensity * 4))
  const levels = Math.max(4, Math.round(8 - intensity * 4))
  const output = new Uint8ClampedArray(data.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Gather local block histogram
      const freq = new Map<number, { r: number; g: number; b: number; count: number }>()
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy
          const nx = x + dx
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue
          const idx = (ny * width + nx) * 4
          const r = Math.floor(data[idx] / (256 / levels)) * (256 / levels)
          const g = Math.floor(data[idx + 1] / (256 / levels)) * (256 / levels)
          const b = Math.floor(data[idx + 2] / (256 / levels)) * (256 / levels)
          const key = (r << 16) | (g << 8) | b
          const existing = freq.get(key)
          if (existing) {
            existing.r += data[idx]
            existing.g += data[idx + 1]
            existing.b += data[idx + 2]
            existing.count++
          } else {
            freq.set(key, { r: data[idx], g: data[idx + 1], b: data[idx + 2], count: 1 })
          }
        }
      }

      let bestKey = 0
      let bestCount = -1
      for (const [key, val] of freq) {
        if (val.count > bestCount) {
          bestCount = val.count
          bestKey = key
        }
      }
      const best = freq.get(bestKey)!
      const idx = (y * width + x) * 4
      output[idx] = Math.round(best.r / best.count)
      output[idx + 1] = Math.round(best.g / best.count)
      output[idx + 2] = Math.round(best.b / best.count)
      output[idx + 3] = data[idx + 3]
    }
  }

  data.set(output)
}

/** Edge detection (Sobel-like) + grayscale for sketch effect. */
function applySketch(data: Uint8ClampedArray, width: number, height: number, intensity: number) {
  const gray = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114
  }

  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
  const output = new Uint8ClampedArray(data.length)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sx = 0, sy = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = gray[(y + ky) * width + (x + kx)]
          const kIdx = (ky + 1) * 3 + (kx + 1)
          sx += val * gx[kIdx]
          sy += val * gy[kIdx]
        }
      }
      const edge = Math.min(255, Math.sqrt(sx * sx + sy * sy))
      const idx = (y * width + x) * 4
      // Invert edges for sketch look on white background, then blend
      const sketchVal = Math.round(255 - edge)
      const blend = intensity
      output[idx] = data[idx] * (1 - blend) + sketchVal * blend
      output[idx + 1] = data[idx + 1] * (1 - blend) + sketchVal * blend
      output[idx + 2] = data[idx + 2] * (1 - blend) + sketchVal * blend
      output[idx + 3] = data[idx + 3]
    }
  }

  // Copy border pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        const idx = (y * width + x) * 4
        output[idx] = data[idx]
        output[idx + 1] = data[idx + 1]
        output[idx + 2] = data[idx + 2]
        output[idx + 3] = data[idx + 3]
      }
    }
  }

  data.set(output)
}

/** Posterize + color boost for pop art. */
function applyPopArt(data: Uint8ClampedArray, _width: number, _height: number, intensity: number) {
  const levels = Math.max(2, Math.round(4 + (1 - intensity) * 4))
  const step = 256 / levels
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(data[i] / step) * step + step / 2
    data[i + 1] = Math.floor(data[i + 1] / step) * step + step / 2
    data[i + 2] = Math.floor(data[i + 2] / step) * step + step / 2
    // Boost saturation by exaggerating channel differences
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
    data[i] = Math.min(255, Math.max(0, data[i] + (data[i] - avg) * intensity * 0.8))
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + (data[i + 1] - avg) * intensity * 0.8))
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + (data[i + 2] - avg) * intensity * 0.8))
  }
}
