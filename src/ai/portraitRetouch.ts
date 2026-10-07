/**
 * Client-side portrait retouch — no ML models required.
 * Uses brightness/contrast and skin tone detection for quick enhancement.
 */

import type { Pixels } from './pixels'
import { faceRegionsIn } from './faceDetection'

export interface RetouchSettings {
  skinSmooth: number // 0..1
  teethWhite: number // 0..1
  eyeBrighten: number // 0..1
}

export const DEFAULT_RETOUCH_SETTINGS: RetouchSettings = {
  skinSmooth: 0.35,
  teethWhite: 0.4,
  eyeBrighten: 0.35,
}

export function retouchPixels(imgData: Pixels, opts: Partial<RetouchSettings> = {}): void {
  const { skinSmooth = 0.35, teethWhite = 0.4, eyeBrighten = 0.35 } = opts
  const { data: d, width, height } = imgData
  const faces = faceRegionsIn(imgData)

  // If no faces detected, apply global subtle smoothing
  if (!faces.length) {
    applyGlobalSmooth(d, width, height, skinSmooth * 0.3)
    return
  }

  const face = faces[0]

  // Apply skin smoothing in face region
  applyFaceSmooth(d, width, height, face, skinSmooth)

  // Brighten eye region (upper part of face box)
  applyEyeBrighten(d, width, height, face, eyeBrighten)

  // Teeth whitening (mouth region, lower center of face)
  applyTeethWhite(d, width, height, face, teethWhite)
}

function applyGlobalSmooth(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  strength: number,
): void {
  if (strength <= 0.01) return
  const radius = 1
  const orig = new Uint8ClampedArray(d)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, count = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const i = (ny * w + nx) * 4
            r += orig[i]
            g += orig[i + 1]
            b += orig[i + 2]
            count++
          }
        }
      }
      const i = (y * w + x) * 4
      const blend = strength
      d[i] = Math.round(d[i] * (1 - blend) + (r / count) * blend)
      d[i + 1] = Math.round(d[i + 1] * (1 - blend) + (g / count) * blend)
      d[i + 2] = Math.round(d[i + 2] * (1 - blend) + (b / count) * blend)
    }
  }
}

function applyFaceSmooth(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  face: { x: number; y: number; width: number; height: number },
  strength: number,
): void {
  if (strength <= 0.01) return
  const fx = Math.max(0, Math.floor(face.x))
  const fy = Math.max(0, Math.floor(face.y))
  const fw = Math.min(w - fx, Math.ceil(face.width))
  const fh = Math.min(h - fy, Math.ceil(face.height))
  const radius = 2
  const orig = new Uint8ClampedArray(d)

  for (let y = fy; y < fy + fh; y++) {
    for (let x = fx; x < fx + fw; x++) {
      const i = (y * w + x) * 4
      // Only smooth skin-toned pixels
      const r = orig[i], g = orig[i + 1], b = orig[i + 2]
      const isSkin = r > 80 && r > g && g > b * 0.8 && (r + g + b) / 3 > 60
      if (!isSkin) continue

      let sr = 0, sg = 0, sb = 0, count = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const ni = (ny * w + nx) * 4
            sr += orig[ni]
            sg += orig[ni + 1]
            sb += orig[ni + 2]
            count++
          }
        }
      }
      const blend = strength * 0.5
      d[i] = Math.round(d[i] * (1 - blend) + (sr / count) * blend)
      d[i + 1] = Math.round(d[i + 1] * (1 - blend) + (sg / count) * blend)
      d[i + 2] = Math.round(d[i + 2] * (1 - blend) + (sb / count) * blend)
    }
  }
}

function applyEyeBrighten(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  face: { x: number; y: number; width: number; height: number },
  strength: number,
): void {
  if (strength <= 0.01) return
  const fx = Math.max(0, Math.floor(face.x))
  const fy = Math.max(0, Math.floor(face.y))
  const fw = Math.min(w - fx, Math.ceil(face.width))
  const fh = Math.min(h - fy, Math.ceil(face.height))

  // Eye region: upper 40% of face, middle 60% width
  const ey = fy + Math.floor(fh * 0.15)
  const eey = fy + Math.floor(fh * 0.45)
  const ex = fx + Math.floor(fw * 0.2)
  const eex = fx + Math.floor(fw * 0.8)

  for (let y = ey; y < eey; y++) {
    for (let x = ex; x < eex; x++) {
      const i = (y * w + x) * 4
      const blend = strength * 0.3
      d[i] = Math.min(255, Math.round(d[i] + 20 * blend))
      d[i + 1] = Math.min(255, Math.round(d[i + 1] + 20 * blend))
      d[i + 2] = Math.min(255, Math.round(d[i + 2] + 20 * blend))
    }
  }
}

function applyTeethWhite(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  face: { x: number; y: number; width: number; height: number },
  strength: number,
): void {
  if (strength <= 0.01) return
  const fx = Math.max(0, Math.floor(face.x))
  const fy = Math.max(0, Math.floor(face.y))
  const fw = Math.min(w - fx, Math.ceil(face.width))
  const fh = Math.min(h - fy, Math.ceil(face.height))

  // Mouth region: lower 30% of face, middle 50% width
  const my = fy + Math.floor(fh * 0.55)
  const mye = fy + Math.floor(fh * 0.85)
  const mx = fx + Math.floor(fw * 0.25)
  const mxe = fx + Math.floor(fw * 0.75)

  for (let y = my; y < mye; y++) {
    for (let x = mx; x < mxe; x++) {
      const i = (y * w + x) * 4
      const r = d[i], g = d[i + 1], b = d[i + 2]
      // Only whiten already-bright pixels (likely teeth)
      if ((r + g + b) / 3 > 140) {
        const blend = strength * 0.2
        d[i] = Math.min(255, Math.round(d[i] + 15 * blend))
        d[i + 1] = Math.min(255, Math.round(d[i + 1] + 15 * blend))
        d[i + 2] = Math.min(255, Math.round(d[i + 2] + 15 * blend))
      }
    }
  }
}
