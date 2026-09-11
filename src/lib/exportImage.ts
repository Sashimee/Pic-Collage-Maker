import type Konva from 'konva'

export type ExportFormat = 'png' | 'jpg' | 'webp'

export type ExportPreset =
  | 'original'
  | 'instagram-square'
  | 'instagram-portrait'
  | 'instagram-story'
  | 'a4'

const PRESET_DIMS: Record<ExportPreset, { width: number; height: number }> = {
  original: { width: 0, height: 0 }, // use board dimensions
  'instagram-square': { width: 1080, height: 1080 },
  'instagram-portrait': { width: 1080, height: 1350 },
  'instagram-story': { width: 1080, height: 1920 },
  a4: { width: 2480, height: 3508 },
}

export interface WatermarkSettings {
  enabled: boolean
  text: string
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  opacity: number
  fontSize: number
  color: string
}

export interface PrintSettings {
  enabled: boolean
  bleedMarks: boolean
  cropMarks: boolean
}

// Render the collage board to a data URL at full board resolution,
// with optional format, quality, and platform preset.
export function exportBoard(
  board: Konva.Group,
  boardWidth: number,
  boardHeight: number,
  format: ExportFormat,
  options: {
    quality?: number
    preset?: ExportPreset
    pixelRatio?: number
    watermark?: WatermarkSettings
    print?: PrintSettings
  } = {},
): string {
  const { quality = 0.92, preset = 'original', pixelRatio = 2 } = options
  const dims = PRESET_DIMS[preset]

  const prev = {
    x: board.x(),
    y: board.y(),
    scaleX: board.scaleX(),
    scaleY: board.scaleY(),
    rotation: board.rotation(),
  }
  board.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 })

  const mimeType = mimeFor(format)

  // If preset has explicit dimensions, export at that size (cropping/centering)
  const exportW = dims.width > 0 ? dims.width : boardWidth
  const exportH = dims.height > 0 ? dims.height : boardHeight

  const rect = { x: 0, y: 0, width: exportW, height: exportH, pixelRatio }
  const needsPost = options.watermark?.enabled || options.print?.enabled

  // Watermark and print marks are painted on top of the rendered board. Take a
  // *canvas* for that, not a data URL: a data URL has to go back through an
  // `Image` to be drawable, and image decoding is asynchronous even for a
  // same-origin data URL — `drawImage` on a not-yet-complete image silently
  // draws nothing, which is how every watermarked export came out blank with
  // only the watermark on it. `toCanvas()` hands back drawable pixels directly.
  const url = needsPost
    ? applyPostProcess(
        board.toCanvas(rect),
        options.watermark,
        options.print,
        format,
        quality,
      )
    : board.toDataURL({ ...rect, mimeType, quality })

  board.setAttrs(prev)
  return url
}

function mimeFor(format: ExportFormat) {
  return format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg'
}

/**
 * Paint the watermark and print marks over a rendered board and encode it.
 *
 * Exported so the off-screen page renderer can use the same one: a second
 * implementation would drift, and a book or a shared page that quietly dropped
 * the user's watermark is exactly the kind of silent difference nobody notices
 * until it is published. Takes a *canvas* rather than a data URL for the reason
 * given at the call site in `exportBoard`.
 */
export function applyPostProcess(
  canvas: HTMLCanvasElement,
  watermark?: WatermarkSettings,
  print?: PrintSettings,
  format: ExportFormat = 'png',
  quality = 0.92,
): string {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.toDataURL(mimeFor(format), quality)

  // Konva leaves a scale(pixelRatio) transform on the context it rendered
  // through (Canvas.setWidth/setHeight), but the overlays below are written in
  // device pixels against canvas.width/height. Drop back to identity so they
  // land where they should instead of pixelRatio× too far out.
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  if (print?.enabled) {
    applyPrintEffects(ctx, canvas.width, canvas.height, print)
  }

  if (watermark?.enabled && watermark.text) {
    drawWatermark(ctx, canvas.width, canvas.height, watermark)
  }

  return canvas.toDataURL(mimeFor(format), quality)
}

function applyPrintEffects(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  print: PrintSettings,
) {
  // CMYK-like simulation: reduce saturation ~30% via filter, then subtle color shift
  ctx.save()
  ctx.globalCompositeOperation = 'saturation'
  ctx.fillStyle = `rgba(128,128,128,${0.3})`
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  // Subtle warm/cool shift to simulate ink absorption
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, 'rgba(255, 240, 220, 0.08)')
  gradient.addColorStop(1, 'rgba(220, 240, 255, 0.06)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  // Approx 3mm in pixels at 300dpi ≈ 35px; scale relative to export resolution
  const mm3 = Math.max(12, Math.round(Math.min(width, height) * 0.016))

  ctx.save()
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = Math.max(1, Math.round(mm3 / 6))

  if (print.bleedMarks) {
    // Bleed border: rectangle inset by 3mm from edges
    const inset = mm3
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2)
  }

  if (print.cropMarks) {
    const cross = mm3 * 1.5
    const offset = mm3 * 0.5
    // Top-left corner
    ctx.beginPath()
    ctx.moveTo(offset, cross)
    ctx.lineTo(offset, offset)
    ctx.lineTo(cross, offset)
    ctx.stroke()
    // Top-right corner
    ctx.beginPath()
    ctx.moveTo(width - cross, offset)
    ctx.lineTo(width - offset, offset)
    ctx.lineTo(width - offset, cross)
    ctx.stroke()
    // Bottom-right corner
    ctx.beginPath()
    ctx.moveTo(width - offset, height - cross)
    ctx.lineTo(width - offset, height - offset)
    ctx.lineTo(width - cross, height - offset)
    ctx.stroke()
    // Bottom-left corner
    ctx.beginPath()
    ctx.moveTo(cross, height - offset)
    ctx.lineTo(offset, height - offset)
    ctx.lineTo(offset, height - cross)
    ctx.stroke()
  }

  ctx.restore()
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  watermark: WatermarkSettings,
) {
  const { text, position, opacity, fontSize, color } = watermark
  if (!text) return

  const padding = Math.round(Math.min(width, height) * 0.03)
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'

  const metrics = ctx.measureText(text)
  const tw = metrics.width
  const th = fontSize // approximate height

  let x = padding
  let y = padding + th / 2

  switch (position) {
    case 'top-left':
      x = padding
      y = padding + th / 2
      break
    case 'top-right':
      x = width - padding - tw
      y = padding + th / 2
      break
    case 'bottom-left':
      x = padding
      y = height - padding - th / 2
      break
    case 'bottom-right':
      x = width - padding - tw
      y = height - padding - th / 2
      break
    case 'center':
      x = width / 2 - tw / 2
      y = height / 2
      break
  }

  // Subtle shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = Math.max(4, fontSize / 4)
  ctx.shadowOffsetX = 1
  ctx.shadowOffsetY = 1

  ctx.fillText(text, x, y)
  ctx.restore()
}

function dataURLToBlob(dataURL: string): Blob {
  const [head, body] = dataURL.split(',')
  const mime = head.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function downloadDataURL(
  dataURL: string,
  format: ExportFormat,
  filename?: string,
): void {
  const blob = dataURLToBlob(dataURL)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    filename || `collage-${Date.now()}.${format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpg'}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function canShareImage(): boolean {
  // Check the members are actually callable — `'canShare' in navigator` is true
  // even when the property exists but is undefined, which would wrongly report
  // support (and then throw when invoked).
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function'
  )
}

/**
 * `'cancelled'` has to be its own outcome. Folding it into a plain `false`
 * makes "the user tapped cancel" look identical to "this browser cannot
 * share" — and the caller's fallback then downloads the file anyway, which is
 * the opposite of what cancelling means.
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported'

/** The extension a format is saved and shared under. */
export const extFor = (format: ExportFormat) =>
  format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpg'

/**
 * Name the file for page `index` of `total`.
 *
 * One page stays `collage.jpg` — the name it has always had. Several are
 * numbered, because a share target showing three files called `collage.jpg`
 * tells the user nothing about which is which.
 */
export const shareFileName = (format: ExportFormat, index = 0, total = 1) =>
  total > 1 ? `collage-${index + 1}.${extFor(format)}` : `collage.${extFor(format)}`

/**
 * The public address of the app.
 *
 * Read off the page it is actually served from (origin + Vite base), so a
 * renamed repo or a custom domain needs no edit here. Only local dev and
 * `file:` builds — where the real address is unknowable — fall back to the
 * published URL, because a share reading `http://localhost:5173/` helps nobody.
 */
const PUBLISHED_URL = 'https://sashimee.github.io/Pic-Collage-Maker/'

export function appUrl(): string {
  try {
    const { origin, protocol } = window.location
    const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(origin)
    if (/^https?:$/.test(protocol) && !local) {
      return new URL(import.meta.env.BASE_URL || '/', origin).href
    }
  } catch {
    /* no window (SSR/tests) — fall through to the published URL */
  }
  return PUBLISHED_URL
}

/**
 * The text that rides along with every share: the caller's caption, then the
 * link back to the app. The link is not optional — it is the only thing that
 * lets someone who sees a collage find out what made it.
 */
export function buildShareText(caption?: string): string {
  const trimmed = caption?.trim()
  return trimmed ? `${trimmed} ${appUrl()}` : appUrl()
}

/**
 * Share one or more images through the Web Share API.
 *
 * The `canShare` probe uses the **whole** array: a target can accept one file
 * and reject several, and probing with one would sail past that and then throw
 * at `share()` time. Rejection is reported as `'unsupported'` so the caller
 * falls back to saving *every* page — sharing just the first would be the
 * multi-page bug all over again, only quieter.
 *
 * See ShareOutcome: only 'unsupported' should send the caller to a download.
 */
export async function shareImages(
  dataURLs: string[],
  format: ExportFormat,
  title = 'My Collage',
  caption?: string,
): Promise<ShareOutcome> {
  if (!canShareImage() || !dataURLs.length) return 'unsupported'
  const files = dataURLs.map((dataURL, i) => {
    const blob = dataURLToBlob(dataURL)
    return new File([blob], shareFileName(format, i, dataURLs.length), { type: blob.type })
  })
  const payload: ShareData = { files, title, text: buildShareText(caption) }
  if (!navigator.canShare(payload)) {
    // A target that takes the files but not the accompanying text is still a
    // working share — drop the text rather than the picture.
    if (!navigator.canShare({ files })) return 'unsupported'
    delete payload.text
  }
  try {
    await navigator.share(payload)
    return 'shared'
  } catch (err) {
    // Every browser reports a dismissed share sheet as AbortError.
    return err instanceof DOMException && err.name === 'AbortError'
      ? 'cancelled'
      : 'unsupported'
  }
}

/** Share a single image. Kept as the one-item case of `shareImages`. */
export async function shareDataURL(
  dataURL: string,
  format: ExportFormat,
  title = 'My Collage',
  caption?: string,
): Promise<ShareOutcome> {
  return shareImages([dataURL], format, title, caption)
}
