import { enhancePixels, type EnhanceOptions } from '../ai/autoEnhance'
import { removeBackgroundPixels, type RemovalOptions } from '../ai/bgRemoval'
import { retouchPixels, type RetouchSettings } from '../ai/portraitRetouch'
import { stylePixels, type StyleId } from '../ai/styleTransfer'

export type PixelOp =
  | { op: 'enhance'; opts: EnhanceOptions }
  | { op: 'removeBg'; opts: RemovalOptions }
  | { op: 'style'; styleId: StyleId; intensity: number }
  | { op: 'retouch'; opts: Partial<RetouchSettings> }

export interface Output {
  type: string
  quality?: number
  /** Fit inside a square of this size; the source size when absent. */
  maxDim?: number
  /** Give `null` instead of an output no smaller than the source. */
  shrinkOnly?: boolean
}

export interface PixelJob {
  id: number
  blob: Blob
  op: PixelOp | null
  outputs: Output[]
}

export interface PixelResult {
  width: number
  height: number
  blobs: (Blob | null)[]
}

export type PixelReply = { id: number } & ({ ok: PixelResult } | { error: string })

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

function context(c: AnyCanvas) {
  const ctx = c.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new Error('2d canvas context unavailable')
  return ctx
}

function encode(c: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality })
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      type,
      quality,
    ),
  )
}

function applyOp(px: ImageData, op: PixelOp) {
  switch (op.op) {
    case 'enhance':
      return enhancePixels(px, op.opts)
    case 'removeBg':
      return removeBackgroundPixels(px, op.opts)
    case 'style':
      return stylePixels(px, op.styleId, op.intensity)
    case 'retouch':
      return retouchPixels(px, op.opts)
  }
}

/** Decode once, optionally run a pixel tool, and encode each requested output. Runs in the worker, or on the page when there is none. */
export async function processJob(job: Omit<PixelJob, 'id'>): Promise<PixelResult> {
  const bitmap = await createImageBitmap(job.blob, { imageOrientation: 'from-image' })
  const { width, height } = bitmap
  try {
    let source: CanvasImageSource = bitmap
    if (job.op) {
      const canvas = makeCanvas(width, height)
      const ctx = context(canvas)
      ctx.drawImage(bitmap, 0, 0)
      const px = ctx.getImageData(0, 0, width, height)
      applyOp(px, job.op)
      ctx.putImageData(px, 0, 0)
      source = canvas
    }
    const blobs = await Promise.all(
      job.outputs.map((out) => {
        const scale = out.maxDim ? out.maxDim / Math.max(width, height) : 1
        if (out.shrinkOnly && scale >= 1) return null
        const w = Math.max(1, Math.round(width * scale))
        const h = Math.max(1, Math.round(height * scale))
        const canvas = makeCanvas(w, h)
        context(canvas).drawImage(source, 0, 0, w, h)
        return encode(canvas, out.type, out.quality)
      }),
    )
    return { width, height, blobs }
  } finally {
    bitmap.close()
  }
}
