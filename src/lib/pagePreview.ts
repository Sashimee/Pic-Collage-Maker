import type { Background, PhotoElement } from '../types'
import type { LoadedDocument } from '../store/editorStore'
import { assignSlots, cellRect, resolveLayoutById } from './grids'
import { makePatternTile } from './patterns'

/**
 * Geometry and styling for a cheap DOM preview of a page — used by the page
 * strip, which needs a picture of every page in a project at once.
 *
 * Deliberately not `exportBoard()`: that temporarily rewrites the live board
 * group's transform to take its snapshot, which is far too heavy (and too
 * invasive) for a rail that rerenders whenever the pages change. This renders
 * from the stored document instead, in plain DOM.
 */

/** One photo placed on the preview, in board units. */
export interface PreviewPhoto {
  el: PhotoElement
  x: number
  y: number
  w: number
  h: number
  rotation: number
  /** Grid cells crop to fill; free photos are drawn at their own size. */
  cover: boolean
}

/**
 * Where each photo sits on the page.
 *
 * Grid and custom-layout pages are laid out from the layout's cells, exactly as
 * `GridView` does — a grid photo's own x/y are meaningless there, so using them
 * would pile every photo in the top-left corner.
 */
export function previewPhotos(page: LoadedDocument, max = 6): PreviewPhoto[] {
  const photos = page.elements.filter(
    (e): e is PhotoElement => e.type === 'photo' && !e.hidden,
  )
  const layout = page.gridId ? resolveLayoutById(page.gridId) : undefined

  if (page.mode !== 'free' && layout) {
    const slots = assignSlots(layout.cells.length, photos)
    const out: PreviewPhoto[] = []
    for (let i = 0; i < layout.cells.length && out.length < max; i++) {
      const el = slots[i]
      if (!el) continue
      const r = cellRect(
        layout.cells[i],
        page.boardWidth,
        page.boardHeight,
        page.gridGap,
        page.gridMargin ?? 0,
      )
      out.push({ el, x: r.x, y: r.y, w: r.w, h: r.h, rotation: 0, cover: true })
    }
    return out
  }

  return photos.slice(0, max).map((el) => ({
    el,
    x: el.x,
    y: el.y,
    w: el.width * el.scaleX,
    h: el.height * el.scaleY,
    rotation: el.rotation,
    cover: false,
  }))
}

// One tile per colour combination — building a 64×64 canvas per page per render
// would be silly, and the set of patterns in play is tiny.
const tileCache = new Map<string, string>()

function patternDataUrl(bg: Background): string | null {
  if (typeof document === 'undefined') return null
  const key = `${bg.patternId}|${bg.color}|${bg.patternColor}`
  const hit = tileCache.get(key)
  if (hit) return hit
  try {
    const url = makePatternTile(bg.patternId, bg.color, bg.patternColor).toDataURL()
    tileCache.set(key, url)
    return url
  } catch {
    // No canvas (jsdom, or a locked-down context) — the flat colour is fine.
    return null
  }
}

export interface PreviewBackground {
  backgroundColor: string
  backgroundImage?: string
  backgroundSize?: string
  /** Set for a photo background, which the board draws faded. */
  opacity?: number
}

/**
 * The page background as CSS.
 *
 * The gradient angle needs converting: the board's angle is a direction vector
 * `(cos θ, sin θ)` with y pointing down, so 0° runs left→right — while CSS
 * measures from "to top" clockwise, making the same direction `θ + 90`.
 * Getting this backwards mirrors every gradient in the strip.
 */
export function backgroundStyle(bg: Background, photoSrc?: string): PreviewBackground {
  switch (bg.type) {
    case 'gradient':
      return {
        backgroundColor: bg.color,
        backgroundImage: `linear-gradient(${bg.gradientAngle + 90}deg, ${bg.gradientFrom}, ${bg.gradientTo})`,
      }
    case 'pattern': {
      const url = patternDataUrl(bg)
      return url
        ? { backgroundColor: bg.color, backgroundImage: `url(${url})`, backgroundSize: '16px 16px' }
        : { backgroundColor: bg.color }
    }
    case 'photo':
      return photoSrc
        ? {
            backgroundColor: bg.color,
            backgroundImage: `url(${photoSrc})`,
            backgroundSize: 'cover',
            // Matches Background.tsx, which draws a photo background at 0.4.
            opacity: 0.4,
          }
        : { backgroundColor: bg.color }
    default:
      return { backgroundColor: bg.color }
  }
}

/** Board frame as a CSS border. `width` is a fraction of the shorter axis. */
export function frameBorder(page: LoadedDocument, scale: number) {
  const frame = page.frame
  if (!frame || frame.style === 'none') return undefined
  const px = frame.width * Math.min(page.boardWidth, page.boardHeight) * scale
  return {
    border: `${Math.max(1, px)}px solid ${frame.color}`,
    borderRadius: frame.style === 'rounded' ? `${Math.max(2, px)}px` : undefined,
  }
}
