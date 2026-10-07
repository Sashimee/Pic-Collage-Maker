import type { Output, PixelJob, PixelOp, PixelReply, PixelResult } from './pixelJob'

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, { resolve: (r: PixelResult) => void; reject: (e: Error) => void }>()

const canUseWorker = () =>
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined' &&
  typeof createImageBitmap !== 'undefined'

function failAll(reason: string) {
  for (const job of pending.values()) job.reject(new Error(reason))
  pending.clear()
  worker?.terminate()
  worker = null
}

function getWorker(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('./pixel.worker.ts', import.meta.url), { type: 'module' })
  w.addEventListener('message', (e: MessageEvent<PixelReply>) => {
    const job = pending.get(e.data.id)
    if (!job) return
    pending.delete(e.data.id)
    if ('ok' in e.data) job.resolve(e.data.ok)
    else job.reject(new Error(`Pixel worker failed: ${e.data.error}`))
  })
  // A worker that dies (out of memory on a huge photo, say) answers nothing; fail what it held
  // and start a fresh one next time.
  w.addEventListener('error', (e) =>
    failAll(`Pixel worker crashed: ${e.message || 'it could not start'}`),
  )
  w.addEventListener('messageerror', () =>
    failAll('Pixel worker sent a reply that could not be read'),
  )
  worker = w
  return w
}

/** A browser can kill a worker without an error event; past this, assume it did. */
const timeoutFor = (blob: Blob) => 30_000 + (blob.size / 1_000_000) * 5_000

/**
 * Decode `blob`, optionally run a pixel tool on it, and encode the requested outputs — in a
 * worker, so a big photo never freezes the page. Without worker canvas support it runs here.
 */
export async function runPixelJob(
  blob: Blob,
  op: PixelOp | null,
  outputs: Output[],
): Promise<PixelResult> {
  if (!canUseWorker()) return (await import('./pixelJob')).processJob({ blob, op, outputs })
  const id = nextId++
  const job: PixelJob = { id, blob, op, outputs }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => failAll('Pixel worker stopped answering'), timeoutFor(blob))
    pending.set(id, {
      resolve: (r) => {
        clearTimeout(timer)
        resolve(r)
      },
      reject: (e) => {
        clearTimeout(timer)
        reject(e)
      },
    })
    getWorker().postMessage(job)
  })
}

/** Run a pixel tool on the image at `src` and give the result as a data URL, as the tools always have. */
export async function runPixelTool(src: string, op: PixelOp, output: Output): Promise<string> {
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Could not read the photo (${res.status})`)
  const { blobs } = await runPixelJob(await res.blob(), op, [output])
  const out = blobs[0]
  if (!out) throw new Error('Pixel job returned no image')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(out)
  })
}
