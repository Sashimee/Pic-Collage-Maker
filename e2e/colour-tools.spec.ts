import { test, expect, type Page } from '@playwright/test'
import { clickOnBoard, openApp, skipGallery } from './helpers'

const background = (page: Page) =>
  page.evaluate(
    () =>
      (window.__editor!.getState() as unknown as { background: { color: string } }).background
        .color,
  )

async function addRedPhoto(page: Page) {
  await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 40
    c.height = 40
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 40, 40)
    const get = window.__editor!.getState
    get().addPhoto(c.toDataURL('image/png'), 40, 40)
    get().updateElement(get().elements.at(-1)!.id, {
      x: 0,
      y: 0,
      width: 1080,
      height: 700,
    } as never)
    get().select(null)
  })
}

async function openBackgroundTools(page: Page) {
  await page.getByRole('button', { name: 'Background', exact: true }).click()
  await page.getByRole('button', { name: 'Custom: Color tools' }).click()
}

test.describe('colour tools', () => {
  test('without the EyeDropper API, a tap on the board picks the colour under it', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      delete (window as { EyeDropper?: unknown }).EyeDropper
    })
    await openApp(page)
    await skipGallery(page)
    await addRedPhoto(page)
    await openBackgroundTools(page)

    await page.getByRole('button', { name: 'Pick from screen' }).click()
    await expect(page.getByText('Tap the board to pick a color')).toBeVisible()
    await clickOnBoard(page, [0.5, 0.25])

    await expect.poll(() => background(page)).toBe('#ff0000')
    await expect(page.getByTestId('board-colour-picker')).toHaveCount(0)
    await expect(page.getByText('Tap the board to pick a color')).toBeHidden()
    await expect(
      page.getByRole('group', { name: 'Recent' }).getByRole('button', { name: 'Color #FF0000' }),
    ).toBeVisible()
  })

  test('Escape cancels the board pick without changing anything', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as { EyeDropper?: unknown }).EyeDropper
    })
    await openApp(page)
    await skipGallery(page)
    const before = await background(page)
    await openBackgroundTools(page)
    await page.getByRole('button', { name: 'Pick from screen' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('board-colour-picker')).toHaveCount(0)
    expect(await background(page)).toBe(before)
  })

  test('a tap off the board, where nothing is drawn, keeps the pick armed', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as { EyeDropper?: unknown }).EyeDropper
    })
    await openApp(page)
    await skipGallery(page)
    const before = await background(page)
    await openBackgroundTools(page)
    await page.getByRole('button', { name: 'Pick from screen' }).click()
    const overlay = page.getByTestId('board-colour-picker')
    const box = (await overlay.boundingBox())!
    await page.mouse.click(box.x + 2, box.y + 2)
    await expect(overlay).toBeVisible()
    expect(await background(page)).toBe(before)
  })

  test('saved swatches and photo colours are offered, and swatches survive a reload', async ({
    page,
  }) => {
    await openApp(page)
    await skipGallery(page)
    await addRedPhoto(page)
    await openBackgroundTools(page)

    await page
      .getByRole('group', { name: 'From your photos' })
      .getByRole('button', { name: 'Color #FF0000' })
      .click()
    await expect.poll(() => background(page)).toBe('#ff0000')
    await page.getByRole('button', { name: 'Save color' }).click()

    await page.reload()
    await page.waitForFunction(() => !!window.__editor)
    await skipGallery(page)
    // The workspace store reopens the Background panel; clicking its tab would close it.
    await page.getByRole('button', { name: 'Custom: Color tools' }).click()
    await expect(
      page.getByRole('group', { name: 'Saved' }).getByRole('button', { name: 'Color #FF0000' }),
    ).toBeVisible()
  })
})
