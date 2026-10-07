import { test, expect, type Page } from '@playwright/test'
import { openApp, pngFile, waitForElements } from './helpers'

const boardSize = (page: Page) =>
  page.evaluate(() => {
    const s = window.__editor!.getState()
    return [s.boardWidth, s.boardHeight]
  })

test.describe('size presets', () => {
  test('the start screen sets the canvas size before any photo', async ({ page }) => {
    await openApp(page)
    const disclosure = page.getByRole('button', { name: 'Canvas size' })
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    await disclosure.click()
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true')

    const a4 = page
      .getByRole('group', { name: 'Print' })
      .getByRole('button', { name: 'A4 portrait' })
    await a4.click()
    await expect.poll(() => boardSize(page)).toEqual([2480, 3508])
    await expect(a4).toHaveAttribute('aria-pressed', 'true')
  })

  test('the resize sheet takes focus and Escape gives it back', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByRole('menuitem', { name: 'Resize for…' }).click()
    await expect(page.getByRole('dialog').getByRole('button', { pressed: true })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Export' })).toBeFocused()
  })

  test('the export menu resizes an existing collage and undo restores it', async ({ page }) => {
    await openApp(page)
    await page.locator('#empty-gallery-input').setInputFiles(pngFile())
    await waitForElements(page, 'photo')
    const before = await boardSize(page)

    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByRole('menuitem', { name: 'Resize for…' }).click()
    await page
      .getByRole('group', { name: 'Social media' })
      .getByRole('button', { name: 'Instagram story' })
      .click()

    await expect.poll(() => boardSize(page)).toEqual([1080, 1920])
    await expect(page.getByRole('group', { name: 'Social media' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Export' })).toBeFocused()

    await page.keyboard.press('Control+z')
    await expect.poll(() => boardSize(page)).toEqual(before)
  })
})
