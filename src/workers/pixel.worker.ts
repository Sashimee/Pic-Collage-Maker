import { processJob, type PixelJob, type PixelReply } from './pixelJob'

addEventListener('message', async (e: MessageEvent<PixelJob>) => {
  const { id, ...job } = e.data
  let reply: PixelReply
  try {
    reply = { id, ok: await processJob(job) }
  } catch (err) {
    reply = { id, error: err instanceof Error ? err.message : String(err) }
  }
  postMessage(reply)
})
