import { test, expect, type Page } from '@playwright/test'
import { countElements, openApp, skipGallery, waitForElements } from './helpers'

const makePng = (page: Page) =>
  page.evaluateHandle(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 48
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#e4572e'
    ctx.fillRect(0, 0, 64, 48)
    return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
  })

// The desktop opens on the Photos panel; tapping its tab again would close it.
const clickPaste = (page: Page) =>
  page.getByRole('button', { name: 'Paste image', exact: true }).click()

test.describe('clipboard', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openApp(page)
    await skipGallery(page)
  })

  test('Ctrl+V with an image on the clipboard adds it as a photo', async ({ page }) => {
    const png = await makePng(page)
    await page.evaluate(
      (blob) => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]),
      png,
    )
    await page.locator('body').press('Control+v')
    await waitForElements(page, 'photo')
    expect(await countElements(page, 'photo')).toBe(1)
    await expect(page.getByText('Image pasted')).toBeVisible()
  })

  test('the Paste button adds the image on the clipboard', async ({ page }) => {
    const png = await makePng(page)
    await page.evaluate(
      (blob) => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]),
      png,
    )
    await clickPaste(page)
    await waitForElements(page, 'photo')
    await expect(page.getByText('Image pasted')).toBeVisible()
  })

  test('the Paste button says so when the clipboard holds no image', async ({ page }) => {
    await page.evaluate(() => navigator.clipboard.writeText('just text'))
    await clickPaste(page)
    await expect(page.getByText('No image on the clipboard')).toBeVisible()
    expect(await countElements(page, 'photo')).toBe(0)
  })

  test('Copy image puts the whole board on the clipboard as a PNG', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByRole('menuitem', { name: 'Copy image' }).click()
    await expect(page.getByText('Image copied')).toBeVisible()

    const copied = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read()
      const bitmap = await createImageBitmap(await item.getType('image/png'))
      const { boardWidth, boardHeight } = window.__editor!.getState()
      return { width: bitmap.width, height: bitmap.height, boardWidth, boardHeight }
    })
    expect(copied.width / copied.boardWidth).toBeCloseTo(2)
    expect(copied.height / copied.boardHeight).toBeCloseTo(2)
  })

  test('Ctrl+C with nothing selected copies the board', async ({ page }) => {
    await page.evaluate(() => navigator.clipboard.writeText('stale'))
    await page.locator('body').press('Control+c')
    await expect(page.getByText('Image copied')).toBeVisible()
    const types = await page.evaluate(async () => (await navigator.clipboard.read())[0].types)
    expect(types).toContain('image/png')
  })
})
