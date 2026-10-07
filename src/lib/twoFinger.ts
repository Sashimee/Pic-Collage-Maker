export interface Point {
  x: number
  y: number
}

export interface Placement {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export interface FingerPair {
  a: Point
  b: Point
}

export const SNAP_STEP = 15
export const SNAP_WITHIN = 4
const MIN_SCALE = 0.05
const MAX_SCALE = 20

const angleDeg = ({ a, b }: FingerPair) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
const distance = ({ a, b }: FingerPair) => Math.hypot(b.x - a.x, b.y - a.y)
const midpoint = ({ a, b }: FingerPair): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** The nearest multiple of SNAP_STEP when `deg` is within SNAP_WITHIN of it, else null. */
export function snapAngle(deg: number): number | null {
  const target = Math.round(deg / SNAP_STEP) * SNAP_STEP
  return Math.abs(deg - target) <= SNAP_WITHIN ? target : null
}

/**
 * Where an element ends up after a two-finger gesture that started at `from`
 * and is now at `to` (both in board units): it moves with the fingers'
 * midpoint, scales with their spread and turns with their angle, as if pinned
 * to the fingers. Always computed from the gesture's start so snapping can't
 * accumulate drift.
 */
export function twoFingerPlacement(
  start: Placement,
  from: FingerPair,
  to: FingerPair,
): Placement & { snapped: number | null } {
  const turned = (((angleDeg(to) - angleDeg(from)) % 360) + 540) % 360 - 180
  const raw = start.rotation + turned
  const snapped = snapAngle(raw)
  const rotation = snapped ?? raw
  const turn = ((rotation - start.rotation) * Math.PI) / 180

  const spread = distance(from) > 0 ? distance(to) / distance(from) : 1
  const base = Math.max(Math.abs(start.scaleX), Math.abs(start.scaleY))
  const k = Math.min(Math.max(spread, MIN_SCALE / base), MAX_SCALE / base)

  const c0 = midpoint(from)
  const c1 = midpoint(to)
  const dx = (start.x - c0.x) * k
  const dy = (start.y - c0.y) * k
  return {
    x: c1.x + dx * Math.cos(turn) - dy * Math.sin(turn),
    y: c1.y + dx * Math.sin(turn) + dy * Math.cos(turn),
    rotation,
    scaleX: start.scaleX * k,
    scaleY: start.scaleY * k,
    snapped,
  }
}
