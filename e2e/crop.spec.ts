import { test, expect, type Page } from '@playwright/test'
import { openApp, pngFile, waitForElements } from './helpers'

interface CropState {
  crop?: { width: number; height: number }
  straighten?: number
  flipX?: boolean
  flipY?: boolean
}

const photoCrop = (page: Page) =>
  page.evaluate(() => {
    const el = window.__editor!.getState().elements.find((e) => e.type === 'photo') as
      | (CropState & { id: string })
      | undefined
    return el
      ? { crop: el.crop, straighten: el.straighten, flipX: el.flipX, flipY: el.flipY }
      : null
  })

/** The photo as it sits in the autosaved document in IndexedDB. */
const persistedCrop = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<CropState | null>((resolve) => {
        // Mirrors src/lib/persistence.ts — DB 'piccollage', store 'doc'.
        const req = indexedDB.open('piccollage')
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('doc')) {
            db.close()
            return resolve(null)
          }
          const t = db.transaction('doc', 'readonly')
          const get = t.objectStore('doc').getAll()
          get.onsuccess = () => {
            const docs = get.result as { elements?: (CropState & { type: string })[] }[]
            resolve(
              docs.flatMap((d) => d?.elements ?? []).find((e) => e.type === 'photo') ?? null,
            )
          }
          get.onerror = () => resolve(null)
          t.oncomplete = () => db.close()
        }
        req.onerror = () => resolve(null)
      }),
  )

test('crop, aspect, straighten and flip survive a reload', async ({ page }) => {
  await openApp(page)
  await page.locator('#empty-gallery-input').setInputFiles(pngFile())
  await waitForElements(page, 'photo')
  await page.evaluate(() => {
    const s = window.__editor!.getState()
    s.select(s.elements.find((e) => e.type === 'photo')!.id)
  })

  await page.getByRole('button', { name: 'Crop & Shape' }).click()
  const aspect = page.getByRole('group', { name: 'Aspect ratio' })
  await aspect.getByRole('button', { name: '1:1' }).click()
  await expect(aspect.getByRole('button', { name: '1:1' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('slider', { name: /Straighten/ }).fill('12')
  await page.getByRole('button', { name: 'Flip horizontal' }).click()
  await expect(page.getByRole('button', { name: 'Flip horizontal' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Apply' }).click()

  const applied = await photoCrop(page)
  expect(applied?.crop?.width).toBeCloseTo(applied!.crop!.height, 0)
  expect(applied).toMatchObject({ straighten: 12, flipX: true })

  await expect
    .poll(async () => (await persistedCrop(page))?.flipX, { timeout: 15_000 })
    .toBe(true)
  await page.reload()
  await page.waitForFunction(() => !!window.__editor)
  await waitForElements(page, 'photo')

  expect(await photoCrop(page)).toEqual(applied)
})

test('reset clears the straighten and flips along with the box', async ({ page }) => {
  await openApp(page)
  await page.locator('#empty-gallery-input').setInputFiles(pngFile())
  await waitForElements(page, 'photo')
  await page.evaluate(() => {
    const s = window.__editor!.getState()
    const id = s.elements.find((e) => e.type === 'photo')!.id
    s.updateElement(id, { straighten: -8, flipY: true })
    s.select(id)
  })

  await page.getByRole('button', { name: 'Crop & Shape' }).click()
  await page.getByRole('button', { name: 'Reset' }).click()
  expect(await photoCrop(page)).toMatchObject({ straighten: 0, flipX: false, flipY: false })
})
