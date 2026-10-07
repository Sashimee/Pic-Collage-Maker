import type { PhotoElement, PhotoStyling } from '../types'

export const MAX_BORDER = 40
export const MAX_SHADOW_BLUR = 60
export const MAX_SHADOW_OFFSET = 40
export const MAX_RADIUS = 200
export const SHADOW_OPACITY = 0.4
export const DEFAULT_BORDER_COLOR = '#ffffff'
export const DEFAULT_SHADOW_COLOR = '#000000'

export interface ResolvedStyling {
  radius: number
  border: { width: number; color: string } | null
  shadow: { blur: number; offset: number; color: string } | null
  /** The white card behind a polaroid, in the photo's own coordinates. */
  card: { x: number; y: number; width: number; height: number; radius: number } | null
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const color = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)

/**
 * Everything a renderer needs to draw a photo's styling, with the
 * shape-dependent rules applied once so the canvas and the SVG export agree.
 */
export function resolveStyling(
  el: Pick<PhotoElement, 'width' | 'height' | 'shape' | 'styling'>,
): ResolvedStyling {
  const s: PhotoStyling = el.styling ?? {}
  const rect = (el.shape ?? 'rect') === 'rect'
  const radius = rect ? Math.max(0, Math.min(num(s.radius), el.width / 2, el.height / 2)) : 0
  const borderWidth = Math.max(0, num(s.borderWidth))
  const blur = Math.max(0, num(s.shadowBlur))
  const offset = Math.max(0, num(s.shadowOffset))
  let card: ResolvedStyling['card'] = null
  if (rect && s.polaroid === true) {
    const m = Math.min(el.width, el.height)
    const side = m * 0.06
    const bottom = m * 0.24
    card = {
      x: -side,
      y: -side,
      width: el.width + 2 * side,
      height: el.height + side + bottom,
      radius: radius ? radius + side : 0,
    }
  }
  return {
    radius,
    border: borderWidth
      ? { width: borderWidth, color: color(s.borderColor, DEFAULT_BORDER_COLOR) }
      : null,
    shadow: blur || offset ? { blur, offset, color: color(s.shadowColor, DEFAULT_SHADOW_COLOR) } : null,
    card,
  }
}
