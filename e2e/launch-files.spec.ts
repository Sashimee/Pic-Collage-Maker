import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { openApp, pngFile, waitForElements, withoutFilePickers } from './helpers'

interface Launched {
  name: string
  type: string
  base64: string
}

const LAUNCH_KEY = 'e2e-launch'

/**
 * Stands in for Chromium's launch queue, which only an installed app gets. Like the real one,
 * it holds the files from page load and hands them over inside `setConsumer` — so the launch
 * lands while the app is still starting, not after the test has waited for it.
 */
const stubLaunchQueue = (page: Page) =>
  page.addInitScript((key) => {
    const queued = sessionStorage.getItem(key)
    sessionStorage.removeItem(key)
    const files: Launched[] = queued ? JSON.parse(queued) : []
    Object.defineProperty(window, 'launchQueue', {
      value: {
        setConsumer: (consumer: (params: { files: { getFile: () => Promise<File> }[] }) => void) =>
          consumer({
            files: files.map((f) => ({
              getFile: async () =>
                new File([Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0))], f.name, {
                  type: f.type,
                }),
            })),
          }),
      },
    })
  }, LAUNCH_KEY)

/** Reloads the app as the OS would launch it with `files`. */
async function launchWith(page: Page, files: Launched[]) {
  await page.evaluate(
    ([key, value]) => sessionStorage.setItem(key, value),
    [LAUNCH_KEY, JSON.stringify(files)],
  )
  await page.reload()
}

const photoCount = (page: Page) =>
  page.evaluate(() => window.__editor!.getState().elements.filter((e) => e.type === 'photo').length)

/** Photos in the autosaved document, i.e. what the next start will restore. */
const persistedPhotos = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('piccollage')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction('doc').objectStore('doc').get('current')
          get.onerror = () => reject(get.error)
          get.onsuccess = () => {
            const doc = get.result as { elements: { type: string }[] } | undefined
            resolve(doc ? doc.elements.filter((e) => e.type === 'photo').length : 0)
            open.result.close()
          }
        }
      }),
  )

const srcsResolve = (page: Page) =>
  page.evaluate(async () => {
    const photos = window
      .__editor!.getState()
      .elements.filter((e) => e.type === 'photo') as unknown as { src: string }[]
    const ok = await Promise.all(
      photos.map((p) =>
        fetch(p.src).then(
          (r) => r.ok,
          () => false,
        ),
      ),
    )
    return ok.length > 0 && ok.every(Boolean)
  })

const png = pngFile()
const image = (name: string): Launched => ({
  name,
  type: png.mimeType,
  base64: png.buffer.toString('base64'),
})

/** A board with `n` photos that has reached the autosave. */
async function draftWith(page: Page, n: number) {
  await stubLaunchQueue(page)
  await openApp(page)
  await page
    .locator('#empty-gallery-input')
    .setInputFiles(Array.from({ length: n }, (_, i) => pngFile(`draft-${i}.png`)))
  await waitForElements(page, 'photo', n)
  await expect.poll(() => persistedPhotos(page)).toBe(n)
}

async function savedProjectFile(page: Page): Promise<Launched> {
  await page.getByRole('button', { name: 'Export' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Save as .piccollage').click(),
  ])
  const bytes = await readFile(await download.path())
  return { name: 'trip.piccollage', type: '', base64: bytes.toString('base64') }
}

test('images opened from the OS join the restored board and stay', async ({ page }) => {
  await draftWith(page, 1)
  await launchWith(page, [image('a.png'), image('b.png')])
  await waitForElements(page, 'photo', 3)
  await expect.poll(() => persistedPhotos(page)).toBe(3)

  await page.reload()
  await waitForElements(page, 'photo', 3)
  expect(await srcsResolve(page)).toBe(true)
})

test('a .piccollage opened from the OS replaces the board once confirmed', async ({
  page,
  browser,
}) => {
  await withoutFilePickers(page)
  await openApp(page)
  await page.locator('#empty-gallery-input').setInputFiles(pngFile())
  await waitForElements(page, 'photo', 1)
  const file = await savedProjectFile(page)

  // A fresh context has none of the first one's IndexedDB or object URLs.
  const other = await browser.newContext()
  const fresh = await other.newPage()
  await draftWith(fresh, 2)
  fresh.once('dialog', (d) => d.accept())
  await launchWith(fresh, [file])
  await expect(fresh.getByText('Project opened')).toBeVisible()
  await expect.poll(() => photoCount(fresh)).toBe(1)
  await expect.poll(() => persistedPhotos(fresh)).toBe(1)

  await fresh.reload()
  await waitForElements(fresh, 'photo', 1)
  expect(await srcsResolve(fresh)).toBe(true)
  await other.close()
})

test('declining keeps the restored board', async ({ page, browser }) => {
  await withoutFilePickers(page)
  await openApp(page)
  await page.locator('#empty-gallery-input').setInputFiles(pngFile())
  await waitForElements(page, 'photo', 1)
  const file = await savedProjectFile(page)

  const other = await browser.newContext()
  const fresh = await other.newPage()
  await draftWith(fresh, 2)
  const asked = new Promise<void>((resolve) =>
    fresh.once('dialog', (d) => void d.dismiss().then(resolve)),
  )
  await launchWith(fresh, [file])
  await asked
  await waitForElements(fresh, 'photo', 2)
  expect(await photoCount(fresh)).toBe(2)
  await other.close()
})

test('a broken .piccollage says why, and the images launched with it still arrive', async ({
  page,
}) => {
  await stubLaunchQueue(page)
  await openApp(page)
  await launchWith(page, [
    { name: 'broken.piccollage', type: '', base64: Buffer.from('{"nope":1}').toString('base64') },
    image('c.png'),
  ])
  await expect(page.getByText(/\.piccollage/)).toBeVisible()
  await waitForElements(page, 'photo', 1)
})
