import { useEffect, useRef } from 'react'
import {
  Group,
  Image as KonvaImage,
  Line,
  Path,
  Rect,
  RegularPolygon,
  Shape,
  Star,
  Text as KonvaText,
  Arrow,
} from 'react-konva'
import Konva from 'konva'
import type {
  CanvasElement,
  DrawingElement,
  PhotoElement,
  ShapeElement,
  StickerElement,
} from '../types'
import { useImage } from '../hooks/useImage'
import { useEditor } from '../store/editorStore'
import { tracePhotoFrame, traceRoundRect } from '../lib/shapes'
import { SHADOW_OPACITY, resolveStyling } from '../lib/photoStyling'
import { computeFilterConfig, computeFilterConfigFromStack } from '../lib/filters'
import { cropBasisScale, scaleCrop, straightenScale } from '../lib/photoCrop'
import { commonHandlers, lockProps, toBlend, type NodeProps } from './nodes/shared'
import { TextNode } from './nodes/TextNode'

const EMPTY_RECT = { x: 0, y: 0, width: 0, height: 0 }

// Konva measures a container by its children and ignores its clip, so a
// straightened photo would report its rotated, enlarged bounds and the
// Transformer, snapping and align would all use those. The empty-rect sibling
// above stands in for the frame; the clipped image reports nothing.
function measureAsEmpty(node: Konva.Group | null) {
  if (node) node.getClientRect = () => EMPTY_RECT
}

function PhotoNode({ el, onSelect, onChange, onDragMove }: NodeProps<PhotoElement>) {
  const exporting = useEditor((s) => s.exporting)
  const displaySrc = exporting
    ? (el.originalSrc ?? el.previewSrc ?? el.src)
    : (el.previewSrc ?? el.src)
  const drawn = useImage(displaySrc)
  const basis = useImage(el.crop && displaySrc !== el.src ? el.src : '')
  const k = drawn?.src === el.src ? 1 : cropBasisScale(drawn, basis)
  const image = el.crop && k === null ? undefined : drawn
  const crop = el.crop && k !== null ? scaleCrop(el.crop, k) : el.crop
  const ref = useRef<Konva.Image>(null)
  const shape = el.shape ?? 'rect'
  const tilt = el.straighten ?? 0
  const cover = straightenScale(tilt, el.width, el.height)

  useEffect(() => {
    const node = ref.current
    if (!node || !image) return
    const cfg = el.filterStack
      ? computeFilterConfigFromStack(el.filterStack)
      : computeFilterConfig(el.filters)
    // The cache is sized to the node's own frame; a straightened photo is drawn
    // `cover` times larger than that, so the cache needs as many more pixels.
    node.cache(cover > 1 ? { pixelRatio: Konva.pixelRatio * cover } : undefined)
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
  }, [image, el.filters, el.filterStack, crop?.x, crop?.y, crop?.width, crop?.height, el.width, el.height, cover])

  const v = el.filters.vignette
  const { radius, border, shadow, card } = resolveStyling(el)
  const traceFrame = (ctx: Konva.Context) =>
    tracePhotoFrame(ctx, shape, el.width, el.height, radius)
  const traceOutline = (ctx: Konva.Context) =>
    card
      ? traceRoundRect(ctx, card.x, card.y, card.width, card.height, card.radius)
      : traceFrame(ctx)

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
      {...lockProps(el)}
      onClick={(e) => onSelect(e)}
      onTap={(e) => onSelect(e)}
      {...commonHandlers(onChange, onDragMove)}
    >
      <Rect width={el.width} height={el.height} listening={false} />
      {shadow && (
        // Snapping and marquee hits measure with the shadow; it must not widen the photo.
        <Group ref={measureAsEmpty} listening={false}>
          <Shape
            sceneFunc={(ctx, node) => {
              // The fill only casts the shadow; clipping it away keeps it from
              // showing through a cut-out or semi-transparent photo.
              const pad = el.width + el.height + shadow.blur + shadow.offset
              ctx.save()
              traceOutline(ctx)
              ctx.rect(-pad, -pad, el.width + 2 * pad, el.height + 2 * pad)
              ctx.clip('evenodd')
              traceOutline(ctx)
              ctx.fillShape(node)
              ctx.restore()
            }}
            fill="#ffffff"
            shadowColor={shadow.color}
            shadowBlur={shadow.blur}
            shadowOffsetY={shadow.offset}
            shadowOpacity={SHADOW_OPACITY}
          />
        </Group>
      )}
      {card && (
        // Measured like the photo, so snapping, the transformer and align agree on its edges.
        <Group ref={measureAsEmpty}>
          <Rect
            x={card.x}
            y={card.y}
            width={card.width}
            height={card.height}
            cornerRadius={card.radius}
            fill="#ffffff"
          />
        </Group>
      )}
      <Group clipFunc={shape !== 'rect' || radius > 0 || border ? traceFrame : undefined}>
        <Group
          clipWidth={tilt ? el.width : undefined}
          clipHeight={tilt ? el.height : undefined}
          ref={measureAsEmpty}
        >
          <KonvaImage
            ref={ref}
            image={image}
            width={el.width}
            height={el.height}
            crop={crop}
            x={el.width / 2}
            y={el.height / 2}
            offsetX={el.width / 2}
            offsetY={el.height / 2}
            rotation={tilt}
            scaleX={(el.flipX ? -1 : 1) * cover}
            scaleY={(el.flipY ? -1 : 1) * cover}
          />
        </Group>
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
        {border && (
          // Twice the width, half of it clipped away: the border sits inside the frame.
          <Shape
            sceneFunc={(ctx, node) => {
              traceFrame(ctx)
              ctx.strokeShape(node)
            }}
            stroke={border.color}
            strokeWidth={border.width * 2}
            listening={false}
          />
        )}
      </Group>
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
      {...lockProps(el)}
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
      {...lockProps(el)}
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
    ...lockProps(el),
    onClick: onSelect,
    onTap: onSelect,
    ...commonHandlers(onChange, onDragMove),
  }

  const shapeProps = {
    fill: el.fill,
    stroke: el.strokeWidth ? el.stroke : undefined,
    strokeWidth: el.strokeWidth ?? 0,
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
  if (el.hidden) return null
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
