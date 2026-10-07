import type { CropRect } from '../types'

export const ASPECT_PRESETS = [
  { id: 'free', label: null, ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
] as const

export type AspectId = (typeof ASPECT_PRESETS)[number]['id']

export const MAX_STRAIGHTEN = 45

/** The largest box of the given width/height ratio centred inside `w × h`. */
export function aspectBox(ratio: number, w: number, h: number): CropRect {
  const width = Math.min(w, h * ratio)
  const height = width / ratio
  return { x: (w - width) / 2, y: (h - height) / 2, width, height }
}

/**
 * How much a `w × h` image rotated by `degrees` about its centre has to grow
 * so it still covers its own unrotated frame — no empty corners.
 */
export function straightenScale(degrees: number, w: number, h: number): number {
  if (!degrees || !w || !h) return 1
  const a = (Math.abs(degrees) * Math.PI) / 180
  return Math.cos(a) + Math.max(w / h, h / w) * Math.sin(a)
}

/**
 * `crop` is stored in pixels of `el.src`, the preview the crop sheet edits.
 * Export draws the larger original, so the rectangle has to be scaled by the
 * ratio of the two widths or it selects a corner of the original instead.
 */
export function scaleCrop(crop: CropRect, k: number): CropRect {
  if (k === 1) return crop
  return { x: crop.x * k, y: crop.y * k, width: crop.width * k, height: crop.height * k }
}

export function cropBasisScale(
  drawn: HTMLImageElement | undefined,
  basis: HTMLImageElement | undefined,
): number | null {
  if (!drawn || !basis || !basis.naturalWidth) return null
  return drawn.naturalWidth / basis.naturalWidth
}
