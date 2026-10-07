import { useEffect, useRef } from 'react'
import { useEditor } from '../store/editorStore'
import { useImportFiles } from './useImportFiles'
import { useToasts } from '../components/ToastContainer'
import { useT } from '../i18n/useLang'

const CACHE = 'share-target'

/** The photos `public/share-target.js` stashed from the share sheet; strips `?shared` from the URL. */
export async function takeSharedFiles(): Promise<File[]> {
  const params = new URLSearchParams(location.search)
  const shared = params.get('shared')
  if (shared === null) return []
  params.delete('shared')
  const query = params.toString()
  history.replaceState(
    history.state,
    '',
    location.pathname + (query ? `?${query}` : '') + location.hash,
  )
  if (shared === 'failed')
    throw new Error('The service worker could not store the shared photos (see its console)')
  if (!('caches' in window)) return []
  const cache = await caches.open(CACHE)
  const keys = await cache.keys()
  const order = (r: Request) => Number(r.url.split('/').pop())
  return Promise.all(
    [...keys]
      .sort((a, b) => order(a) - order(b))
      .map(async (key) => {
        const res = await cache.match(key)
        if (!res) throw new Error(`Shared photo ${key.url} vanished from the cache`)
        const name = decodeURIComponent(res.headers.get('x-file-name') ?? 'shared')
        return new File([await res.blob()], name, { type: res.headers.get('content-type') ?? '' })
      }),
  )
}

// Module-level so StrictMode's second effect run doesn't take the same share again.
let claimed = false

/**
 * Puts photos shared to the installed app on the board. Waits for `ready` — the startup
 * restore — which would otherwise replace the board under them before autosave saw them.
 */
export function useShareTarget(ready: boolean) {
  const importFiles = useImportFiles()
  const addPhoto = useEditor((s) => s.addPhoto)
  const toast = useToasts()
  const t = useT()
  const latest = useRef({ importFiles, addPhoto, toast, t })
  useEffect(() => {
    latest.current = { importFiles, addPhoto, toast, t }
  })

  useEffect(() => {
    if (!ready || claimed || !new URLSearchParams(location.search).has('shared')) return
    claimed = true
    void (async () => {
      try {
        const files = await takeSharedFiles()
        if (!files.length) return
        const list = new DataTransfer()
        for (const file of files) list.items.add(file)
        await latest.current.importFiles(list.files, latest.current.addPhoto)
      } catch (err) {
        console.error('[shareTarget] could not import the shared photos', err)
        latest.current.toast.error(latest.current.t('error.loadImages'))
      } finally {
        if ('caches' in window) await caches.delete(CACHE)
      }
    })()
  }, [ready])
}
