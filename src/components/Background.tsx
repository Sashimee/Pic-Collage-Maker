import { useMemo } from 'react'
import { Rect, Image as KonvaImage } from 'react-konva'
import type { Background as Bg } from '../types'
import { makePatternTile } from '../lib/patterns'
import { useImage } from '../hooks/useImage'

// The board background: a full-bleed rect, either a solid colour, a linear
// gradient computed from an angle, a repeating pattern, or a dimmed photo.
export function Background({
  bg,
  width,
  height,
}: {
  bg: Bg
  width: number
  height: number
}) {
  const patternTile = useMemo(
    () =>
      bg.type === 'pattern'
        ? makePatternTile(bg.patternId, bg.color, bg.patternColor)
        : null,
    [bg.type, bg.patternId, bg.color, bg.patternColor],
  )

  const photoImage = useImage(bg.type === 'photo' ? (bg.photoSrc ?? '') : '')

  if (bg.type === 'solid') {
    return (
      <Rect name="background" x={0} y={0} width={width} height={height} fill={bg.color} />
    )
  }

  if (bg.type === 'photo') {
    return photoImage ? (
      <KonvaImage
        name="background"
        x={0}
        y={0}
        width={width}
        height={height}
        image={photoImage}
        opacity={0.4}
      />
    ) : (
      <Rect name="background" x={0} y={0} width={width} height={height} fill={bg.color} />
    )
  }

  if (bg.type === 'pattern' && patternTile) {
    return (
      <Rect
        name="background"
        x={0}
        y={0}
        width={width}
        height={height}
        fillPatternImage={patternTile as unknown as HTMLImageElement}
        fillPatternRepeat="repeat"
      />
    )
  }

  const rad = (bg.gradientAngle * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const cx = width / 2
  const cy = height / 2
  const len = (Math.abs(width * dx) + Math.abs(height * dy)) / 2

  return (
    <Rect
      name="background"
      x={0}
      y={0}
      width={width}
      height={height}
      fillLinearGradientStartPoint={{ x: cx - dx * len, y: cy - dy * len }}
      fillLinearGradientEndPoint={{ x: cx + dx * len, y: cy + dy * len }}
      fillLinearGradientColorStops={[0, bg.gradientFrom, 1, bg.gradientTo]}
    />
  )
}
