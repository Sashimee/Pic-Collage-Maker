// Web Share Target: the share sheet POSTs the photos here as multipart form data.
// They wait in a cache, keyed by order, and the app takes them on its next load
// (src/hooks/useShareTarget.ts); a 303 turns the POST into that load.
const CACHE = 'share-target'

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (
    event.request.method !== 'POST' ||
    url.pathname !== new URL('share-target', self.registration.scope).pathname
  )
    return
  event.respondWith(
    (async () => {
      let shared
      try {
        const form = await event.request.formData()
        const files = form.getAll('photos').filter((f) => f instanceof File)
        await caches.delete(CACHE)
        const cache = await caches.open(CACHE)
        await Promise.all(
          files.map((file, i) =>
            cache.put(
              new URL(`shared/${i}`, self.registration.scope).href,
              new Response(file, {
                headers: {
                  'content-type': file.type,
                  'x-file-name': encodeURIComponent(file.name),
                },
              }),
            ),
          ),
        )
        shared = String(files.length)
      } catch (err) {
        // Still open the app, so the user gets an error toast rather than a browser error page.
        console.error('[share-target] could not store the shared photos', err)
        shared = 'failed'
      }
      return Response.redirect(new URL(`./?shared=${shared}`, self.registration.scope).href, 303)
    })(),
  )
})
