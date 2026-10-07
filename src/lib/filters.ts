import Konva from 'konva'
import type { Filter } from 'konva/lib/Node'
import { create } from 'zustand'
import type { FilterOperation, FilterPreset, PhotoElement, PhotoFilters } from '../types'

export interface FilterConfig {
  filters: Filter[]
  brightness: number
  contrast: number
  hue: number
  saturation: number
  luminance: number
  blurRadius: number
}

export interface FilterPresetDef {
  id: FilterPreset
  label: string
}

export const FILTER_PRESETS: FilterPresetDef[] = [
  { id: 'none', label: 'Original' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'punch', label: 'Punch' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'fade', label: 'Fade' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'noir', label: 'Noir' },
  { id: 'grayscale', label: 'B&W' },
]

/** Apply a non-destructive filter stack to compute Konva filter config. */
export function computeFilterConfigFromStack(
  stack: FilterOperation[] = [],
): FilterConfig {
  let brightness = 0
  let contrast = 0
  let saturation = 0
  let hue = 0
  const luminance = 0
  let blurRadius = 0
  // Per-channel RGB offsets accumulated from temperature/tint (see channelShiftFilter).
  let rShift = 0
  let gShift = 0
  let bShift = 0
  const filters: Filter[] = []

  for (const op of stack) {
    switch (op.type) {
      case 'brightness':
        brightness += op.value
        break
      case 'contrast':
        contrast += op.value
        break
      case 'saturation':
        saturation += op.value
        break
      case 'hueShift':
        hue += op.value
        break
      case 'exposure':
        brightness += op.value * 0.5
        break
      case 'shadows':
        brightness += op.value * 0.3
        break
      case 'highlights':
        brightness -= op.value * 0.2
        break
      case 'temperature':
        // Warm (+) pushes red up and blue down; cool (−) does the reverse.
        rShift += op.value * 0.6
        bShift -= op.value * 0.6
        break
      case 'tint':
        // Magenta (+) lifts red/blue and drops green; green (−) does the reverse.
        rShift += op.value * 0.3
        bShift += op.value * 0.3
        gShift -= op.value * 0.5
        break
      case 'blur':
        blurRadius = Math.max(blurRadius, op.radius)
        break
      case 'vignette':
        // Vignette handled at render layer, not Konva
        break
      case 'preset':
        switch (op.id) {
          case 'grayscale':
            filters.push(Konva.Filters.Grayscale)
            break
          case 'noir':
            filters.push(Konva.Filters.Grayscale)
            contrast += 40
            break
          case 'sepia':
            filters.push(Konva.Filters.Sepia)
            break
          case 'vivid':
            contrast += 18
            saturation += 1.6
            break
          case 'punch':
            contrast += 35
            saturation += 2.4
            break
          case 'warm':
            hue += 18
            saturation += 0.4
            break
          case 'cool':
            hue += -18
            saturation += 0.3
            break
          case 'fade':
            contrast -= 22
            saturation -= 0.7
            brightness += 0.08
            break
          default:
            break
        }
        break
      default:
        break
    }
  }

  // Temperature/tint run first as a per-channel offset, before HSL/tone.
  if (rShift !== 0 || gShift !== 0 || bShift !== 0) {
    filters.push(channelShiftFilter(rShift, gShift, bShift))
  }
  // Always push HSL, Brighten, Contrast
  filters.push(Konva.Filters.HSL, Konva.Filters.Brighten, Konva.Filters.Contrast)
  if (blurRadius > 0) filters.push(Konva.Filters.Blur)

  return {
    filters,
    brightness: clamp(brightness, -1, 1),
    contrast: clamp(contrast, -100, 100),
    hue: clamp(hue, -180, 180),
    saturation: clamp(saturation, -2, 10),
    luminance,
    blurRadius: clamp(blurRadius, 0, 40),
  }
}

function v1Stack(f: PhotoFilters): FilterOperation[] {
  const stack: FilterOperation[] = [
    { type: 'brightness', value: f.brightness },
    { type: 'contrast', value: f.contrast },
    { type: 'saturation', value: f.saturation },
    { type: 'preset', id: f.preset },
  ]
  if (f.blur > 0) stack.push({ type: 'blur', radius: f.blur })
  if (f.vignette > 0) stack.push({ type: 'vignette', strength: f.vignette })
  return stack
}

/** Backwards-compatible: compute from v1 PhotoFilters. */
export function computeFilterConfig(f: PhotoFilters): FilterConfig {
  return computeFilterConfigFromStack(v1Stack(f))
}

/** A photo's filter stack: the v2 stack, or one derived from its v1 filters. */
export function photoStack(
  filterStack: PhotoElement['filterStack'],
  filters: PhotoFilters,
): FilterOperation[] {
  return filterStack ?? v1Stack(filters)
}

/** The photo whose filters are hidden while "hold to compare" is pressed. */
export const useFilterCompare = create<{ id: string | null }>(() => ({ id: null }))

const isAdvanced = (op: FilterOperation) =>
  op.type === 'levels' || op.type === 'curves' || op.type === 'hsl' || op.type === 'lut'

const pending = new Set<Promise<void>>()
const failed = new Set<Konva.Image>()

/**
 * Resolves once every photo's levels/curves/HSL/LUT filters are on its node;
 * throws while any photo is drawn without them. Call it a frame after the
 * photos' images are set, so their effects have queued the work.
 */
export async function filtersSettled(): Promise<void> {
  while (pending.size) await Promise.allSettled(pending)
  if (failed.size)
    throw new Error(
      `${failed.size} photo(s) are missing their adjustments because the filter code failed to load. Reload the app and try again.`,
    )
}

const isIdentity = (cfg: FilterConfig) =>
  cfg.filters.length === 3 &&
  cfg.brightness === 0 &&
  cfg.contrast === 0 &&
  cfg.hue === 0 &&
  cfg.saturation === 0 &&
  cfg.luminance === 0 &&
  cfg.blurRadius === 0

const sourceWidth = (image: CanvasImageSource | undefined) =>
  image instanceof HTMLImageElement
    ? image.naturalWidth
    : image instanceof HTMLCanvasElement
      ? image.width
      : 0

/**
 * The cache's pixel ratio: what was asked for, but never more pixels than the source has —
 * those would only be interpolated, and at the device pixel ratio a full-board photo on an
 * iPhone costs ~50 MB.
 */
export function cachePixelRatio(
  sourcePx: number,
  nodeWidth: number,
  nodeHeight: number,
  requested: number,
) {
  if (!(sourcePx > 0 && nodeWidth > 0 && nodeHeight > 0)) return requested
  // A cache under one pixel on either side is a zero-sized canvas, and drawing it throws.
  const floor = 1 / Math.min(nodeWidth, nodeHeight)
  return Math.min(requested, Math.max(sourcePx / nodeWidth, floor))
}

/**
 * Caches the node and applies a filter stack to it. Levels, curves, HSL and
 * LUTs live in a lazy chunk, so they join the node a moment later — export
 * waits for them through `filtersSettled()`. Returns the effect cleanup.
 */
export function applyPhotoFilters(
  node: Konva.Image,
  stack: FilterOperation[],
  cache?: Parameters<Konva.Image['cache']>[0],
): () => void {
  const cfg = computeFilterConfigFromStack(stack)
  // A cache is a second full bitmap per photo; iOS kills the tab once those add up.
  if (isIdentity(cfg) && !stack.some(isAdvanced)) {
    node.clearCache()
    node.filters([])
    node.getLayer()?.batchDraw()
    return () => {}
  }
  let live = true
  const requested = cache?.pixelRatio ?? Konva.pixelRatio
  node.cache({
    ...cache,
    // Blur's radius is counted in cache pixels, and the export swaps in a larger source; a
    // ratio that followed the source would blur the export less than the screen.
    pixelRatio:
      cfg.blurRadius > 0
        ? requested
        : cachePixelRatio(
            node.cropWidth() || sourceWidth(node.image()),
            node.width(),
            node.height(),
            requested,
          ),
  })
  node.filters(cfg.filters)
  node.brightness(cfg.brightness)
  node.contrast(cfg.contrast)
  node.hue(cfg.hue)
  node.saturation(cfg.saturation)
  node.luminance(cfg.luminance)
  node.blurRadius(cfg.blurRadius)
  node.getLayer()?.batchDraw()

  if (stack.some(isAdvanced)) {
    const loading: Promise<void> = import('./adjustments')
      .then(({ advancedFilters }) => {
        if (!live) return
        const extra = advancedFilters(stack)
        const blur = cfg.filters.indexOf(Konva.Filters.Blur)
        const at = blur < 0 ? cfg.filters.length : blur
        node.filters([...cfg.filters.slice(0, at), ...extra, ...cfg.filters.slice(at)])
        node.getLayer()?.batchDraw()
      })
      .catch((err: unknown) => {
        if (!live) return
        failed.add(node)
        console.error('Photo adjustments (levels/curves/HSL/LUT) failed to load', err)
      })
      .finally(() => pending.delete(loading))
    pending.add(loading)
  }

  return () => {
    live = false
    failed.delete(node)
    node.clearCache()
    node.filters([])
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// Konva custom filter that offsets each RGB channel by a fixed amount. The
// offsets are captured in the closure, so a fresh filter is produced whenever
// the stack changes (PhotoNode re-applies node.filters() on every filter edit).
function channelShiftFilter(r: number, g: number, b: number): Filter {
  return function (imageData: ImageData) {
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(d[i] + r, 0, 255)
      d[i + 1] = clamp(d[i + 1] + g, 0, 255)
      d[i + 2] = clamp(d[i + 2] + b, 0, 255)
    }
  }
}
