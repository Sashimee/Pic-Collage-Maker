import { useLayoutEffect, useRef, useState } from 'react'
import { Group, Rect, Text as KonvaText, TextPath } from 'react-konva'
import type Konva from 'konva'
import type { TextElement } from '../../types'
import { toBlend, commonHandlers, type NodeProps } from './shared'

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

export function TextNode({ el, onSelect, onChange, onEditText, onDragMove }: NodeProps<TextElement>) {
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
        visible={curve === 0}
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
