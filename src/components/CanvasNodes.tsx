import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Group,
  Image as KonvaImage,
  Line,
  Path,
  Rect,
  RegularPolygon,
  Star,
  Text as KonvaText,
  TextPath,
  Arrow,
} from 'react-konva'
import type Konva from 'konva'
import type {
  BaseElement,
  CanvasElement,
  DrawingElement,
  PhotoElement,
  ShapeElement,
  StickerElement,
  TextElement,
} from '../types'
import { useImage } from '../hooks/useImage'
import { useEditor } from '../store/editorStore'
import { computeFilterConfig, computeFilterConfigFromStack } from '../lib/filters'
import { tracePhotoShape } from '../lib/shapes'

function toBlend(mode: BaseElement['blendMode']): Konva.NodeConfig['globalCompositeOperation'] {
  return !mode || mode === 'normal' ? 'source-over' : mode
}

interface NodeProps<T extends CanvasElement> {
  el: T
  onSelect: (e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  onChange: (patch: Partial<CanvasElement>) => void
  onEditText?: (id: string) => void
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void
}

// Shared transform → store bridge. We keep scaleX/scaleY on the node (rather
// than baking size) so a single Transformer works uniformly for every type.
function commonHandlers(
  onChange: (patch: Partial<CanvasElement>) => void,
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void,
): {
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void
} {
  return {
    onDragMove: (e) => {
      onDragMove?.(e)
    },
    onDragEnd: (e) => onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e) => {
      const node = e.target
      onChange({
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      })
    },
  }
}

function PhotoNode({ el, onSelect, onChange, onDragMove }: NodeProps<PhotoElement>) {
  const exporting = useEditor((s) => s.exporting)
  const displaySrc = exporting
    ? (el.originalSrc ?? el.previewSrc ?? el.src)
    : (el.previewSrc ?? el.src)
  const image = useImage(displaySrc)
  const ref = useRef<Konva.Image>(null)
  const shape = el.shape ?? 'rect'

  useEffect(() => {
    const node = ref.current
    if (!node || !image) return
    const cfg = el.filterStack
      ? computeFilterConfigFromStack(el.filterStack)
      : computeFilterConfig(el.filters)
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
  }, [image, el.filters, el.filterStack, el.crop, el.width, el.height])

  const v = el.filters.vignette

  return (
    <Group
      id={el.id}
      name="element"
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      scaleX={el.scaleX}
      scaleY={el.scaleY}
      opacity={el.opacity ?? 1}
      globalCompositeOperation={toBlend(el.blendMode)}
      draggable
      onClick={(e) => onSelect(e)}
      onTap={(e) => onSelect(e)}
      clipFunc={
        shape !== 'rect'
          ? (ctx) => tracePhotoShape(ctx, shape, el.width, el.height)
          : undefined
      }
      {...commonHandlers(onChange, onDragMove)}
    >
      <KonvaImage
        ref={ref}
        image={image}
        width={el.width}
        height={el.height}
        crop={el.crop}
      />
      {v > 0 && (
        <Rect
          width={el.width}
          height={el.height}
          listening={false}
          fillRadialGradientStartPoint={{ x: el.width / 2, y: el.height / 2 }}
          fillRadialGradientEndPoint={{ x: el.width / 2, y: el.height / 2 }}
          fillRadialGradientStartRadius={Math.min(el.width, el.height) * 0.3}
          fillRadialGradientEndRadius={Math.max(el.width, el.height) * 0.72}
          fillRadialGradientColorStops={[0, 'rgba(0,0,0,0)', 1, `rgba(0,0,0,${v})`]}
        />
      )}
    </Group>
  )
}

// ---- Text helpers ---------------------------------------------------------

function measureText(text: string, fontSize: number, fontFamily: string, fontStyle: string): number {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`
  return ctx.measureText(text).width
}

function parsePathData(d: string): { type: string; vals: number[] }[] {
  const cmds: { type: string; vals: number[] }[] = []
  const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(d)) !== null) {
    const type = m[1]
    const vals = m[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    cmds.push({ type, vals })
  }
  return cmds
}

function getPathPoint(
  cmds: { type: string; vals: number[] }[],
  t: number,
): { x: number; y: number; angle: number } {
  // Very simplified: assume a single cubic bezier (C) or quadratic (Q) or line (L)
  // For text-on-path we only support arch/circle/wave presets which are single curves.
  const total = cmds.length
  const idx = Math.min(Math.floor(t * total), total - 1)
  const subT = t * total - idx
  const cmd = cmds[idx]
  if (!cmd) return { x: 0, y: 0, angle: 0 }

  const { type, vals } = cmd
  if (type === 'C' && vals.length >= 6) {
    const [x0, y0, x1, y1, x2, y2] = vals
    const mt = 1 - subT
    const x = mt * mt * mt * 0 + 3 * mt * mt * subT * x0 + 3 * mt * subT * subT * x1 + subT * subT * subT * x2
    const y = mt * mt * mt * 0 + 3 * mt * mt * subT * y0 + 3 * mt * subT * subT * y1 + subT * subT * subT * y2
    // tangent
    const tx = 3 * mt * mt * x0 + 6 * mt * subT * (x1 - x0) + 3 * subT * subT * (x2 - x1)
    const ty = 3 * mt * mt * y0 + 6 * mt * subT * (y1 - y0) + 3 * subT * subT * (y2 - y1)
    return { x, y, angle: Math.atan2(ty, tx) * (180 / Math.PI) }
  }
  if (type === 'Q' && vals.length >= 4) {
    const [x0, y0, x1, y1] = vals
    const mt = 1 - subT
    const x = mt * mt * 0 + 2 * mt * subT * x0 + subT * subT * x1
    const y = mt * mt * 0 + 2 * mt * subT * y0 + subT * subT * y1
    const tx = 2 * mt * (x0 - 0) + 2 * subT * (x1 - x0)
    const ty = 2 * mt * (y0 - 0) + 2 * subT * (y1 - y0)
    return { x, y, angle: Math.atan2(ty, tx) * (180 / Math.PI) }
  }
  if (type === 'L' && vals.length >= 2) {
    const [x1, y1] = vals
    return { x: x1 * subT, y: y1 * subT, angle: Math.atan2(y1, x1) * (180 / Math.PI) }
  }
  return { x: vals[0] ?? 0, y: vals[1] ?? 0, angle: 0 }
}

function TextNode({ el, onSelect, onChange, onEditText, onDragMove }: NodeProps<TextElement>) {
  const textRef = useRef<Konva.Text>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const curve = el.curve ?? 0

  useLayoutEffect(() => {
    const n = textRef.current
    if (n) setDims({ w: n.width(), h: n.height() })
  }, [el.text, el.fontSize, el.fontFamily, el.fontStyle, el.strokeWidth, el.spans])

  const basePaint = {
    fontFamily: el.fontFamily,
    fontSize: el.fontSize,
    fontStyle: el.fontStyle,
    fill: el.fill,
    stroke: el.strokeWidth ? el.stroke : undefined,
    strokeWidth: el.strokeWidth ?? 0,
    fillAfterStrokeEnabled: true,
    shadowColor: el.shadowBlur ? el.shadowColor : undefined,
    shadowBlur: el.shadowBlur ?? 0,
    shadowOpacity: el.shadowBlur ? 0.85 : 0,
    width: el.width,
    lineHeight: el.lineHeight ?? 1.2,
    align: el.align ?? 'left',
  }

  const chip = el.chip
  const bow = `M 0 0 Q ${dims.w / 2} ${-curve * 2} ${dims.w} 0`

  const hasPath = !!el.path && el.path.length > 0
  const hasSpans = !!el.spans && el.spans.length > 0

  // ---- Path-based character rendering -------------------------------------
  const pathChars = (() => {
    if (!hasPath) return null
    const str = el.text
    const cmds = parsePathData(el.path!)
    if (!cmds.length) return null
    const chars = str.split('')
    return chars.map((ch, i) => {
      const t = chars.length > 1 ? i / (chars.length - 1) : 0
      const pt = getPathPoint(cmds, t)
      return { ch, x: pt.x, y: pt.y, rotation: pt.angle }
    })
  })()

  // ---- Span offsets (single line) -----------------------------------------
  const spanLayout = (() => {
    if (!hasSpans) return null
    let offsetX = 0
    return el.spans!.map((span) => {
      const fs = span.fontSize ?? el.fontSize
      const style = [
        span.bold ? 'bold' : '',
        span.italic ? 'italic' : '',
      ]
        .filter(Boolean)
        .join(' ') || 'normal'
      const w = measureText(span.text, fs, el.fontFamily, style || el.fontStyle)
      const item = { x: offsetX, w, span }
      offsetX += w
      return item
    })
  })()

  // ---- Effects layers -----------------------------------------------------
  const glow = el.effects?.glow
  const extrude = el.effects?.extrude
  const gradient = el.effects?.gradient

  const renderEffects = (content: React.ReactNode) => {
    if (!glow && !extrude) return content
    const layers: React.ReactNode[] = []
    if (glow) {
      const count = 4
      for (let i = 0; i < count; i++) {
        const offset = (i - count / 2) * (glow.blur / count)
        layers.push(
          <Group key={`glow-${i}`} x={offset} y={offset} opacity={0.35}>
            {content}
          </Group>,
        )
      }
    }
    if (extrude) {
      for (let d = 1; d <= extrude.depth; d++) {
        layers.push(
          <Group key={`ext-${d}`} x={d} y={d} opacity={0.6}>
            {content}
          </Group>,
        )
      }
    }
    return (
      <>
        {layers}
        {content}
      </>
    )
  }

  const textContent = (() => {
    if (hasSpans && spanLayout) {
      return (
        <>
          {spanLayout.map((item, i) => {
            const s = item.span
            const style = [s.bold ? 'bold' : '', s.italic ? 'italic' : '']
              .filter(Boolean)
              .join(' ') || 'normal'
            const fillProps = gradient
              ? {
                  fillAfterStrokeEnabled: true,
                  fillLinearGradientStartPoint: { x: 0, y: 0 },
                  fillLinearGradientEndPoint: { x: item.w, y: 0 },
                  fillLinearGradientColorStops: gradient.stops
                    .flatMap((stop) => [stop.offset, stop.color]),
                }
              : { fill: s.fill ?? el.fill }
            return (
              <KonvaText
                key={i}
                x={item.x}
                text={s.text}
                fontFamily={el.fontFamily}
                fontSize={s.fontSize ?? el.fontSize}
                fontStyle={style}
                {...fillProps}
                stroke={el.strokeWidth ? el.stroke : undefined}
                strokeWidth={el.strokeWidth ?? 0}
                shadowColor={el.shadowBlur ? el.shadowColor : undefined}
                shadowBlur={el.shadowBlur ?? 0}
                shadowOpacity={el.shadowBlur ? 0.85 : 0}
                listening={false}
              />
            )
          })}
        </>
      )
    }

    if (hasPath && pathChars) {
      return (
        <>
          {pathChars.map((c, i) => {
            const fillProps = gradient
              ? {
                  fillAfterStrokeEnabled: true,
                  fillLinearGradientStartPoint: { x: 0, y: 0 },
                  fillLinearGradientEndPoint: { x: el.fontSize, y: 0 },
                  fillLinearGradientColorStops: gradient.stops
                    .flatMap((stop) => [stop.offset, stop.color]),
                }
              : { fill: el.fill }
            return (
              <KonvaText
                key={i}
                x={c.x}
                y={c.y}
                text={c.ch}
                rotation={c.rotation}
                fontFamily={el.fontFamily}
                fontSize={el.fontSize}
                fontStyle={el.fontStyle}
                {...fillProps}
                stroke={el.strokeWidth ? el.stroke : undefined}
                strokeWidth={el.strokeWidth ?? 0}
                shadowColor={el.shadowBlur ? el.shadowColor : undefined}
                shadowBlur={el.shadowBlur ?? 0}
                shadowOpacity={el.shadowBlur ? 0.85 : 0}
                listening={false}
              />
            )
          })}
        </>
      )
    }

    const fillProps = gradient
      ? {
          fillAfterStrokeEnabled: true,
          fillLinearGradientStartPoint: { x: 0, y: 0 },
          fillLinearGradientEndPoint: { x: el.width ?? dims.w, y: 0 },
          fillLinearGradientColorStops: gradient.stops
            .flatMap((stop) => [stop.offset, stop.color]),
        }
      : { fill: el.fill }

    return (
      <KonvaText
        ref={textRef}
        text={el.text}
        {...basePaint}
        {...fillProps}
      />
    )
  })()

  return (
    <Group
      id={el.id}
      name="element"
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      scaleX={el.scaleX}
      scaleY={el.scaleY}
      opacity={el.opacity ?? 1}
      globalCompositeOperation={toBlend(el.blendMode)}
      draggable
      onClick={(e) => onSelect(e)}
      onTap={(e) => onSelect(e)}
      onDblClick={() => onEditText?.(el.id)}
      onDblTap={() => onEditText?.(el.id)}
      {...commonHandlers(onChange, onDragMove)}
    >
      {chip && curve === 0 && !hasPath && dims.w > 0 && (
        <Rect
          x={-chip.padding}
          y={-chip.padding}
          width={dims.w + chip.padding * 2}
          height={dims.h + chip.padding * 2}
          fill={chip.color}
          cornerRadius={chip.radius}
          listening={false}
        />
      )}
      {renderEffects(textContent)}
      {curve > 0 && !hasPath && !hasSpans && dims.w > 0 && (
        <TextPath text={el.text} data={bow} {...basePaint} />
      )}
    </Group>
  )
}

function DrawingNode({ el, onSelect, onChange, onDragMove }: NodeProps<DrawingElement>) {
  return (
    <Line
      id={el.id}
      name="element"
      points={el.points}
      stroke={el.stroke}
      strokeWidth={el.strokeWidth}
      lineCap="round"
      lineJoin="round"
      tension={0.4}
      hitStrokeWidth={Math.max(el.strokeWidth, 20)}
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      scaleX={el.scaleX}
      scaleY={el.scaleY}
      opacity={el.opacity ?? 1}
      globalCompositeOperation={toBlend(el.blendMode)}
      draggable
      onClick={(e) => onSelect(e)}
      onTap={(e) => onSelect(e)}
      {...commonHandlers(onChange, onDragMove)}
    />
  )
}

function StickerNode({ el, onSelect, onChange, onDragMove }: NodeProps<StickerElement>) {
  return (
    <KonvaText
      id={el.id}
      name="element"
      text={el.emoji}
      fontSize={el.fontSize}
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      scaleX={el.scaleX}
      scaleY={el.scaleY}
      opacity={el.opacity ?? 1}
      globalCompositeOperation={toBlend(el.blendMode)}
      draggable
      onClick={(e) => onSelect(e)}
      onTap={(e) => onSelect(e)}
      {...commonHandlers(onChange, onDragMove)}
    />
  )
}

function ShapeNode({ el, onSelect, onChange, onDragMove }: NodeProps<ShapeElement>) {
  const common = {
    id: el.id,
    name: 'element',
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    scaleX: el.scaleX,
    scaleY: el.scaleY,
    opacity: el.opacity ?? 1,
    globalCompositeOperation: toBlend(el.blendMode),
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    ...commonHandlers(onChange, onDragMove),
  }

  const shapeProps = {
    fill: el.fill,
    stroke: el.strokeWidth ? el.stroke : undefined,
    strokeWidth: el.strokeWidth ?? 0,
    listening: true,
  }

  switch (el.shapeType) {
    case 'rect':
      return <Rect width={120} height={80} cornerRadius={8} {...common} {...shapeProps} />
    case 'circle':
      return <Rect width={100} height={100} cornerRadius={50} {...common} {...shapeProps} />
    case 'triangle':
      return (
        <RegularPolygon sides={3} radius={60} {...common} {...shapeProps} />
      )
    case 'star':
      return (
        <Star numPoints={5} innerRadius={25} outerRadius={55} {...common} {...shapeProps} />
      )
    case 'speech-bubble':
      return (
        <Path
          data={`M 0,40 Q 0,0 20,0 L 100,0 Q 120,0 120,20 L 120,60 Q 120,80 100,80 L 40,80 L 10,100 L 20,80 L 20,80 Q 0,80 0,60 Z`}
          {...common}
          {...shapeProps}
        />
      )
    case 'heart':
      return (
        <Path
          data={`M60,30 C60,10 40,0 30,10 C20,0 0,10 0,30 C0,50 30,70 30,70 C30,70 60,50 60,30 Z`}
          {...common}
          {...shapeProps}
        />
      )
    case 'arrow':
      return (
        <Arrow
          points={[0, 0, 120, 0]}
          pointerLength={el.arrowHead?.size ?? 12}
          pointerWidth={el.arrowHead?.size ?? 12}
          {...common}
          {...shapeProps}
        />
      )
    default:
      if (el.path) {
        return <Path data={el.path} {...common} {...shapeProps} />
      }
      return <Rect width={120} height={80} cornerRadius={8} {...common} {...shapeProps} />
  }
}

export function ElementNode({
  el,
  onSelect,
  onChange,
  onEditText,
  onDragMove,
}: {
  el: CanvasElement
  onSelect: (e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  onChange: (patch: Partial<CanvasElement>) => void
  onEditText?: (id: string) => void
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void
}) {
  switch (el.type) {
    case 'photo':
      return <PhotoNode el={el} onSelect={onSelect} onChange={onChange} onDragMove={onDragMove} />
    case 'text':
      return (
        <TextNode
          el={el}
          onSelect={onSelect}
          onChange={onChange}
          onEditText={onEditText}
          onDragMove={onDragMove}
        />
      )
    case 'sticker':
      return <StickerNode el={el} onSelect={onSelect} onChange={onChange} onDragMove={onDragMove} />
    case 'drawing':
      return <DrawingNode el={el} onSelect={onSelect} onChange={onChange} onDragMove={onDragMove} />
    case 'shape':
      return <ShapeNode el={el} onSelect={onSelect} onChange={onChange} onDragMove={onDragMove} />
    default:
      return null
  }
}
