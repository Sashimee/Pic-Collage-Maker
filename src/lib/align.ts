export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export type AlignOp =
  'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'distributeX' | 'distributeY'

export interface Offset {
  dx: number
  dy: number
}

/** The smallest box around all of `boxes`, or null when there are none. */
export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null
  const left = Math.min(...boxes.map((b) => b.x))
  const top = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.width))
  const bottom = Math.max(...boxes.map((b) => b.y + b.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * How far to move each box so it lines up with `ref`, or so the boxes sit at
 * equal gaps between the outermost two. Distributing needs three boxes — with
 * fewer there is no gap to even out — and leaves the outermost two in place.
 */
export function alignOffsets(
  boxes: Record<string, Box>,
  op: AlignOp,
  ref: Box,
): Record<string, Offset> {
  const ids = Object.keys(boxes)
  if (op === 'distributeX' || op === 'distributeY')
    return distribute(boxes, op === 'distributeX' ? 'x' : 'y')
  return Object.fromEntries(
    ids.map((id) => {
      const b = boxes[id]
      switch (op) {
        case 'left':
          return [id, { dx: ref.x - b.x, dy: 0 }]
        case 'centerX':
          return [id, { dx: ref.x + ref.width / 2 - (b.x + b.width / 2), dy: 0 }]
        case 'right':
          return [id, { dx: ref.x + ref.width - (b.x + b.width), dy: 0 }]
        case 'top':
          return [id, { dx: 0, dy: ref.y - b.y }]
        case 'centerY':
          return [id, { dx: 0, dy: ref.y + ref.height / 2 - (b.y + b.height / 2) }]
        case 'bottom':
          return [id, { dx: 0, dy: ref.y + ref.height - (b.y + b.height) }]
      }
    }),
  )
}

function distribute(boxes: Record<string, Box>, axis: 'x' | 'y'): Record<string, Offset> {
  const size = axis === 'x' ? 'width' : 'height'
  const order = Object.keys(boxes).sort(
    (a, b) => boxes[a][axis] + boxes[a][size] / 2 - (boxes[b][axis] + boxes[b][size] / 2),
  )
  const offsets = Object.fromEntries(order.map((id) => [id, { dx: 0, dy: 0 }]))
  if (order.length < 3) return offsets
  const first = boxes[order[0]]
  const last = boxes[order[order.length - 1]]
  const span = last[axis] + last[size] - first[axis]
  const occupied = order.reduce((sum, id) => sum + boxes[id][size], 0)
  const gap = (span - occupied) / (order.length - 1)
  let at = first[axis]
  for (const id of order) {
    const shift = at - boxes[id][axis]
    offsets[id] = axis === 'x' ? { dx: shift, dy: 0 } : { dx: 0, dy: shift }
    at += boxes[id][size] + gap
  }
  return offsets
}
