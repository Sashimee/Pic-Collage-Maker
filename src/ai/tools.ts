import { runPixelTool } from '../workers/runPixelJob'
import type { EnhanceOptions } from './autoEnhance'
import type { RemovalOptions } from './bgRemoval'
import type { RetouchSettings } from './portraitRetouch'
import type { StyleId } from './styleTransfer'

// The pixel math lives in the tool modules and runs in the pixel worker; these are the
// page-side entry points. They stay out of those modules so the worker bundle never
// pulls in the code that spawns it.

export const autoEnhance = (src: string, opts: EnhanceOptions = {}) =>
  runPixelTool(src, { op: 'enhance', opts }, { type: 'image/jpeg', quality: 0.92 })

export const removeBackground = (src: string, opts: RemovalOptions = {}) =>
  runPixelTool(src, { op: 'removeBg', opts }, { type: 'image/png' })

export const portraitRetouch = (src: string, opts: Partial<RetouchSettings> = {}) =>
  runPixelTool(src, { op: 'retouch', opts }, { type: 'image/png' })

export async function applyStyleTransfer(src: string, styleId: StyleId, intensity = 0.8) {
  if (styleId === 'none') return src
  return runPixelTool(
    src,
    { op: 'style', styleId, intensity },
    { type: 'image/jpeg', quality: 0.95 },
  )
}
