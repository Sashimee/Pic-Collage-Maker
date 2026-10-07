import { test, expect, type Page } from '@playwright/test'
import { openApp, settleCanvas, skipGallery } from './helpers'

/** Capture each image blob handed to the download anchor. */
async function installExportProbe(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __exports: Blob[] }
    w.__exports = []
    const orig = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob && obj.type.startsWith('image/')) w.__exports.push(obj)
      return orig(obj)
    }
  })
}

/** Every pixel of the `n`th export, as a string to compare exports by. */
const exportPixels = (page: Page, n: number) =>
  page.evaluate(async (n) => {
    const blob = (window as unknown as { __exports: Blob[] }).__exports[n]
    if (!blob) return null
    const bmp = await createImageBitmap(blob)
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(bmp, 0, 0)
    return Array.from(ctx.getImageData(0, 0, c.width, c.height).data).join(',')
  }, n)

/** Editor-aid lines and rects currently drawn on the board. */
const visibleAids = (page: Page) =>
  page.evaluate(() => {
    const konva = (window as unknown as { Konva: { stages: import('konva/lib/Stage').Stage[] } })
      .Konva
    return konva.stages[0]
      .find('.editor-aid')
      .flatMap((g) => (g as import('konva/lib/Group').Group).find('Line, Rect'))
      .filter((n) => n.isVisible()).length
  })

async function exportPng(page: Page) {
  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByRole('menuitem', { name: 'Download PNG' }).click()
}

test('guides toggled in the status bar show on the board but never in an export', async ({
  page,
}) => {
  await openApp(page)
  await skipGallery(page)
  await page.evaluate(() =>
    (window.__editor!.getState() as unknown as { addSticker: (e: string) => void }).addSticker('⭐'),
  )
  await settleCanvas(page)
  await installExportProbe(page)

  await exportPng(page)
  await expect.poll(() => exportPixels(page, 0)).not.toBeNull()
  const plain = await exportPixels(page, 0)
  // A first export offers the install sheet; it sits over the status bar.
  await page.getByRole('button', { name: 'Maybe later' }).click()

  const before = await visibleAids(page)
  for (const name of ['Rulers', 'Centre lines', 'Print safe area & bleed']) {
    const toggle = page.getByRole('group', { name: 'Guides' }).getByRole('button', { name, exact: true })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  }
  await expect.poll(() => visibleAids(page)).toBeGreaterThan(before)

  await exportPng(page)
  await expect.poll(() => exportPixels(page, 1)).not.toBeNull()
  expect(await exportPixels(page, 1)).toBe(plain)
  expect(await visibleAids(page)).toBeGreaterThan(before)

  await page.reload()
  await page.waitForFunction(() => !!window.__editor)
  await expect(page.getByRole('button', { name: 'Centre lines' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
