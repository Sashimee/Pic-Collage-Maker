import type { Context } from 'konva/lib/Context'
import type { GridCell, GridCellShape } from '../types'
import { CELL_SHAPE_PRESETS } from './cellShapes'
import type { CellRect as Rect2 } from './grids'

function roundedRectPath(
  ctx: Context,
  r: Rect2,
  radius: number,
) {
  const rad = Math.min(radius, r.w / 2, r.h / 2)
  ctx.beginPath()
  ctx.moveTo(r.x + rad, r.y)
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad)
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad)
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad)
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad)
  ctx.closePath()
}

export function getClipFunc(cell: GridCell, rect: Rect2, radius: number) {
  const shape: GridCellShape = cell.shape ?? 'rect'
  if (shape === 'circle') {
    return (ctx: Context) => {
      ctx.beginPath()
      ctx.arc(
        rect.x + rect.w / 2,
        rect.y + rect.h / 2,
        Math.min(rect.w, rect.h) / 2,
        0,
        Math.PI * 2,
      )
      ctx.closePath()
    }
  }
  if (shape === 'ellipse') {
    return (ctx: Context) => {
      const rx = rect.w / 2
      const ry = rect.h / 2
      ctx.beginPath()
      ctx.ellipse(rect.x + rx, rect.y + ry, rx, ry, 0, 0, Math.PI * 2)
      ctx.closePath()
    }
  }
  if (shape === 'rounded-rect') {
    return (ctx: Context) => roundedRectPath(ctx, rect, cell.cornerRadius ?? radius)
  }
  if (shape === 'polygon') {
    const pts = cell.polygon?.length ? cell.polygon : CELL_SHAPE_PRESETS.diamond
    return (ctx: Context) => {
      ctx.beginPath()
      pts.forEach((p, i) => {
        const x = rect.x + p.x * rect.w
        const y = rect.y + p.y * rect.h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
    }
  }
  if (shape === 'path' && cell.path) {
    return (ctx: Context) => {
      const raw = ctx._context as CanvasRenderingContext2D | undefined
      if (raw && 'Path2D' in window) {
        const p = new Path2D(cell.path!)
        raw.save()
        raw.translate(rect.x, rect.y)
        raw.scale(rect.w, rect.h)
        raw.fill(p)
        raw.restore()
        ctx.beginPath()
        ctx.moveTo(rect.x, rect.y)
        ctx.lineTo(rect.x + rect.w, rect.y)
        ctx.lineTo(rect.x + rect.w, rect.y + rect.h)
        ctx.lineTo(rect.x, rect.y + rect.h)
        ctx.closePath()
      } else {
        ctx.beginPath()
        ctx.rect(rect.x, rect.y, rect.w, rect.h)
        ctx.closePath()
      }
    }
  }
  return undefined
}

export function getClipBounds(cell: GridCell, rect: Rect2): Rect2 {
  const shape = cell.shape ?? 'rect'
  if (shape === 'circle') {
    const d = Math.min(rect.w, rect.h)
    return { x: rect.x + (rect.w - d) / 2, y: rect.y + (rect.h - d) / 2, w: d, h: d }
  }
  if (shape === 'ellipse') {
    return rect
  }
  // For polygon, path, and rounded-rect we return the full bounding rect
  // since computing exact clip bounds for arbitrary shapes is non-trivial.
  // dragBoundFunc will still clamp within this bounding rect.
  return rect
}
