import type { LoadedDocument } from '../store/editorStore'
import type { WatermarkSettings } from '../types'

export interface VideoFormat {
  mimeType: string
  extension: 'mp4' | 'webm'
}

// MP4 first: it is the one container iOS, Android and every desktop OS play
// natively, and Safari records nothing else. WebM is what older Chrome and
// Firefox can record; it plays on Android and desktop but not in iOS Photos.
const CANDIDATES: VideoFormat[] = [
  { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
]

export function pickVideoFormat(
  isTypeSupported: (mimeType: string) => boolean = (t) => MediaRecorder.isTypeSupported(t),
): VideoFormat | null {
  return CANDIDATES.find((c) => isTypeSupported(c.mimeType)) ?? null
}

export function canRecordVideo(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    pickVideoFormat() !== null
  )
}

export interface SlideshowOptions {
  secondsPerPage: number
  /** Crossfade into the next page over this many seconds; 0 cuts. */
  fadeSeconds: number
}

export const DEFAULT_SLIDESHOW: SlideshowOptions = { secondsPerPage: 3, fadeSeconds: 0.6 }
export const SECONDS_PER_PAGE = [2, 3, 5] as const

export function slideshowDuration(pageCount: number, { secondsPerPage }: SlideshowOptions): number {
  return pageCount * secondsPerPage
}

/**
 * What is on screen `t` seconds in: `page`, blended toward `next` by `mix`
 * (0..1). The fade takes the tail of each page's time, so the first page
 * starts sharp and the last one holds to the end.
 */
export function slideAt(
  t: number,
  pageCount: number,
  { secondsPerPage, fadeSeconds }: SlideshowOptions,
): { page: number; next: number; mix: number } {
  const last = pageCount - 1
  const page = Math.min(last, Math.max(0, Math.floor(t / secondsPerPage)))
  if (page === last || fadeSeconds <= 0) return { page, next: page, mix: 0 }
  const fade = Math.min(fadeSeconds, secondsPerPage)
  const into = t - page * secondsPerPage - (secondsPerPage - fade)
  return { page, next: page + 1, mix: into > 0 ? Math.min(1, into / fade) : 0 }
}

/** Long side of the video. 1080 is what phones record and share without re-encoding. */
const LONG_SIDE = 1080

/** The frame size for these pages: the first page's aspect, long side 1080, even sides for H.264. */
export function videoSize(pages: Pick<LoadedDocument, 'boardWidth' | 'boardHeight'>[]): {
  width: number
  height: number
} {
  const { boardWidth: w, boardHeight: h } = pages[0]
  const scale = LONG_SIDE / Math.max(w, h)
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2)
  return { width: even(w), height: even(h) }
}

function drawContained(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  alpha: number,
): void {
  const { width, height } = ctx.canvas
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale
  ctx.globalAlpha = alpha
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h)
}

export type SlideshowProgress =
  | { phase: 'render'; done: number; total: number }
  | { phase: 'record'; done: number; total: number }

export interface SlideshowHooks {
  onProgress?: (progress: SlideshowProgress) => void
  signal?: { cancelled: boolean }
  watermark?: WatermarkSettings
}

const FPS = 30

/**
 * Record decoded page images as a video, in real time: MediaRecorder encodes
 * what a canvas shows as it is drawn, which is the only encoder every phone
 * browser has without shipping one.
 */
export async function recordSlideshow(
  images: HTMLImageElement[],
  size: { width: number; height: number },
  options: SlideshowOptions,
  format: VideoFormat,
  hooks: Pick<SlideshowHooks, 'onProgress' | 'signal'> = {},
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('recordSlideshow: the browser gave no 2D canvas context.')

  const duration = slideshowDuration(images.length, options)
  const draw = (t: number) => {
    const { page, next, mix } = slideAt(t, images.length, options)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    drawContained(ctx, images[page], 1)
    if (mix > 0) drawContained(ctx, images[next], mix)
  }
  draw(0)

  const stream = canvas.captureStream(FPS)
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: 8_000_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  let failure: Error | null = null
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
    recorder.onerror = (e) => {
      failure = new Error(`MediaRecorder failed: ${String(e)}`)
      resolve()
    }
  })

  recorder.start()
  const started = performance.now()
  // A timer rather than requestAnimationFrame: rAF stops in a background tab,
  // which would leave the recorder running with a frozen frame forever.
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - started) / 1000
      if (hooks.signal?.cancelled || failure || t >= duration) {
        resolve()
        return
      }
      draw(t)
      hooks.onProgress?.({ phase: 'record', done: Math.floor(t), total: Math.ceil(duration) })
      setTimeout(tick, 1000 / FPS)
    }
    tick()
  })
  draw(duration)
  if (recorder.state !== 'inactive') recorder.stop()
  stream.getTracks().forEach((track) => track.stop())
  await stopped

  if (failure) throw failure
  if (hooks.signal?.cancelled) return null
  return new Blob(chunks, { type: format.mimeType.split(';')[0] })
}

async function decode(dataUrl: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  return image
}

/**
 * Render every page off-screen and record them as a slideshow. The renderer
 * (react-konva) loads lazily, like the photo book's.
 */
export async function buildSlideshow(
  pages: LoadedDocument[],
  options: SlideshowOptions,
  hooks: SlideshowHooks = {},
): Promise<{ blob: Blob; format: VideoFormat } | null> {
  if (!pages.length) return null
  const format = pickVideoFormat()
  if (!format) throw new Error('buildSlideshow: this browser can record no video format.')

  const size = videoSize(pages)
  const { renderPages } = await import('./renderPages')
  // Every page straight into the frame size, so a page whose board differs
  // from the first is fitted at full resolution rather than scaled up later.
  // Print marks stay off: they are for a printed sheet, not a video.
  const frames = await renderPages(pages, {
    width: size.width,
    height: size.height,
    format: 'jpeg',
    watermark: hooks.watermark,
    signal: hooks.signal,
    onProgress: (done, total) => hooks.onProgress?.({ phase: 'render', done, total }),
  })
  if (hooks.signal?.cancelled || frames.length < pages.length) return null

  const images = await Promise.all(frames.map(decode))
  if (hooks.signal?.cancelled) return null
  const blob = await recordSlideshow(images, size, options, format, hooks)
  return blob && { blob, format }
}

export function downloadVideo(blob: Blob, format: VideoFormat): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `slideshow-${Date.now()}.${format.extension}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Same deferral as the image and PDF downloads: revoking at once can race the save.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
