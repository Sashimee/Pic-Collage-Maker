import { test, expect, type Page } from '@playwright/test'
import { openApp, pngFile, waitForElements } from './helpers'

// What public/share-target.js leaves behind before redirecting to ?shared=N.
const stashShare = (page: Page, n: number) =>
  page.evaluate(async (n) => {
    const cache = await caches.open('share-target')
    for (let i = 0; i < n; i++) {
      const canvas = new OffscreenCanvas(300, 200)
      canvas.getContext('2d')!.fillRect(0, 0, 300, 200)
      const blob = await canvas.convertToBlob({ type: 'image/jpeg' })
      await cache.put(
        new URL(`shared/${i}`, location.href).href,
        new Response(blob, {
          headers: { 'content-type': 'image/jpeg', 'x-file-name': `shared-${i}.jpg` },
        }),
      )
    }
  }, n)

// Mirrors src/lib/persistence.ts — DB 'piccollage', store 'doc'.
const persistedPhotos = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('piccollage')
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('doc')) {
            db.close()
            return resolve(0)
          }
          const t = db.transaction('doc', 'readonly')
          const get = t.objectStore('doc').getAll()
          get.onsuccess = () => {
            const docs = get.result as { elements?: { type: string }[] }[]
            resolve(docs.flatMap((d) => d?.elements ?? []).filter((e) => e.type === 'photo').length)
          }
          get.onerror = () => resolve(0)
          t.oncomplete = () => db.close()
        }
        req.onerror = () => resolve(0)
      }),
  )

const photoCount = (page: Page) =>
  page.evaluate(() => window.__editor!.getState().elements.filter((e) => e.type === 'photo').length)

test('photos shared to the app land on the board once and survive a reload', async ({ page }) => {
  await openApp(page)
  await stashShare(page, 2)
  await page.goto('./?shared=2')
  await page.waitForFunction(() => !!window.__editor)

  await waitForElements(page, 'photo', 2)
  expect(new URL(page.url()).searchParams.has('shared')).toBe(false)
  await expect.poll(() => page.evaluate(() => caches.has('share-target'))).toBe(false)

  await expect.poll(() => persistedPhotos(page), { timeout: 15_000 }).toBe(2)
  await page.reload()
  await page.waitForFunction(() => !!window.__editor)
  await waitForElements(page, 'photo', 2)
  expect(await photoCount(page)).toBe(2)
})

test('a share joins the restored board instead of being replaced by it', async ({ page }) => {
  await openApp(page)
  // Enough photos that restoring them outlasts the share import, which is when the two race.
  await page
    .locator('#empty-gallery-input')
    .setInputFiles(Array.from({ length: 12 }, (_, i) => pngFile(`p${i}.png`)))
  await waitForElements(page, 'photo', 12)
  await expect.poll(() => persistedPhotos(page), { timeout: 15_000 }).toBe(12)

  await stashShare(page, 2)
  await page.goto('./?shared=2')
  await page.waitForFunction(() => !!window.__editor)
  await waitForElements(page, 'photo', 14)
  await expect.poll(() => persistedPhotos(page), { timeout: 15_000 }).toBe(14)
  expect(await photoCount(page)).toBe(14)
})

test('a share the service worker could not store says so', async ({ page }) => {
  await openApp(page)
  await page.goto('./?shared=failed')
  await expect(page.getByText('Failed to load images.')).toBeVisible()
  expect(new URL(page.url()).searchParams.has('shared')).toBe(false)
})
