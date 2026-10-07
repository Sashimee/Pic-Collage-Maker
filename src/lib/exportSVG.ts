import type {
  CanvasElement,
  TextElement,
  ShapeElement,
  DrawingElement,
  StickerElement,
  PhotoElement,
  Background,
} from '../types'

/** Escape XML special characters for safe SVG text content. */
function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build a CSS transform string matching Konva's order: translate → rotate → scale. */
function buildTransform(el: {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}): string {
  const parts: string[] = []
  parts.push(`translate(${el.x.toFixed(2)}, ${el.y.toFixed(2)})`)
  if (el.rotation !== 0) {
    parts.push(`rotate(${el.rotation.toFixed(2)})`)
  }
  if (el.scaleX !== 1 || el.scaleY !== 1) {
    parts.push(`scale(${el.scaleX.toFixed(3)}, ${el.scaleY.toFixed(3)})`)
  }
  return parts.join(' ')
}

/** Render a TextElement as an SVG <text> (or <tspan>-wrapped) node. */
function textToSVG(el: TextElement): string {
  const attrs: Record<string, string> = {
    transform: buildTransform(el),
    fill: el.fill,
    'font-family': xmlEscape(el.fontFamily),
    'font-size': String(el.fontSize),
    'font-style': el.fontStyle.includes('italic') ? 'italic' : 'normal',
    'font-weight': el.fontStyle.includes('bold') ? 'bold' : 'normal',
    opacity: String(el.opacity ?? 1),
  }
  if (el.align) {
    attrs['text-anchor'] =
      el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'
  }
  if (el.strokeWidth && el.stroke) {
    attrs.stroke = el.stroke
    attrs['stroke-width'] = String(el.strokeWidth)
  }
  if (el.shadowBlur && el.shadowColor) {
    attrs.filter = `drop-shadow(0px 2px ${el.shadowBlur}px ${el.shadowColor})`
  }

  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')

  const lines = el.text.split('\n')
  const lineHeightPx = el.fontSize * (el.lineHeight ?? 1.2)

  if (lines.length === 1 && !(el.width && el.width > 0)) {
    return `<text ${attrStr}>${xmlEscape(el.text)}</text>`
  }

  // Multi-line / wrapped text using tspans
  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineHeightPx
      return `<tspan x="0" dy="${dy.toFixed(1)}">${xmlEscape(line)}</tspan>`
    })
    .join('')
  return `<text ${attrStr}>${tspans}</text>`
}

/** Render a DrawingElement as an SVG <path> from its flat point array. */
function drawingToSVG(el: DrawingElement): string {
  const pts = el.points
  if (pts.length < 4) return ''
  let d = `M ${pts[0].toFixed(2)} ${pts[1].toFixed(2)}`
  for (let i = 2; i < pts.length; i += 2) {
    d += ` L ${pts[i].toFixed(2)} ${pts[i + 1].toFixed(2)}`
  }
  const attrs: Record<string, string> = {
    transform: buildTransform(el),
    d,
    stroke: el.stroke,
    'stroke-width': String(el.strokeWidth),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    fill: 'none',
    opacity: String(el.opacity ?? 1),
  }
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
  return `<path ${attrStr} />`
}

/** Render a StickerElement as an SVG <text> (emoji). */
function stickerToSVG(el: StickerElement): string {
  const attrs: Record<string, string> = {
    transform: buildTransform(el),
    'font-size': String(el.fontSize),
    'font-family': 'apple color emoji, segoe ui emoji, noto color emoji, sans-serif',
    opacity: String(el.opacity ?? 1),
  }
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
  return `<text ${attrStr}>${xmlEscape(el.emoji)}</text>`
}

/** Render a PhotoElement as an SVG <image> with a clip-path if shape is not rect. */
function photoToSVG(el: PhotoElement): string {
  const clipId = el.shape && el.shape !== 'rect' ? `clip-${el.id}` : undefined
  const defs: string[] = []
  if (clipId) {
    const pathData = shapeClipPath(el.shape!, el.width, el.height)
    defs.push(
      `<clipPath id="${clipId}"><path d="${pathData}" /></clipPath>`,
    )
  }

  const attrs: Record<string, string> = {
    transform: buildTransform(el),
    href: el.src,
    width: String(el.width),
    height: String(el.height),
    opacity: String(el.opacity ?? 1),
  }
  if (clipId) {
    attrs['clip-path'] = `url(#${clipId})`
  }
  if (el.crop) {
    // SVG image does not natively support crop; approximate with a pattern if needed,
    // but for simplicity we rely on the underlying image already being cropped by Konva.
    // We preserve the full image here.
  }
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
  const imgTag = `<image ${attrStr} />`
  return defs.length > 0
    ? `<defs>${defs.join('')}</defs>${imgTag}`
    : imgTag
}

/** Produce an SVG clip-path `d` string for a given photo shape filling a w×h box. */
function shapeClipPath(
  shape: import('../types').PhotoShape,
  w: number,
  h: number,
): string {
  switch (shape) {
    case 'circle': {
      const rx = w / 2
      const ry = h / 2
      return `M ${w / 2},0 A ${rx},${ry} 0 0 1 ${w},${h / 2} A ${rx},${ry} 0 0 1 0,${h / 2} A ${rx},${ry} 0 0 1 ${w / 2},0 Z`
    }
    case 'star': {
      const cx = w / 2
      const cy = h / 2
      const outer = Math.min(w, h) / 2
      const inner = outer * 0.42
      const points = 5
      let d = ''
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner
        const a = (Math.PI / points) * i - Math.PI / 2
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r
        d += (i === 0 ? 'M ' : 'L ') + `${x.toFixed(2)},${y.toFixed(2)} `
      }
      return d + 'Z'
    }
    case 'heart': {
      // Simplified heart bezier path normalised to 0..w, 0..h
      return `M ${w * 0.5},${h * 0.2} C ${w * 0.85},${h * 0.05} ${w},${h * 0.3} ${w * 0.5},${h * 0.95} C 0,${h * 0.3} ${w * 0.15},${h * 0.05} ${w * 0.5},${h * 0.2} Z`
    }
    case 'arch': {
      return `M 0,${h} L ${w},${h} L ${w},${h * 0.6} A ${w / 2},${h * 0.6} 0 0 0 0,${h * 0.6} Z`
    }
    case 'diamond': {
      return `M ${w / 2},0 L ${w},${h / 2} L ${w / 2},${h} L 0,${h / 2} Z`
    }
    case 'cloud': {
      const r = Math.min(w, h) * 0.28
      const cx = w / 2
      const cy = h / 2
      const p1x = cx - w * 0.35
      const p2x = cx + w * 0.35
      return (
        `M ${p1x + r},${cy} A ${r},${r} 0 1 0 ${p1x - r},${cy} A ${r},${r} 0 0 0 ${p1x + r},${cy} ` +
        `M ${cx + r * 0.9},${cy - h * 0.15 + r * 0.9} A ${r * 0.9},${r * 0.9} 0 1 0 ${cx - r * 0.9},${cy - h * 0.15 + r * 0.9} A ${r * 0.9},${r * 0.9} 0 0 0 ${cx + r * 0.9},${cy - h * 0.15 + r * 0.9} ` +
        `M ${p2x + r},${cy} A ${r},${r} 0 1 0 ${p2x - r},${cy} A ${r},${r} 0 0 0 ${p2x + r},${cy} Z`
      )
    }
    case 'hexagon': {
      let d = ''
      const cx = w / 2
      const cy = h / 2
      const rx = w / 2
      const ry = h / 2
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2
        const x = cx + Math.cos(a) * rx
        const y = cy + Math.sin(a) * ry
        d += (i === 0 ? 'M ' : 'L ') + `${x.toFixed(2)},${y.toFixed(2)} `
      }
      return d + 'Z'
    }
    case 'triangle': {
      return `M ${w / 2},0 L ${w},${h} L 0,${h} Z`
    }
    case 'rect':
    default:
      return `M 0,0 L ${w},0 L ${w},${h} L 0,${h} Z`
  }
}

/** Render a ShapeElement as the corresponding SVG primitive. */
function shapeElementToSVG(el: ShapeElement): string {
  const commonAttrs: Record<string, string> = {
    transform: buildTransform(el),
    fill: el.fill,
    opacity: String(el.opacity ?? 1),
  }
  if (el.strokeWidth && el.stroke) {
    commonAttrs.stroke = el.stroke
    commonAttrs['stroke-width'] = String(el.strokeWidth)
  }

  const shapeTag = (tag: string, extra: Record<string, string> = {}): string => {
    const attrs = { ...commonAttrs, ...extra }
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ')
    return `<${tag} ${attrStr} />`
  }

  switch (el.shapeType) {
    case 'rect':
      return shapeTag('rect', {
        width: '120',
        height: '80',
        rx: '8',
      })
    case 'circle': {
      // Use a rect with high rx/ry to simulate a circle (matches Konva render size)
      return shapeTag('rect', {
        width: '100',
        height: '100',
        rx: '50',
        ry: '50',
      })
    }
    case 'triangle': {
      const pts = '60,0 120,104 0,104'
      return shapeTag('polygon', { points: pts })
    }
    case 'star': {
      // 5-point star path
      const cx = 55
      const cy = 55
      const outer = 55
      const inner = 23
      let d = ''
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner
        const a = (Math.PI / 5) * i - Math.PI / 2
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r
        d += (i === 0 ? 'M ' : 'L ') + `${x.toFixed(2)},${y.toFixed(2)} `
      }
      return shapeTag('path', { d: d + 'Z' })
    }
    case 'heart': {
      // Heart path scaled to roughly 60×70
      return shapeTag('path', {
        d:
          'M30,20 C50,0 70,20 30,60 C-10,20 10,0 30,20 Z',
      })
    }
    case 'speech-bubble': {
      return shapeTag('path', {
        d:
          'M0,40 Q0,0 20,0 L100,0 Q120,0 120,20 L120,60 Q120,80 100,80 L40,80 L10,100 L20,80 L20,80 Q0,80 0,60 Z',
      })
    }
    case 'arrow': {
      // Arrow as a path with a head
      const headSize = el.arrowHead?.size ?? 12
      return shapeTag('path', {
        d: `M0,0 L120,0 L${120 - headSize},-${headSize / 2} M120,0 L${120 - headSize},${headSize / 2}`,
        'marker-end': 'url(#arrowhead)',
        fill: 'none',
      })
    }
    default:
      if (el.path) {
        return shapeTag('path', { d: el.path })
      }
      return shapeTag('rect', { width: '120', height: '80', rx: '8' })
  }
}

/** Render a background as an SVG <rect> or <linearGradient>. */
function backgroundToSVG(
  bg: Background,
  width: number,
  height: number,
): string {
  if (bg.type === 'gradient') {
    const angleRad = (bg.gradientAngle * Math.PI) / 180
    const x1 = 50 - 50 * Math.cos(angleRad)
    const y1 = 50 - 50 * Math.sin(angleRad)
    const x2 = 50 + 50 * Math.cos(angleRad)
    const y2 = 50 + 50 * Math.sin(angleRad)
    return (
      `<defs>` +
      `<linearGradient id="bgGrad" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">` +
      `<stop offset="0%" stop-color="${bg.gradientFrom}"/>` +
      `<stop offset="100%" stop-color="${bg.gradientTo}"/>` +
      `</linearGradient>` +
      `</defs>` +
      `<rect width="${width}" height="${height}" fill="url(#bgGrad)"/>`
    )
  }
  if (bg.type === 'pattern') {
    // Fallback to solid color for pattern backgrounds in SVG (pattern generation is complex)
    return `<rect width="${width}" height="${height}" fill="${bg.color}"/>`
  }
  if (bg.type === 'photo' && bg.photoSrc) {
    return `<image href="${bg.photoSrc}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`
  }
  return `<rect width="${width}" height="${height}" fill="${bg.color}"/>`
}

/** Convert a flat list of elements into an ordered SVG string fragment. */
function elementsToSVG(elements: CanvasElement[]): string {
  const parts: string[] = []
  for (const el of elements) {
    if (el.hidden) continue
    const blended = !!el.blendMode && el.blendMode !== 'normal'
    if (blended) parts.push(`<g style="mix-blend-mode:${el.blendMode}">`)
    switch (el.type) {
      case 'text':
        parts.push(textToSVG(el))
        break
      case 'shape':
        parts.push(shapeElementToSVG(el))
        break
      case 'drawing':
        parts.push(drawingToSVG(el))
        break
      case 'sticker':
        parts.push(stickerToSVG(el))
        break
      case 'photo':
        parts.push(photoToSVG(el))
        break
      case 'group':
        // Flatten groups for SVG export
        parts.push(elementsToSVG(el.children))
        break
    }
    if (blended) parts.push('</g>')
  }
  return parts.join('\n')
}

export interface SVGExportOptions {
  includeBackground?: boolean
  title?: string
}

/** Export the current board as a complete SVG document string. */
export function exportSVG(
  elements: CanvasElement[],
  boardWidth: number,
  boardHeight: number,
  background: Background,
  options: SVGExportOptions = {},
): string {
  const { includeBackground = true, title = 'Pic Collage Export' } = options

  const bgLayer = includeBackground
    ? backgroundToSVG(background, boardWidth, boardHeight)
    : ''
  const content = elementsToSVG(elements)

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${boardWidth}" height="${boardHeight}" viewBox="0 0 ${boardWidth} ${boardHeight}" role="img" aria-label="${xmlEscape(title)}">
  ${bgLayer}
  ${content}
</svg>`

  return svg
}

/** Download an SVG string as a .svg file. */
export function downloadSVG(svgString: string, filename = `collage-${Date.now()}.svg`): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
