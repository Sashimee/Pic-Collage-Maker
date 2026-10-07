import type Konva from 'konva'
import type { PhotoShape } from '../types'

// A minimal 2D-path surface — both the browser's CanvasRenderingContext2D and
// Konva's Context implement these, so shape helpers work for clipping (Konva)
// and offscreen rendering alike.
type Path2DLike = {
  beginPath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  bezierCurveTo: (
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) => void
  closePath: () => void
  arc: (
    x: number,
    y: number,
    r: number,
    startAngle: number,
    endAngle: number,
  ) => void
  ellipse?: (
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
  ) => void
}

// Trace `shape` filling the box (0,0)..(w,h). Used as a Konva Group `clipFunc`.
export function tracePhotoShape(
  ctx: CanvasRenderingContext2D | Konva.Context,
  shape: PhotoShape,
  w: number,
  h: number,
) {
  const c = ctx as unknown as Path2DLike
  switch (shape) {
    case 'circle':
      traceEllipse(c, w, h)
      break
    case 'star':
      traceStar(c, w, h)
      break
    case 'heart':
      traceHeart(c, w, h)
      break
    case 'arch':
      traceArch(c, w, h)
      break
    case 'diamond':
      traceDiamond(c, w, h)
      break
    case 'cloud':
      traceCloud(c, w, h)
      break
    case 'hexagon':
      traceHexagon(c, w, h)
      break
    case 'triangle':
      traceTriangle(c, w, h)
      break
    case 'rect':
    default:
      c.beginPath()
      c.moveTo(0, 0)
      c.lineTo(w, 0)
      c.lineTo(w, h)
      c.lineTo(0, h)
      c.closePath()
  }
}

function traceEllipse(c: Path2DLike, w: number, h: number) {
  c.beginPath()
  if (c.ellipse) {
    c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  } else {
    const kx = (w / 2) * 0.5523
    const ky = (h / 2) * 0.5523
    const cx = w / 2
    const cy = h / 2
    c.moveTo(cx, 0)
    c.bezierCurveTo(cx + kx, 0, w, cy - ky, w, cy)
    c.bezierCurveTo(w, cy + ky, cx + kx, h, cx, h)
    c.bezierCurveTo(cx - kx, h, 0, cy + ky, 0, cy)
    c.bezierCurveTo(0, cy - ky, cx - kx, 0, cx, 0)
  }
  c.closePath()
}

function traceStar(c: Path2DLike, w: number, h: number) {
  const cx = w / 2
  const cy = h / 2
  const outer = Math.min(w, h) / 2
  const inner = outer * 0.42
  const points = 5
  c.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / points) * i - Math.PI / 2
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) c.moveTo(x, y)
    else c.lineTo(x, y)
  }
  c.closePath()
}

function traceHeart(c: Path2DLike, w: number, h: number) {
  const x = (t: number) => (t + 1) * 0.5 * w
  const y = (t: number) => (1 - t) * 0.5 * h
  c.beginPath()
  c.moveTo(x(0), y(-0.6))
  c.bezierCurveTo(x(0.35), y(0.4), x(1.1), y(0.3), x(1), y(-0.35))
  c.bezierCurveTo(x(0.92), y(-0.85), x(0.35), y(-0.9), x(0), y(-1))
  c.bezierCurveTo(x(-0.35), y(-0.9), x(-0.92), y(-0.85), x(-1), y(-0.35))
  c.bezierCurveTo(x(-1.1), y(0.3), x(-0.35), y(0.4), x(0), y(-0.6))
  c.closePath()
}

function traceArch(c: Path2DLike, w: number, h: number) {
  // Arch doorway shape: rectangle bottom, ellipse top
  c.beginPath()
  const r = w / 2
  const archH = h * 0.6
  if (c.ellipse) {
    c.ellipse(w / 2, archH, r, archH, 0, Math.PI, 0)
  } else {
    // Bezier arch fallback
    const kx = r * 0.5523
    const ky = archH * 0.5523
    c.moveTo(0, archH)
    c.bezierCurveTo(0, archH - ky, w / 2 - kx, 0, w / 2, 0)
    c.bezierCurveTo(w / 2 + kx, 0, w, archH - ky, w, archH)
  }
  c.lineTo(w, h)
  c.lineTo(0, h)
  c.closePath()
}

function traceDiamond(c: Path2DLike, w: number, h: number) {
  c.beginPath()
  c.moveTo(w / 2, 0)
  c.lineTo(w, h / 2)
  c.lineTo(w / 2, h)
  c.lineTo(0, h / 2)
  c.closePath()
}

function traceCloud(c: Path2DLike, w: number, h: number) {
  // Three overlapping circles forming a cloud
  c.beginPath()
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) * 0.28
  // Left puff
  c.moveTo(cx - w * 0.35 + r, cy)
  c.arc(cx - w * 0.35, cy, r, 0, Math.PI * 2)
  // Top-center puff
  c.moveTo(cx + r * 0.7, cy - h * 0.15)
  c.arc(cx, cy - h * 0.15, r * 0.9, 0, Math.PI * 2)
  // Right puff
  c.moveTo(cx + w * 0.35 + r, cy)
  c.arc(cx + w * 0.35, cy, r, 0, Math.PI * 2)
  // Bottom connector
  c.moveTo(cx - w * 0.35, cy + r * 0.5)
  c.lineTo(cx + w * 0.35, cy + r * 0.5)
  c.closePath()
}

function traceHexagon(c: Path2DLike, w: number, h: number) {
  c.beginPath()
  const cx = w / 2
  const cy = h / 2
  const rx = w / 2
  const ry = h / 2
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2
    const x = cx + Math.cos(a) * rx
    const y = cy + Math.sin(a) * ry
    if (i === 0) c.moveTo(x, y)
    else c.lineTo(x, y)
  }
  c.closePath()
}

function traceTriangle(c: Path2DLike, w: number, h: number) {
  c.beginPath()
  c.moveTo(w / 2, 0)
  c.lineTo(w, h)
  c.lineTo(0, h)
  c.closePath()
}

export const PHOTO_SHAPES: { id: PhotoShape; glyph: string }[] = [
  { id: 'rect', glyph: '▢' },
  { id: 'circle', glyph: '●' },
  { id: 'star', glyph: '★' },
  { id: 'heart', glyph: '♥' },
  { id: 'arch', glyph: '⌒' },
  { id: 'diamond', glyph: '◆' },
  { id: 'cloud', glyph: '☁' },
  { id: 'hexagon', glyph: '⬡' },
  { id: 'triangle', glyph: '▲' },
]

/** `tracePhotoShape`, with rounded corners when the shape is a plain rect. */
export function tracePhotoFrame(
  ctx: CanvasRenderingContext2D | Konva.Context,
  shape: PhotoShape,
  w: number,
  h: number,
  radius: number,
) {
  if (shape !== 'rect' || radius <= 0) return tracePhotoShape(ctx, shape, w, h)
  traceRoundRect(ctx as unknown as Path2DLike, 0, 0, w, h, radius)
}

export function traceRoundRect(
  c: Path2DLike,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2)
  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + w - r, y)
  c.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
  c.lineTo(x + w, y + h - r)
  c.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
  c.lineTo(x + r, y + h)
  c.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  c.lineTo(x, y + r)
  c.arc(x + r, y + r, r, Math.PI, (3 * Math.PI) / 2)
  c.closePath()
}
