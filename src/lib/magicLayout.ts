import type { GridCell } from '../types'

/**
 * Splits `weights` into `k` contiguous runs so the heaviest run is as light as
 * possible. Returns each run's end index (exclusive).
 */
function linearPartition(weights: number[], k: number): number[] {
  const n = weights.length
  const prefix = [0]
  for (const w of weights) prefix.push(prefix[prefix.length - 1] + w)
  const cost: number[][] = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(Infinity))
  const cut: number[][] = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(0))
  cost[0][0] = 0
  for (let j = 1; j <= k; j++) {
    for (let i = j; i <= n; i++) {
      for (let p = j - 1; p < i; p++) {
        const c = Math.max(cost[j - 1][p], prefix[i] - prefix[p])
        if (c < cost[j][i]) {
          cost[j][i] = c
          cut[j][i] = p
        }
      }
    }
  }
  const ends: number[] = []
  for (let j = k, i = n; j > 0; j--) {
    ends.unshift(i)
    i = cut[j][i]
  }
  return ends
}

interface Packing {
  cells: GridCell[]
  /** How far every cell's aspect is stretched from its photo's, as |ln(factor)|. */
  distortion: number
}

/**
 * Justified rows: each row is as tall as it must be for its photos to fill the
 * width at their own aspect, then every row is scaled by the same factor so
 * the rows fill the height. That factor is the only distortion, and the
 * row count is chosen to keep it nearest 1.
 */
function packRows(aspects: number[], boardAspect: number): Packing {
  let best: Packing | null = null
  for (let k = 1; k <= aspects.length; k++) {
    const ends = linearPartition(aspects, k)
    const rows = ends.map((end, r) => aspects.slice(r === 0 ? 0 : ends[r - 1], end))
    // Heights in board-width units: a row of aspects summing to S is 1/S tall.
    const heights = rows.map((row) => 1 / row.reduce((sum, a) => sum + a, 0))
    const total = heights.reduce((sum, h) => sum + h, 0)
    const distortion = Math.abs(Math.log(total * boardAspect))
    if (best && distortion >= best.distortion) continue

    const cells: GridCell[] = []
    let y = 0
    rows.forEach((row, r) => {
      const height = heights[r] / total
      const rowSum = row.reduce((sum, a) => sum + a, 0)
      let x = 0
      for (const a of row) {
        cells.push({ x, y, width: a / rowSum, height })
        x += a / rowSum
      }
      y += height
    })
    best = { cells, distortion }
  }
  return best!
}

/**
 * Arranges photos, in order, into cells whose shapes follow the photos' own
 * aspect ratios, so the cover-fit in each cell crops as little as possible.
 * Tries justified rows and justified columns and keeps whichever crops less.
 * Cells are normalised to the board, like every other grid layout.
 */
export function magicLayout(
  aspects: number[],
  boardWidth: number,
  boardHeight: number,
): GridCell[] {
  if (!aspects.length) return []
  for (const a of aspects) {
    if (!(a > 0 && Number.isFinite(a)))
      throw new Error(`magicLayout: aspect ratio must be positive, got ${a}`)
  }
  const boardAspect = boardWidth / boardHeight
  const rows = packRows(aspects, boardAspect)
  const columns = packRows(
    aspects.map((a) => 1 / a),
    1 / boardAspect,
  )
  if (rows.distortion <= columns.distortion) return rows.cells
  return columns.cells.map((c) => ({ x: c.y, y: c.x, width: c.height, height: c.width }))
}
