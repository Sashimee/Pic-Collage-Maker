import { test, expect, type Page } from '@playwright/test'
import { openApp, pngFile, waitForElements, withoutFilePickers } from './helpers'

const photoSrcs = (page: Page) =>
  page.evaluate(() =>
    window
      .__editor!.getState()
      .elements.filter((e) => e.type === 'photo')
      .map((e) => (e as { src?: string }).src ?? ''),
  )

const srcsResolve = async (page: Page) => {
  const srcs = await photoSrcs(page)
  if (!srcs.length) return false
  return page.evaluate(
    (list) =>
      Promise.all(
        list.map((s) =>
          fetch(s)
            .then((r) => r.ok)
            .catch(() => false),
        ),
      ).then((rs) => rs.every(Boolean)),
    srcs,
  )
}

test('a .piccollage file opens with its photos on another device', async ({ page, browser }) => {
  await withoutFilePickers(page)
  await openApp(page)
  await page.locator('#empty-gallery-input').setInputFiles(pngFile())
  await waitForElements(page, 'photo', 1)

  await page.getByRole('button', { name: 'Export' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Save as .piccollage').click(),
  ])
  const file = await download.path()

  // A fresh context has none of the first one's IndexedDB or object URLs.
  const other = await browser.newContext()
  const fresh = await other.newPage()
  await openApp(fresh)
  await fresh.getByRole('button', { name: 'Export' }).click()
  await fresh.locator('input[accept=".piccollage,application/json"]').setInputFiles(file)

  await waitForElements(fresh, 'photo', 1)
  await expect.poll(() => srcsResolve(fresh)).toBe(true)
  await other.close()
})
