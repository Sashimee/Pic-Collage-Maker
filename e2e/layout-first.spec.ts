import { test, expect } from '@playwright/test'
import { assignmentSheet, getMode, layoutCard, openApp, pngFile, waitForElements } from './helpers'

test.describe('layout-first onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('shows the layout gallery on an empty canvas', async ({ page }) => {
    await expect(page.getByText('Choose a Layout')).toBeVisible()
    await expect(page.getByText('Pick a structure, then add your photos')).toBeVisible()
  })

  test('the gallery fits between the header and the tab bar', async ({ page }) => {
    // Regression: the card used to be capped at 85vh inside a centred flex
    // parent, so it overflowed symmetrically and hid its own title.
    const geo = await page.evaluate(() => {
      const header = document.querySelector('header')!.getBoundingClientRect()
      const title = document.querySelector('h2')!.getBoundingClientRect()
      return { headerBottom: header.bottom, titleTop: title.top }
    })
    expect(geo.titleTop).toBeGreaterThanOrEqual(geo.headerBottom)
  })

  test('sample photos fill a four-photo layout', async ({ page }) => {
    await page.getByRole('button', { name: 'Try with sample photos' }).click()
    await waitForElements(page, 'photo', 4)
    await expect(page.getByText('Choose a Layout')).toBeHidden()
    expect(await getMode(page)).toBe('grid')
    const gridId = await page.evaluate(() => window.__editor!.getState().gridId)
    expect(gridId).toBe('4-1big-top')
  })

  test('tapping a layout opens the photo assignment sheet', async ({ page }) => {
    await layoutCard(page).click()
    await expect(assignmentSheet(page)).toBeVisible()
    await expect(page.getByText('Tap a slot to add a photo')).toBeVisible()
  })

  test('skipping assignment enters grid mode', async ({ page }) => {
    await layoutCard(page).click()
    await page.getByRole('button', { name: /Skip for now/i }).click()
    await expect.poll(() => getMode(page)).toBe('grid')
  })

  test('assigning a photo to a slot puts it in the collage', async ({ page }) => {
    await layoutCard(page).click()

    // Each slot opens a *detached* input, so the file chooser event is the only
    // way in — there is no input element in the DOM to target.
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /Slot 1/i }).click(),
    ])
    await chooser.setFiles(pngFile())

    await waitForElements(page, 'photo')
    await page.getByRole('button', { name: /^Done$/i }).click()
    await expect.poll(() => getMode(page)).toBe('grid')
  })

  test('auto-fill adds several photos at once', async ({ page }) => {
    await layoutCard(page).click()
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /Auto-fill from Gallery/i }).click(),
    ])
    await chooser.setFiles([pngFile('a.png'), pngFile('b.png')])
    await waitForElements(page, 'photo', 2)
  })
})
