import { loadPhotoMeta } from './importPhotos'
import { track } from './analytics'
import { HeicUnsupportedError } from './heic'

export interface ImportHooks {
  onProgress?: (done: number, total: number) => void
  /** Set `cancelled` to stop after the photo in flight; photos already added stay. */
  signal?: { cancelled: boolean }
}

// Decode picked image files, stash each source blob in IndexedDB (so the
// collage survives a reload), and hand the object URL + intrinsic size to the
// store's addPhoto. Shared by the Photos panel and the first-run empty state.
export async function importFiles(
  files: FileList,
  add: (
    src: string,
    w: number,
    h: number,
    photoId?: string,
    opts?: { originalSrc?: string; previewSrc?: string; thumbSrc?: string },
  ) => void,
  hooks: ImportHooks = {},
) {
  console.log('[importFiles] processing', files.length, 'files')
  // Counted once per import action rather than per file, so the number reads as
  // "people who added photos" instead of "photos added".
  let added = 0
  let skippedHeic = 0
  const list = Array.from(files)
  for (let i = 0; i < list.length; i++) {
    if (hooks.signal?.cancelled) break
    const file = list[i]
    hooks.onProgress?.(i, list.length)
    // Mobile Safari often reports empty or 'application/octet-stream' for
    // Camera Roll photos. We try to load any file that is not a known non-image
    // type; loadPhotoMeta will fail gracefully on actually broken files.
    if (file.type && file.type !== 'application/octet-stream' && !file.type.startsWith('image/')) {
      console.log('[importFiles] skipping non-image type:', file.type, file.name)
      continue
    }
    try {
      const meta = await loadPhotoMeta(file)
      console.log('[importFiles] loaded', meta.width, 'x', meta.height, 'photoId', meta.photoId)
      add(meta.src, meta.width, meta.height, meta.photoId, {
        originalSrc: meta.originalSrc,
        previewSrc: meta.previewSrc,
        thumbSrc: meta.thumbSrc,
      })
      added++
    } catch (err) {
      // One iPhone photo the browser cannot read should not cost the user the rest of the pick.
      if (err instanceof HeicUnsupportedError) {
        console.warn('[importFiles]', err.message)
        skippedHeic++
        continue
      }
      console.error('[importFiles] FAILED to process file:', file.name, err)
      // DO NOT swallow the error — let it propagate so the UI can show feedback
      throw err
    }
  }
  if (added > 0) track('photo-added')
  return { added, skippedHeic }
}
