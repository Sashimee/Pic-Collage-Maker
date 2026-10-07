/**
 * Client-side background removal — no model download required.
 * Uses color sampling + edge flood-fill to detect and remove backgrounds.
 * Works best on photos with distinct background colors (white, gray, solid colors).
 */

import type { Pixels } from './pixels'

export interface RemovalOptions {
  /** How similar a pixel must be to the background to be removed (0–1). Default 0.15. */
  threshold?: number
  /** Edge feather radius in pixels. Default 2. */
  feather?: number
}

function sampleBackgroundColor(imgData: Pixels): [number, number, number] {
  const d = imgData.data
  const w = imgData.width
  const h = imgData.height
  let r = 0, g = 0, b = 0, count = 0

  // Sample from a 20px border around edges
  const border = 20
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4
    r += d[i]
    g += d[i + 1]
    b += d[i + 2]
    count++
  }

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < Math.min(border, h); y++) sample(x, y)
    for (let y = Math.max(h - border, 0); y < h; y++) sample(x, y)
  }
  for (let y = border; y < h - border; y++) {
    for (let x = 0; x < Math.min(border, w); x++) sample(x, y)
    for (let x = Math.max(w - border, 0); x < w; x++) sample(x, y)
  }

  return [r / count, g / count, b / count]
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db) / 441.67 // normalize to ~0-1
}

function floodFillMask(
  imgData: Pixels,
  bgColor: [number, number, number],
  threshold: number,
): Uint8Array {
  const w = imgData.width
  const h = imgData.height
  const d = imgData.data
  const mask = new Uint8Array(w * h)
  const stack: [number, number][] = []

  // Push all edge pixels
  for (let x = 0; x < w; x++) {
    stack.push([x, 0])
    stack.push([x, h - 1])
  }
  for (let y = 1; y < h - 1; y++) {
    stack.push([0, y])
    stack.push([w - 1, y])
  }

  const visited = new Uint8Array(w * h)

  while (stack.length) {
    const [x, y] = stack.pop()!
    const idx = y * w + x
    if (visited[idx]) continue
    visited[idx] = 1

    const i = idx * 4
    const pix: [number, number, number] = [d[i], d[i + 1], d[i + 2]]
    const dist = colorDistance(pix, bgColor)

    if (dist < threshold) {
      mask[idx] = 255 // mark as background
      if (x > 0 && !visited[idx - 1]) stack.push([x - 1, y])
      if (x < w - 1 && !visited[idx + 1]) stack.push([x + 1, y])
      if (y > 0 && !visited[idx - w]) stack.push([x, y - 1])
      if (y < h - 1 && !visited[idx + w]) stack.push([x, y + 1])
    }
  }

  return mask
}

function featherEdges(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  if (radius <= 0) return mask
  const out = new Uint8Array(mask)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (mask[idx] < 255) {
        let sum = 0, count = 0
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx, ny = y + dy
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nidx = ny * w + nx
              sum += mask[nidx]
              count++
            }
          }
        }
        out[idx] = Math.round(sum / count)
      }
    }
  }
  return out
}

export function removeBackgroundPixels(imgData: Pixels, opts: RemovalOptions = {}): void {
  const { threshold = 0.15, feather = 2 } = opts
  const { width: w, height: h } = imgData

  const bgColor = sampleBackgroundColor(imgData)
  let mask = floodFillMask(imgData, bgColor, threshold)
  mask = featherEdges(mask, w, h, feather)

  // Invert mask (255 = transparent, 0 = opaque)
  const d = imgData.data
  for (let i = 0; i < w * h; i++) {
    const alpha = 255 - mask[i]
    d[i * 4 + 3] = alpha
  }
}
