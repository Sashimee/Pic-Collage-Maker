import { facePan, findFaceRegions, type FaceBox } from './faceDetection'

export interface FillPhoto {
  /** Width / height. The photo is measured as `aspect` wide and 1 tall. */
  aspect: number
  /** Face boxes in those units. */
  faces: Omit<FaceBox, 'confidence'>[]
  /** The cell it sits in now, kept when no other cell is better. */
  current?: number
}

export interface Placement {
  cell: number
  pan: { x: number; y: number }
}

/**
 * What a photo loses in a cell, 0 (nothing) up: the share of the photo the
 * cover-fit crops away, plus three times the share of its faces left outside
 * the frame once the crop is panned towards them.
 */
export function placementCost(
  photo: FillPhoto,
  cellAspect: number,
): { cost: number; pan: Placement['pan'] } {
  const { aspect, faces } = photo
  const pan = facePan(faces, aspect, 1, cellAspect)
  const shownW = Math.min(aspect, cellAspect)
  const shownH = Math.min(1, aspect / cellAspect)
  const cropLoss = 1 - (shownW * shownH) / aspect
  // A pan of +1 slides the frame to the photo's left (top) edge, -1 to the other.
  const left = ((aspect - shownW) * (1 - pan.x)) / 2
  const top = ((1 - shownH) * (1 - pan.y)) / 2
  let faceArea = 0
  let cutArea = 0
  for (const f of faces) {
    const area = f.width * f.height
    const inW = Math.max(0, Math.min(f.x + f.width, left + shownW) - Math.max(f.x, left))
    const inH = Math.max(0, Math.min(f.y + f.height, top + shownH) - Math.max(f.y, top))
    faceArea += area
    cutArea += area - inW * inH
  }
  const faceLoss = faceArea > 0 ? cutArea / faceArea : 0
  return { cost: cropLoss + 3 * faceLoss, pan }
}

/** Above this many cells the exact search gets slow, so placement turns greedy. */
const EXACT_CELL_LIMIT = 12

/**
 * Puts each photo in a different cell so the total loss is smallest. Photos
 * beyond the cell count are left out (`undefined`), as the grid already does.
 * Ties keep each photo in its `current` cell, so a set that fits anywhere stays put.
 */
export function smartAssign(photos: FillPhoto[], cellAspects: number[]): (Placement | undefined)[] {
  const n = Math.min(photos.length, cellAspects.length)
  const m = cellAspects.length
  // Far below any real cost difference, so it only ever breaks ties.
  const STAY = 1e-9
  const scored = photos.slice(0, n).map((p) =>
    cellAspects.map((a, c) => {
      const s = placementCost(p, a)
      return c === p.current ? { ...s, cost: s.cost - STAY } : s
    }),
  )
  const result: (Placement | undefined)[] = photos.map(() => undefined)

  if (m <= EXACT_CELL_LIMIT) {
    // best[i][mask]: least loss placing photos i.. given the cells in `mask` are taken.
    const size = 1 << m
    const best: Float64Array[] = Array.from({ length: n + 1 }, () =>
      new Float64Array(size).fill(Infinity),
    )
    const choice: Int8Array[] = Array.from({ length: n }, () => new Int8Array(size).fill(-1))
    best[n].fill(0)
    for (let i = n - 1; i >= 0; i--) {
      for (let mask = 0; mask < size; mask++) {
        for (let c = 0; c < m; c++) {
          if (mask & (1 << c)) continue
          const total = scored[i][c].cost + best[i + 1][mask | (1 << c)]
          if (total < best[i][mask] - 1e-12) {
            best[i][mask] = total
            choice[i][mask] = c
          }
        }
      }
    }
    let mask = 0
    for (let i = 0; i < n; i++) {
      const c = choice[i][mask]
      result[i] = { cell: c, pan: scored[i][c].pan }
      mask |= 1 << c
    }
    return result
  }

  const pairs = scored
    .flatMap((row, i) => row.map((s, c) => ({ i, c, cost: s.cost })))
    .sort((a, b) => a.cost - b.cost || a.i - b.i || a.c - b.c)
  const taken = new Set<number>()
  for (const { i, c } of pairs) {
    if (result[i] || taken.has(c)) continue
    result[i] = { cell: c, pan: scored[i][c].pan }
    taken.add(c)
  }
  return result
}

/** Loads an image and finds its faces, measured as `FillPhoto` expects. */
export async function facesIn(src: string): Promise<FillPhoto> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  await img.decode()
  const w = img.naturalWidth
  const h = img.naturalHeight
  return {
    aspect: w / h,
    faces: findFaceRegions(img).map((f) => ({
      x: f.x / h,
      y: f.y / h,
      width: f.width / h,
      height: f.height / h,
    })),
  }
}
