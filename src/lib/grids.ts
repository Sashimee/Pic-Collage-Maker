import type { GridCell, GridLayout, PhotoElement } from '../types'
import { getCustomLayoutById } from './customLayoutStorage'

export interface CellRect {
  x: number
  y: number
  w: number
  h: number
}

export const MAX_GRID_MARGIN = 160

/** The largest margin that still has an effect on a `W`×`H` board. */
export function maxGridMargin(W: number, H: number): number {
  return Math.min(MAX_GRID_MARGIN, Math.floor(Math.min(W, H) / 4))
}

/**
 * A normalised cell scaled onto a board of `W`×`H`, inset by the gutter and
 * by an outer margin around the whole grid.
 */
export function cellRect(cell: GridCell, W: number, H: number, gap: number, margin = 0): CellRect {
  // A margin chosen on a big board must not turn a small one inside out.
  const m = Math.max(0, Math.min(margin, Math.min(W, H) / 4))
  const iw = W - 2 * m
  const ih = H - 2 * m
  return {
    x: m + cell.x * iw + gap / 2,
    y: m + cell.y * ih + gap / 2,
    w: cell.width * iw - gap,
    h: cell.height * ih - gap,
  }
}

/**
 * Which photo goes in which cell: a photo pinned with `cellIndex` claims that
 * cell, the rest fill the gaps in order, extras are dropped.
 *
 * Lives here rather than in GridView so the page thumbnails can lay a grid page
 * out the same way the canvas does without importing react-konva.
 */
export function assignSlots(
  count: number,
  photos: PhotoElement[],
): (PhotoElement | undefined)[] {
  const slots: (PhotoElement | undefined)[] = new Array(count).fill(undefined)
  const rest: PhotoElement[] = []
  for (const p of photos) {
    const i = p.cellIndex
    if (i != null && i >= 0 && i < count && !slots[i]) slots[i] = p
    else rest.push(p)
  }
  let next = 0
  for (const p of rest) {
    while (next < count && slots[next]) next++
    if (next >= count) break
    slots[next] = p
  }
  return slots
}

// Normalised (0..1) collage layouts. A small gutter is applied at render time,
// so cells here tile the full unit square edge-to-edge. Rendered as visual
// thumbnails in the layout picker (see LayoutPreview), so no text label needed.
export const GRID_LAYOUTS: GridLayout[] = [
  // ---- 1 photo ----
  {
    id: '1-full',
    label: '1',
    count: 1,
    category: 'classic',
    cells: [{ x: 0, y: 0, width: 1, height: 1 }],
  },
  {
    id: '1-centered',
    label: '1',
    count: 1,
    category: 'classic',
    cells: [{ x: 0.1, y: 0.1, width: 0.8, height: 0.8, shape: 'circle' }],
  },

  // ---- 2 photos ----
  {
    id: '2-v',
    label: '2',
    count: 2,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ],
  },
  {
    id: '2-h',
    label: '2',
    count: 2,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ],
  },
  {
    id: '2-big-small',
    label: '2',
    count: 2,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.66 },
      { x: 0, y: 0.66, width: 1, height: 0.34 },
    ],
  },
  {
    id: '2-overlap',
    label: '2',
    count: 2,
    category: 'creative',
    cells: [
      { x: 0, y: 0, width: 0.7, height: 1 },
      { x: 0.3, y: 0.05, width: 0.7, height: 0.9 },
    ],
  },

  // ---- 3 photos ----
  {
    id: '3-col',
    label: '3',
    count: 3,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 1 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 1 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 1 },
    ],
  },
  {
    id: '3-strip-h',
    label: '3',
    count: 3,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 1, height: 1 / 3 },
      { x: 0, y: 1 / 3, width: 1, height: 1 / 3 },
      { x: 0, y: 2 / 3, width: 1, height: 1 / 3 },
    ],
  },
  {
    id: '3-1big-left',
    label: '3',
    count: 3,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 0.6, height: 1 },
      { x: 0.6, y: 0, width: 0.4, height: 0.5 },
      { x: 0.6, y: 0.5, width: 0.4, height: 0.5 },
    ],
  },
  {
    id: '3-1big-top',
    label: '3',
    count: 3,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.6 },
      { x: 0, y: 0.6, width: 0.5, height: 0.4 },
      { x: 0.5, y: 0.6, width: 0.5, height: 0.4 },
    ],
  },
  {
    id: '3-tri',
    label: '3',
    count: 3,
    category: 'creative',
    cells: [
      { x: 0.25, y: 0, width: 0.5, height: 0.5, shape: 'circle' },
      { x: 0, y: 0.5, width: 0.5, height: 0.5, shape: 'circle' },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5, shape: 'circle' },
    ],
  },
  {
    id: '3-magazine',
    label: '3',
    count: 3,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.6 },
      { x: 0, y: 0.6, width: 0.55, height: 0.4 },
      { x: 0.55, y: 0.6, width: 0.45, height: 0.4 },
    ],
  },
  {
    id: '3-diamond',
    label: '3',
    count: 3,
    category: 'creative',
    cells: [
      { x: 0.25, y: 0, width: 0.5, height: 0.5, shape: 'polygon', polygon: [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }] },
      { x: 0, y: 0.5, width: 0.5, height: 0.5, shape: 'polygon', polygon: [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }] },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5, shape: 'polygon', polygon: [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }] },
    ],
  },

  // ---- 4 photos ----
  {
    id: '4-grid',
    label: '4',
    count: 4,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
  },
  {
    id: '4-col',
    label: '4',
    count: 4,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 0.25, height: 1 },
      { x: 0.25, y: 0, width: 0.25, height: 1 },
      { x: 0.5, y: 0, width: 0.25, height: 1 },
      { x: 0.75, y: 0, width: 0.25, height: 1 },
    ],
  },
  {
    id: '4-row',
    label: '4',
    count: 4,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.25 },
      { x: 0, y: 0.25, width: 1, height: 0.25 },
      { x: 0, y: 0.5, width: 1, height: 0.25 },
      { x: 0, y: 0.75, width: 1, height: 0.25 },
    ],
  },
  {
    id: '4-1big-top',
    label: '4',
    count: 4,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.6 },
      { x: 0, y: 0.6, width: 1 / 3, height: 0.4 },
      { x: 1 / 3, y: 0.6, width: 1 / 3, height: 0.4 },
      { x: 2 / 3, y: 0.6, width: 1 / 3, height: 0.4 },
    ],
  },
  {
    id: '4-1big-left',
    label: '4',
    count: 4,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 0.6, height: 1 },
      { x: 0.6, y: 0, width: 0.4, height: 1 / 3 },
      { x: 0.6, y: 1 / 3, width: 0.4, height: 1 / 3 },
      { x: 0.6, y: 2 / 3, width: 0.4, height: 1 / 3 },
    ],
  },
  {
    id: '4-pinwheel',
    label: '4',
    count: 4,
    category: 'creative',
    cells: [
      { x: 0, y: 0, width: 0.6, height: 0.4 },
      { x: 0.6, y: 0, width: 0.4, height: 0.6 },
      { x: 0.4, y: 0.6, width: 0.6, height: 0.4 },
      { x: 0, y: 0.4, width: 0.4, height: 0.6 },
    ],
  },
  {
    id: '4-magazine',
    label: '4',
    count: 4,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 0.7, height: 1 },
      { x: 0.7, y: 0, width: 0.3, height: 1 / 3 },
      { x: 0.7, y: 1 / 3, width: 0.3, height: 1 / 3 },
      { x: 0.7, y: 2 / 3, width: 0.3, height: 1 / 3 },
    ],
  },
  {
    id: '4-story',
    label: '4',
    count: 4,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.25 },
      { x: 0, y: 0.25, width: 1, height: 0.25 },
      { x: 0, y: 0.5, width: 1, height: 0.25 },
      { x: 0, y: 0.75, width: 1, height: 0.25 },
    ],
  },
  {
    id: '4-hex',
    label: '4',
    count: 4,
    category: 'creative',
    cells: [
      { x: 0.25, y: 0, width: 0.5, height: 0.5, shape: 'polygon', polygon: [{ x: 0.5, y: 0 }, { x: 0.933, y: 0.25 }, { x: 0.933, y: 0.75 }, { x: 0.5, y: 1 }, { x: 0.067, y: 0.75 }, { x: 0.067, y: 0.25 }] },
      { x: 0, y: 0.25, width: 0.5, height: 0.5, shape: 'polygon', polygon: [{ x: 0.5, y: 0 }, { x: 0.933, y: 0.25 }, { x: 0.933, y: 0.75 }, { x: 0.5, y: 1 }, { x: 0.067, y: 0.75 }, { x: 0.067, y: 0.25 }] },
      { x: 0.5, y: 0.25, width: 0.5, height: 0.5, shape: 'polygon', polygon: [{ x: 0.5, y: 0 }, { x: 0.933, y: 0.25 }, { x: 0.933, y: 0.75 }, { x: 0.5, y: 1 }, { x: 0.067, y: 0.75 }, { x: 0.067, y: 0.25 }] },
      { x: 0.25, y: 0.5, width: 0.5, height: 0.5, shape: 'polygon', polygon: [{ x: 0.5, y: 0 }, { x: 0.933, y: 0.25 }, { x: 0.933, y: 0.75 }, { x: 0.5, y: 1 }, { x: 0.067, y: 0.75 }, { x: 0.067, y: 0.25 }] },
    ],
  },

  // ---- 5 photos ----
  {
    id: '5-1big-left',
    label: '5',
    count: 5,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 0.6, height: 1 },
      { x: 0.6, y: 0, width: 0.4, height: 0.25 },
      { x: 0.6, y: 0.25, width: 0.4, height: 0.25 },
      { x: 0.6, y: 0.5, width: 0.4, height: 0.25 },
      { x: 0.6, y: 0.75, width: 0.4, height: 0.25 },
    ],
  },
  {
    id: '5-1big-top',
    label: '5',
    count: 5,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.6 },
      { x: 0, y: 0.6, width: 0.25, height: 0.4 },
      { x: 0.25, y: 0.6, width: 0.25, height: 0.4 },
      { x: 0.5, y: 0.6, width: 0.25, height: 0.4 },
      { x: 0.75, y: 0.6, width: 0.25, height: 0.4 },
    ],
  },
  {
    id: '5-2over3',
    label: '5',
    count: 5,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 1 / 3, height: 0.5 },
      { x: 1 / 3, y: 0.5, width: 1 / 3, height: 0.5 },
      { x: 2 / 3, y: 0.5, width: 1 / 3, height: 0.5 },
    ],
  },
  {
    id: '5-circle',
    label: '5',
    count: 5,
    category: 'creative',
    cells: [
      { x: 0.3, y: 0.3, width: 0.4, height: 0.4, shape: 'circle' },
      { x: 0.3, y: 0.05, width: 0.4, height: 0.25, shape: 'circle' },
      { x: 0.7, y: 0.3, width: 0.25, height: 0.4, shape: 'circle' },
      { x: 0.3, y: 0.7, width: 0.4, height: 0.25, shape: 'circle' },
      { x: 0.05, y: 0.3, width: 0.25, height: 0.4, shape: 'circle' },
    ],
  },
  {
    id: '5-pinterest',
    label: '5',
    count: 5,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 0.4 },
      { x: 0.5, y: 0, width: 0.5, height: 0.6 },
      { x: 0, y: 0.4, width: 0.5, height: 0.6 },
      { x: 0.5, y: 0.6, width: 0.5, height: 0.4 },
      { x: 0.25, y: 0.35, width: 0.5, height: 0.3 },
    ],
  },
  {
    id: '5-magazine',
    label: '5',
    count: 5,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.25, height: 0.25 },
      { x: 0.75, y: 0.5, width: 0.25, height: 0.25 },
      { x: 0.5, y: 0.75, width: 0.5, height: 0.25 },
    ],
  },
  {
    id: '5-strip',
    label: '5',
    count: 5,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.2 },
      { x: 0, y: 0.2, width: 1, height: 0.2 },
      { x: 0, y: 0.4, width: 1, height: 0.2 },
      { x: 0, y: 0.6, width: 1, height: 0.2 },
      { x: 0, y: 0.8, width: 1, height: 0.2 },
    ],
  },

  // ---- 6 photos ----
  {
    id: '6-grid',
    label: '6',
    count: 6,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 0.5 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 0.5 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 0.5 },
      { x: 0, y: 0.5, width: 1 / 3, height: 0.5 },
      { x: 1 / 3, y: 0.5, width: 1 / 3, height: 0.5 },
      { x: 2 / 3, y: 0.5, width: 1 / 3, height: 0.5 },
    ],
  },
  {
    id: '6-2x3',
    label: '6',
    count: 6,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 / 3 },
      { x: 0.5, y: 0, width: 0.5, height: 1 / 3 },
      { x: 0, y: 1 / 3, width: 0.5, height: 1 / 3 },
      { x: 0.5, y: 1 / 3, width: 0.5, height: 1 / 3 },
      { x: 0, y: 2 / 3, width: 0.5, height: 1 / 3 },
      { x: 0.5, y: 2 / 3, width: 0.5, height: 1 / 3 },
    ],
  },
  {
    id: '6-1big',
    label: '6',
    count: 6,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 2 / 3, height: 2 / 3 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 1 / 3 },
      { x: 2 / 3, y: 1 / 3, width: 1 / 3, height: 1 / 3 },
      { x: 0, y: 2 / 3, width: 1 / 3, height: 1 / 3 },
      { x: 1 / 3, y: 2 / 3, width: 1 / 3, height: 1 / 3 },
      { x: 2 / 3, y: 2 / 3, width: 1 / 3, height: 1 / 3 },
    ],
  },
  {
    id: '6-pinterest',
    label: '6',
    count: 6,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 0.35 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 0.55 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 0.4 },
      { x: 0, y: 0.35, width: 1 / 3, height: 0.65 },
      { x: 1 / 3, y: 0.55, width: 1 / 3, height: 0.45 },
      { x: 2 / 3, y: 0.4, width: 1 / 3, height: 0.6 },
    ],
  },
  {
    id: '6-magazine',
    label: '6',
    count: 6,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 0.66 },
      { x: 0.5, y: 0, width: 0.5, height: 0.33 },
      { x: 0.5, y: 0.33, width: 0.5, height: 0.33 },
      { x: 0, y: 0.66, width: 1 / 3, height: 0.34 },
      { x: 1 / 3, y: 0.66, width: 1 / 3, height: 0.34 },
      { x: 2 / 3, y: 0.66, width: 1 / 3, height: 0.34 },
    ],
  },
  {
    id: '6-story',
    label: '6',
    count: 6,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 1, height: 1 / 6 },
      { x: 0, y: 1 / 6, width: 1, height: 1 / 6 },
      { x: 0, y: 2 / 6, width: 1, height: 1 / 6 },
      { x: 0, y: 3 / 6, width: 1, height: 1 / 6 },
      { x: 0, y: 4 / 6, width: 1, height: 1 / 6 },
      { x: 0, y: 5 / 6, width: 1, height: 1 / 6 },
    ],
  },
  {
    id: '6-circle',
    label: '6',
    count: 6,
    category: 'creative',
    cells: [
      { x: 0.33, y: 0.33, width: 0.34, height: 0.34, shape: 'circle' },
      { x: 0.33, y: 0, width: 0.34, height: 0.33, shape: 'circle' },
      { x: 0.67, y: 0.33, width: 0.33, height: 0.34, shape: 'circle' },
      { x: 0.33, y: 0.67, width: 0.34, height: 0.33, shape: 'circle' },
      { x: 0, y: 0.33, width: 0.33, height: 0.34, shape: 'circle' },
      { x: 0, y: 0, width: 1, height: 1, shape: 'circle' },
    ],
  },

  // ---- 7 photos ----
  {
    id: '7-1big-top',
    label: '7',
    count: 7,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1 / 3, height: 0.25 },
      { x: 1 / 3, y: 0.5, width: 1 / 3, height: 0.25 },
      { x: 2 / 3, y: 0.5, width: 1 / 3, height: 0.25 },
      { x: 0, y: 0.75, width: 1 / 3, height: 0.25 },
      { x: 1 / 3, y: 0.75, width: 1 / 3, height: 0.25 },
      { x: 2 / 3, y: 0.75, width: 1 / 3, height: 0.25 },
    ],
  },
  {
    id: '7-magazine',
    label: '7',
    count: 7,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.45 },
      { x: 0, y: 0.45, width: 1 / 3, height: 0.275 },
      { x: 1 / 3, y: 0.45, width: 1 / 3, height: 0.275 },
      { x: 2 / 3, y: 0.45, width: 1 / 3, height: 0.275 },
      { x: 0, y: 0.725, width: 1 / 3, height: 0.275 },
      { x: 1 / 3, y: 0.725, width: 1 / 3, height: 0.275 },
      { x: 2 / 3, y: 0.725, width: 1 / 3, height: 0.275 },
    ],
  },
  {
    id: '7-circle',
    label: '7',
    count: 7,
    category: 'creative',
    cells: [
      { x: 0.35, y: 0.35, width: 0.3, height: 0.3, shape: 'circle' },
      { x: 0.35, y: 0.02, width: 0.3, height: 0.28, shape: 'circle' },
      { x: 0.35, y: 0.7, width: 0.3, height: 0.28, shape: 'circle' },
      { x: 0.02, y: 0.35, width: 0.28, height: 0.3, shape: 'circle' },
      { x: 0.7, y: 0.35, width: 0.28, height: 0.3, shape: 'circle' },
      { x: 0.15, y: 0.15, width: 0.2, height: 0.2, shape: 'circle' },
      { x: 0.65, y: 0.65, width: 0.2, height: 0.2, shape: 'circle' },
    ],
  },
  {
    id: '7-pinterest',
    label: '7',
    count: 7,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 0.3 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 0.5 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 0.35 },
      { x: 0, y: 0.3, width: 1 / 3, height: 0.4 },
      { x: 1 / 3, y: 0.5, width: 1 / 3, height: 0.5 },
      { x: 2 / 3, y: 0.35, width: 1 / 3, height: 0.35 },
      { x: 0, y: 0.7, width: 1 / 3, height: 0.3 },
    ],
  },
  {
    id: '7-strip',
    label: '7',
    count: 7,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 1, height: 1 / 7 },
      { x: 0, y: 1 / 7, width: 1, height: 1 / 7 },
      { x: 0, y: 2 / 7, width: 1, height: 1 / 7 },
      { x: 0, y: 3 / 7, width: 1, height: 1 / 7 },
      { x: 0, y: 4 / 7, width: 1, height: 1 / 7 },
      { x: 0, y: 5 / 7, width: 1, height: 1 / 7 },
      { x: 0, y: 6 / 7, width: 1, height: 1 / 7 },
    ],
  },

  // ---- 8 photos ----
  {
    id: '8-2x4',
    label: '8',
    count: 8,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 0.25 },
      { x: 0.5, y: 0, width: 0.5, height: 0.25 },
      { x: 0, y: 0.25, width: 0.5, height: 0.25 },
      { x: 0.5, y: 0.25, width: 0.5, height: 0.25 },
      { x: 0, y: 0.5, width: 0.5, height: 0.25 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.25 },
      { x: 0, y: 0.75, width: 0.5, height: 0.25 },
      { x: 0.5, y: 0.75, width: 0.5, height: 0.25 },
    ],
  },
  {
    id: '8-magazine',
    label: '8',
    count: 8,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 0.6, height: 0.6 },
      { x: 0.6, y: 0, width: 0.4, height: 0.3 },
      { x: 0.6, y: 0.3, width: 0.4, height: 0.3 },
      { x: 0, y: 0.6, width: 0.3, height: 0.4 },
      { x: 0.3, y: 0.6, width: 0.3, height: 0.4 },
      { x: 0.6, y: 0.6, width: 0.4, height: 0.13 },
      { x: 0.6, y: 0.73, width: 0.4, height: 0.13 },
      { x: 0.6, y: 0.87, width: 0.4, height: 0.13 },
    ],
  },
  {
    id: '8-pinterest',
    label: '8',
    count: 8,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 0.25 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 0.4 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 0.3 },
      { x: 0, y: 0.25, width: 1 / 3, height: 0.35 },
      { x: 1 / 3, y: 0.4, width: 1 / 3, height: 0.3 },
      { x: 2 / 3, y: 0.3, width: 1 / 3, height: 0.35 },
      { x: 0, y: 0.6, width: 1 / 3, height: 0.4 },
      { x: 1 / 3, y: 0.7, width: 1 / 3, height: 0.3 },
    ],
  },
  {
    id: '8-story',
    label: '8',
    count: 8,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.125 },
      { x: 0, y: 0.125, width: 1, height: 0.125 },
      { x: 0, y: 0.25, width: 1, height: 0.125 },
      { x: 0, y: 0.375, width: 1, height: 0.125 },
      { x: 0, y: 0.5, width: 1, height: 0.125 },
      { x: 0, y: 0.625, width: 1, height: 0.125 },
      { x: 0, y: 0.75, width: 1, height: 0.125 },
      { x: 0, y: 0.875, width: 1, height: 0.125 },
    ],
  },

  // ---- 9 photos ----
  {
    id: '9-grid',
    label: '9',
    count: 9,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 1 / 3 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 1 / 3 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 1 / 3 },
      { x: 0, y: 1 / 3, width: 1 / 3, height: 1 / 3 },
      { x: 1 / 3, y: 1 / 3, width: 1 / 3, height: 1 / 3 },
      { x: 2 / 3, y: 1 / 3, width: 1 / 3, height: 1 / 3 },
      { x: 0, y: 2 / 3, width: 1 / 3, height: 1 / 3 },
      { x: 1 / 3, y: 2 / 3, width: 1 / 3, height: 1 / 3 },
      { x: 2 / 3, y: 2 / 3, width: 1 / 3, height: 1 / 3 },
    ],
  },
  {
    id: '9-circle',
    label: '9',
    count: 9,
    category: 'creative',
    cells: [
      { x: 0.33, y: 0.33, width: 0.34, height: 0.34, shape: 'circle' },
      { x: 0.33, y: 0, width: 0.34, height: 0.33, shape: 'circle' },
      { x: 0.67, y: 0.33, width: 0.33, height: 0.34, shape: 'circle' },
      { x: 0.33, y: 0.67, width: 0.34, height: 0.33, shape: 'circle' },
      { x: 0, y: 0.33, width: 0.33, height: 0.34, shape: 'circle' },
      { x: 0.15, y: 0.08, width: 0.18, height: 0.25, shape: 'circle' },
      { x: 0.67, y: 0.08, width: 0.18, height: 0.25, shape: 'circle' },
      { x: 0.15, y: 0.67, width: 0.18, height: 0.25, shape: 'circle' },
      { x: 0.67, y: 0.67, width: 0.18, height: 0.25, shape: 'circle' },
    ],
  },
  {
    id: '9-magazine',
    label: '9',
    count: 9,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.4 },
      { x: 0, y: 0.4, width: 0.25, height: 0.3 },
      { x: 0.25, y: 0.4, width: 0.25, height: 0.3 },
      { x: 0.5, y: 0.4, width: 0.25, height: 0.3 },
      { x: 0.75, y: 0.4, width: 0.25, height: 0.3 },
      { x: 0, y: 0.7, width: 0.25, height: 0.3 },
      { x: 0.25, y: 0.7, width: 0.25, height: 0.3 },
      { x: 0.5, y: 0.7, width: 0.25, height: 0.3 },
      { x: 0.75, y: 0.7, width: 0.25, height: 0.3 },
    ],
  },
  {
    id: '9-pinterest',
    label: '9',
    count: 9,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 0.3 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 0.45 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 0.35 },
      { x: 0, y: 0.3, width: 1 / 3, height: 0.35 },
      { x: 1 / 3, y: 0.45, width: 1 / 3, height: 0.25 },
      { x: 2 / 3, y: 0.35, width: 1 / 3, height: 0.3 },
      { x: 0, y: 0.65, width: 1 / 3, height: 0.35 },
      { x: 1 / 3, y: 0.7, width: 1 / 3, height: 0.3 },
      { x: 2 / 3, y: 0.65, width: 1 / 3, height: 0.35 },
    ],
  },

  // ---- 10+ photos ----
  {
    id: '10-grid',
    label: '10',
    count: 10,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 0.2 },
      { x: 0.5, y: 0, width: 0.5, height: 0.2 },
      { x: 0, y: 0.2, width: 0.5, height: 0.2 },
      { x: 0.5, y: 0.2, width: 0.5, height: 0.2 },
      { x: 0, y: 0.4, width: 0.5, height: 0.2 },
      { x: 0.5, y: 0.4, width: 0.5, height: 0.2 },
      { x: 0, y: 0.6, width: 0.5, height: 0.2 },
      { x: 0.5, y: 0.6, width: 0.5, height: 0.2 },
      { x: 0, y: 0.8, width: 0.5, height: 0.2 },
      { x: 0.5, y: 0.8, width: 0.5, height: 0.2 },
    ],
  },
  {
    id: '10-circle',
    label: '10',
    count: 10,
    category: 'creative',
    cells: [
      { x: 0.35, y: 0.35, width: 0.3, height: 0.3, shape: 'circle' },
      { x: 0.35, y: 0.02, width: 0.3, height: 0.28, shape: 'circle' },
      { x: 0.35, y: 0.7, width: 0.3, height: 0.28, shape: 'circle' },
      { x: 0.02, y: 0.35, width: 0.28, height: 0.3, shape: 'circle' },
      { x: 0.7, y: 0.35, width: 0.28, height: 0.3, shape: 'circle' },
      { x: 0.15, y: 0.08, width: 0.2, height: 0.22, shape: 'circle' },
      { x: 0.65, y: 0.08, width: 0.2, height: 0.22, shape: 'circle' },
      { x: 0.15, y: 0.7, width: 0.2, height: 0.22, shape: 'circle' },
      { x: 0.65, y: 0.7, width: 0.2, height: 0.22, shape: 'circle' },
      { x: 0, y: 0, width: 0.15, height: 0.15, shape: 'circle' },
    ],
  },
  {
    id: '12-grid',
    label: '12',
    count: 12,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 0.25 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 0.25 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 0.25 },
      { x: 0, y: 0.25, width: 1 / 3, height: 0.25 },
      { x: 1 / 3, y: 0.25, width: 1 / 3, height: 0.25 },
      { x: 2 / 3, y: 0.25, width: 1 / 3, height: 0.25 },
      { x: 0, y: 0.5, width: 1 / 3, height: 0.25 },
      { x: 1 / 3, y: 0.5, width: 1 / 3, height: 0.25 },
      { x: 2 / 3, y: 0.5, width: 1 / 3, height: 0.25 },
      { x: 0, y: 0.75, width: 1 / 3, height: 0.25 },
      { x: 1 / 3, y: 0.75, width: 1 / 3, height: 0.25 },
      { x: 2 / 3, y: 0.75, width: 1 / 3, height: 0.25 },
    ],
  },
  {
    id: '12-masonry',
    label: '12',
    count: 12,
    category: 'social',
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 0.2 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 0.3 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 0.25 },
      { x: 0, y: 0.2, width: 1 / 3, height: 0.25 },
      { x: 1 / 3, y: 0.3, width: 1 / 3, height: 0.2 },
      { x: 2 / 3, y: 0.25, width: 1 / 3, height: 0.25 },
      { x: 0, y: 0.45, width: 1 / 3, height: 0.25 },
      { x: 1 / 3, y: 0.5, width: 1 / 3, height: 0.25 },
      { x: 2 / 3, y: 0.5, width: 1 / 3, height: 0.2 },
      { x: 0, y: 0.7, width: 1 / 3, height: 0.3 },
      { x: 1 / 3, y: 0.75, width: 1 / 3, height: 0.25 },
      { x: 2 / 3, y: 0.7, width: 1 / 3, height: 0.3 },
    ],
  },
  {
    id: '16-grid',
    label: '16',
    count: 16,
    category: 'classic',
    cells: [
      { x: 0, y: 0, width: 0.25, height: 0.25 },
      { x: 0.25, y: 0, width: 0.25, height: 0.25 },
      { x: 0.5, y: 0, width: 0.25, height: 0.25 },
      { x: 0.75, y: 0, width: 0.25, height: 0.25 },
      { x: 0, y: 0.25, width: 0.25, height: 0.25 },
      { x: 0.25, y: 0.25, width: 0.25, height: 0.25 },
      { x: 0.5, y: 0.25, width: 0.25, height: 0.25 },
      { x: 0.75, y: 0.25, width: 0.25, height: 0.25 },
      { x: 0, y: 0.5, width: 0.25, height: 0.25 },
      { x: 0.25, y: 0.5, width: 0.25, height: 0.25 },
      { x: 0.5, y: 0.5, width: 0.25, height: 0.25 },
      { x: 0.75, y: 0.5, width: 0.25, height: 0.25 },
      { x: 0, y: 0.75, width: 0.25, height: 0.25 },
      { x: 0.25, y: 0.75, width: 0.25, height: 0.25 },
      { x: 0.5, y: 0.75, width: 0.25, height: 0.25 },
      { x: 0.75, y: 0.75, width: 0.25, height: 0.25 },
    ],
  },

  // ---- Magazine, filmstrip, polaroid and story (9:16) presets ----
  {
    id: 'mag-cover',
    label: '3',
    count: 3,
    category: 'editorial',
    tags: ['magazine'],
    cells: [
      { x: 0, y: 0, width: 1, height: 0.65 },
      { x: 0, y: 0.65, width: 0.5, height: 0.35 },
      { x: 0.5, y: 0.65, width: 0.5, height: 0.35 },
    ],
  },
  {
    id: 'mag-spread',
    label: '4',
    count: 4,
    category: 'editorial',
    tags: ['magazine'],
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 0.6 },
      { x: 0.5, y: 0.6, width: 0.25, height: 0.4 },
      { x: 0.75, y: 0.6, width: 0.25, height: 0.4 },
    ],
  },
  {
    id: 'mag-feature',
    label: '5',
    count: 5,
    category: 'editorial',
    tags: ['magazine'],
    cells: [
      { x: 0, y: 0, width: 0.4, height: 1 },
      { x: 0.4, y: 0, width: 0.3, height: 0.5 },
      { x: 0.7, y: 0, width: 0.3, height: 0.5 },
      { x: 0.4, y: 0.5, width: 0.3, height: 0.5 },
      { x: 0.7, y: 0.5, width: 0.3, height: 0.5 },
    ],
  },
  {
    id: 'mag-banner',
    label: '6',
    count: 6,
    category: 'editorial',
    tags: ['magazine'],
    cells: [
      { x: 0, y: 0, width: 1, height: 0.3 },
      { x: 0, y: 0.3, width: 0.3333, height: 0.4 },
      { x: 0.3333, y: 0.3, width: 0.3333, height: 0.4 },
      { x: 0.6667, y: 0.3, width: 0.3333, height: 0.4 },
      { x: 0, y: 0.7, width: 0.5, height: 0.3 },
      { x: 0.5, y: 0.7, width: 0.5, height: 0.3 },
    ],
  },
  {
    id: 'film-3',
    label: '3',
    count: 3,
    category: 'creative',
    tags: ['filmstrip'],
    cells: [
      { x: 0.12, y: 0.04, width: 0.76, height: 0.28 },
      { x: 0.12, y: 0.36, width: 0.76, height: 0.28 },
      { x: 0.12, y: 0.68, width: 0.76, height: 0.28 },
    ],
  },
  {
    id: 'film-4',
    label: '4',
    count: 4,
    category: 'creative',
    tags: ['filmstrip'],
    cells: [
      { x: 0.0, y: 0.3, width: 0.25, height: 0.4 },
      { x: 0.25, y: 0.3, width: 0.25, height: 0.4 },
      { x: 0.5, y: 0.3, width: 0.25, height: 0.4 },
      { x: 0.75, y: 0.3, width: 0.25, height: 0.4 },
    ],
  },
  {
    id: 'film-5',
    label: '5',
    count: 5,
    category: 'creative',
    tags: ['filmstrip'],
    cells: [
      { x: 0.15, y: 0.025, width: 0.7, height: 0.19 },
      { x: 0.15, y: 0.215, width: 0.7, height: 0.19 },
      { x: 0.15, y: 0.405, width: 0.7, height: 0.19 },
      { x: 0.15, y: 0.595, width: 0.7, height: 0.19 },
      { x: 0.15, y: 0.785, width: 0.7, height: 0.19 },
    ],
  },
  {
    id: 'polaroid-1',
    label: '1',
    count: 1,
    category: 'creative',
    tags: ['polaroid'],
    cells: [{ x: 0.1, y: 0.07, width: 0.8, height: 0.7 }],
  },
  {
    id: 'polaroid-2',
    label: '2',
    count: 2,
    category: 'creative',
    tags: ['polaroid'],
    cells: [
      { x: 0.05, y: 0.15, width: 0.43, height: 0.5 },
      { x: 0.52, y: 0.15, width: 0.43, height: 0.5 },
    ],
  },
  {
    id: 'polaroid-3',
    label: '3',
    count: 3,
    category: 'creative',
    tags: ['polaroid'],
    cells: [
      { x: 0.04, y: 0.3, width: 0.28, height: 0.3 },
      { x: 0.36, y: 0.3, width: 0.28, height: 0.3 },
      { x: 0.68, y: 0.3, width: 0.28, height: 0.3 },
    ],
  },
  {
    id: 'polaroid-4',
    label: '4',
    count: 4,
    category: 'creative',
    tags: ['polaroid'],
    cells: [
      { x: 0.06, y: 0.04, width: 0.41, height: 0.36 },
      { x: 0.53, y: 0.04, width: 0.41, height: 0.36 },
      { x: 0.06, y: 0.52, width: 0.41, height: 0.36 },
      { x: 0.53, y: 0.52, width: 0.41, height: 0.36 },
    ],
  },
  {
    id: 'story-3',
    label: '3',
    count: 3,
    category: 'social',
    tags: ['story', '9:16'],
    cells: [
      { x: 0, y: 0, width: 1, height: 0.4 },
      { x: 0, y: 0.4, width: 1, height: 0.3 },
      { x: 0, y: 0.7, width: 1, height: 0.3 },
    ],
  },
  {
    id: 'story-1-2',
    label: '3',
    count: 3,
    category: 'social',
    tags: ['story', '9:16'],
    cells: [
      { x: 0, y: 0, width: 1, height: 0.6 },
      { x: 0, y: 0.6, width: 0.5, height: 0.4 },
      { x: 0.5, y: 0.6, width: 0.5, height: 0.4 },
    ],
  },
  {
    id: 'story-5',
    label: '5',
    count: 5,
    category: 'social',
    tags: ['story', '9:16'],
    cells: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.25 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.25 },
      { x: 0, y: 0.75, width: 0.5, height: 0.25 },
      { x: 0.5, y: 0.75, width: 0.5, height: 0.25 },
    ],
  },
  {
    id: 'story-l3',
    label: '4',
    count: 4,
    category: 'social',
    tags: ['story', '9:16'],
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 0.3333 },
      { x: 0.5, y: 0.3333, width: 0.5, height: 0.3333 },
      { x: 0.5, y: 0.6667, width: 0.5, height: 0.3333 },
    ],
  },

  // ---- Template-specific asymmetric layouts ----
  {
    id: 'moodboard',
    label: '5',
    count: 5,
    category: 'editorial',
    cells: [
      { x: 0, y: 0, width: 0.55, height: 0.5 },
      { x: 0.55, y: 0, width: 0.45, height: 0.3 },
      { x: 0.55, y: 0.3, width: 0.45, height: 0.2 },
      { x: 0, y: 0.5, width: 0.3, height: 0.5 },
      { x: 0.3, y: 0.5, width: 0.7, height: 0.5 },
    ],
  },
  {
    id: 'celebration',
    label: '5',
    count: 5,
    category: 'creative',
    cells: [
      { x: 0.35, y: 0.35, width: 0.3, height: 0.3, shape: 'circle' },
      { x: 0.35, y: 0.02, width: 0.3, height: 0.28, shape: 'circle' },
      { x: 0.35, y: 0.7, width: 0.3, height: 0.28, shape: 'circle' },
      { x: 0.02, y: 0.35, width: 0.28, height: 0.3, shape: 'circle' },
      { x: 0.7, y: 0.35, width: 0.28, height: 0.3, shape: 'circle' },
    ],
  },
]

export function getGridById(id: string): GridLayout | undefined {
  return GRID_LAYOUTS.find((g) => g.id === id)
}

/**
 * Resolve a layout id to a GridLayout, checking built-in presets first and then
 * user-drawn custom layouts persisted in localStorage. This is what the canvas
 * uses so an applied custom layout actually renders (presets alone would miss it).
 */
export function resolveLayoutById(id: string): GridLayout | undefined {
  const preset = GRID_LAYOUTS.find((g) => g.id === id)
  if (preset) return preset
  const custom = getCustomLayoutById(id)
  if (!custom) return undefined
  return {
    id: custom.id,
    label: custom.name,
    count: custom.cells.length,
    cells: custom.cells,
    category: 'custom',
    isCustom: true,
  }
}

export function getLayoutsByCategory(category: string): GridLayout[] {
  if (category === 'all') return GRID_LAYOUTS
  return GRID_LAYOUTS.filter((g) => g.category === category)
}

export function getLayoutsByCount(count: number): GridLayout[] {
  return GRID_LAYOUTS.filter((g) => g.count === count)
}
