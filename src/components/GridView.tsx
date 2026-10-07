import { useEffect, useMemo, useRef, useState } from 'react'
import { Group, Image as KonvaImage, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { Context } from 'konva/lib/Context'
import type { GridCell, GridCellShape, GridLayout, PhotoElement } from '../types'
import { useImage } from '../hooks/useImage'
import { useEditor } from '../store/editorStore'
import { computeFilterConfig } from '../lib/filters'
import { CELL_SHAPE_PRESETS } from '../lib/cellShapes'
import { assignSlots, cellRect, type CellRect as Rect2 } from '../lib/grids'

function placePhoto(
  rect: Rect2,
  imgW: number,
  imgH: number,
  cellZoom = 1,
  cellPan: { x: number; y: number } = { x: 0, y: 0 },
) {
  const s = Math.max(rect.w / imgW, rect.h / imgH) * Math.max(1, cellZoom)
  const dw = imgW * s
  const dh = imgH * s
  const ox = dw - rect.w
  const oy = dh - rect.h
  const px = clamp(cellPan.x, -1, 1)
  const py = clamp(cellPan.y, -1, 1)
  const x = rect.x + (rect.w - dw) / 2 + (px * ox) / 2
  const y = rect.y + (rect.h - dh) / 2 + (py * oy) / 2
  return { x, y, dw, dh, ox, oy }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

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

function getClipFunc(cell: GridCell, rect: Rect2, radius: number) {
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

function getClipBounds(cell: GridCell, rect: Rect2): Rect2 {
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

interface CellPhotoProps {
  el: PhotoElement
  cell: GridCell
  rect: Rect2
  radius: number
  selected: boolean
  onSelect: () => void
  onPan: (pan: { x: number; y: number }) => void
  onReset: () => void
}

function CellPhoto({
  el,
  cell,
  rect,
  radius,
  selected,
  onSelect,
  onPan,
  onReset,
}: CellPhotoProps) {
  // Grid cells used to draw `el.src` unconditionally, so an export of a grid
  // collage silently used the 1080px preview however large it was rendered —
  // the same half-resolution bug that was fixed for free photos, still live
  // here because this path never looked at the flag.
  const exporting = useEditor((s) => s.exporting)
  const image = useImage(
    exporting ? (el.originalSrc ?? el.previewSrc ?? el.src) : (el.previewSrc ?? el.src),
  )
  const ref = useRef<Konva.Image>(null)

  useEffect(() => {
    const node = ref.current
    if (!node || !image) return
    const cfg = computeFilterConfig(el.filters)
    node.cache()
    node.filters(cfg.filters)
    node.brightness(cfg.brightness)
    node.contrast(cfg.contrast)
    node.hue(cfg.hue)
    node.saturation(cfg.saturation)
    node.luminance(cfg.luminance)
    node.blurRadius(cfg.blurRadius)
    node.getLayer()?.batchDraw()
    return () => {
      node.clearCache()
      node.filters([])
    }
  }, [image, el.filters])

  // NOTE: all hooks must run before any early return. `image` starts null and
  // becomes an HTMLImageElement once decoded; a `useMemo` placed after an
  // `if (!image) return null` would change the hook count between renders and
  // crash the whole Konva stage (Rules of Hooks).
  const clipFunc = useMemo(() => getClipFunc(cell, rect, radius), [cell, rect, radius])

  if (!image) return null

  const box = placePhoto(
    rect,
    image.naturalWidth,
    image.naturalHeight,
    el.cellZoom,
    el.cellPan,
  )
  const { x: imgX, y: imgY, dw, dh, ox, oy } = box
  const cx = rect.x + (rect.w - dw) / 2
  const cy = rect.y + (rect.h - dh) / 2

  const commitPan = (node: Konva.Image) => {
    onPan({
      x: ox > 0 ? clamp((node.x() - cx) / (ox / 2), -1, 1) : 0,
      y: oy > 0 ? clamp((node.y() - cy) / (oy / 2), -1, 1) : 0,
    })
  }

  const clipRect = getClipBounds(cell, rect)

  return (
    <Group
      clipFunc={clipFunc}
      clipX={clipFunc ? undefined : clipRect.x}
      clipY={clipFunc ? undefined : clipRect.y}
      clipWidth={clipFunc ? undefined : clipRect.w}
      clipHeight={clipFunc ? undefined : clipRect.h}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onReset}
      onDblTap={onReset}
    >
      <KonvaImage
        ref={ref}
        id={el.id}
        name="element"
        image={image}
        x={imgX}
        y={imgY}
        width={dw}
        height={dh}
        draggable={selected}
        dragBoundFunc={(pos) => {
          const node = ref.current
          const t = node?.getParent()?.getAbsoluteTransform().copy()
          if (!t) return pos
          const local = t.copy().invert().point(pos)
          const bounds = getClipBounds(cell, rect)
          const minX = Math.min(bounds.x, bounds.x + bounds.w - dw)
          const maxX = Math.max(bounds.x, bounds.x + bounds.w - dw)
          const minY = Math.min(bounds.y, bounds.y + bounds.h - dh)
          const maxY = Math.max(bounds.y, bounds.y + bounds.h - dh)
          const lx = clamp(local.x, minX, maxX)
          const ly = clamp(local.y, minY, maxY)
          return t.point({ x: lx, y: ly })
        }}
        onDragMove={(e) => commitPan(e.target as Konva.Image)}
        onDragEnd={(e) => commitPan(e.target as Konva.Image)}
      />
      {el.filters.vignette > 0 && (
        <Rect
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          listening={false}
          fillRadialGradientStartPoint={{ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }}
          fillRadialGradientEndPoint={{ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }}
          fillRadialGradientStartRadius={Math.min(rect.w, rect.h) * 0.3}
          fillRadialGradientEndRadius={Math.max(rect.w, rect.h) * 0.72}
          fillRadialGradientColorStops={[
            0,
            'rgba(0,0,0,0)',
            1,
            `rgba(0,0,0,${el.filters.vignette})`,
          ]}
        />
      )}
    </Group>
  )
}

/** Dashed "＋" drop target. Tapping it opens the photo picker for this cell. */
function EmptyCell({
  cell,
  rect,
  radius,
  onPick,
}: {
  cell: GridCell
  rect: { x: number; y: number; w: number; h: number }
  radius: number
  onPick?: () => void
}) {
  const [hot, setHot] = useState(false)
  const corner =
    cell.shape === 'rounded-rect'
      ? (cell.cornerRadius ?? radius)
      : cell.shape === 'rect' || cell.shape == null
        ? Math.max(4, radius)
        : 0
  return (
    <Group clipFunc={getClipFunc(cell, rect, radius)}>
      <Rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill={hot ? '#d5d9e0' : '#e5e7eb'}
        cornerRadius={corner}
        dash={[12, 8]}
        stroke={hot ? '#6366f1' : '#9ca3af'}
        strokeWidth={2}
        listening={!!onPick}
        onClick={onPick}
        onTap={onPick}
        onMouseEnter={() => setHot(true)}
        onMouseLeave={() => setHot(false)}
        onTouchStart={() => setHot(true)}
        onTouchEnd={() => setHot(false)}
      />
      <Text
        x={rect.x}
        y={rect.y + rect.h / 2 - 24}
        width={rect.w}
        align="center"
        text="＋"
        fontSize={48}
        fill={hot ? '#6366f1' : '#9ca3af'}
        listening={false}
      />
    </Group>
  )
}

export function GridView({
  layout,
  photos,
  width,
  height,
  gap,
  radius,
  selectedId,
  onSelect,
  onUpdate,
  onEmptyCell,
}: {
  layout: GridLayout
  photos: PhotoElement[]
  width: number
  height: number
  gap: number
  radius: number
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<PhotoElement>) => void
  onEmptyCell?: (index: number) => void
}) {
  const slots = assignSlots(layout.cells.length, photos)
  return (
    <>
      {layout.cells.map((cell, i) => {
        const rect = cellRect(cell, width, height, gap)
        const photo = slots[i]
        const isSelected = photo && photo.id === selectedId
        return (
          <Group key={i}>
            {photo ? (
              <CellPhoto
                el={photo}
                cell={cell}
                rect={rect}
                radius={radius}
                selected={!!isSelected}
                onSelect={() => onSelect(photo.id)}
                onPan={(pan) => onUpdate(photo.id, { cellPan: pan })}
                onReset={() =>
                  onUpdate(photo.id, { cellZoom: 1, cellPan: { x: 0, y: 0 } })
                }
              />
            ) : (
              <EmptyCell
                cell={cell}
                rect={rect}
                radius={radius}
                onPick={onEmptyCell ? () => onEmptyCell(i) : undefined}
              />
            )}
            {isSelected && (
              <Group clipFunc={getClipFunc(cell, rect, radius)}>
                <Rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  cornerRadius={
                    cell.shape === 'rounded-rect'
                      ? (cell.cornerRadius ?? radius)
                      : cell.shape === 'rect'
                        ? radius
                        : 0
                  }
                  stroke="#6366f1"
                  strokeWidth={6}
                  listening={false}
                />
              </Group>
            )}
          </Group>
        )
      })}
    </>
  )
}
