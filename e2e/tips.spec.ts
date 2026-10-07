import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { dragOnCanvas, enterCustomLayout, getZones, openApp } from './helpers'

/**
 * First-use tips. Every other spec suppresses these through `openApp`; these
 * arm them deliberately with `{ tips: true }`.
 *
 * The gesture that needed teaching is drawing a divider across the board —
 * nothing on screen suggests it exists, which is why the editor already toasts
 * when a stroke misses.
 */

const demo = (page: Page) => page.locator('[data-gesture-demo="layout"]')

test.describe('first-use tips', () => {
  test('the drawing demo plays the first time the layout editor is opened', async ({ page }) => {
    await openApp(page, { tips: true })
    await enterCustomLayout(page)
    await expect(demo(page)).toBeVisible()
  })

  test('and not the second time', async ({ page }) => {
    await openApp(page, { tips: true })
    await enterCustomLayout(page)
    await expect(demo(page)).toBeVisible()

    await page.reload()
    await page.waitForFunction(() => !!window.__editor)
    await enterCustomLayout(page)
    // Seen once is seen; the hint text stays, the demo does not.
    await expect(page.getByText(/Drag a line across the board/)).toBeVisible()
    await expect(demo(page)).toHaveCount(0)
  })

  test('the board stays usable while the demo plays', async ({ page }) => {
    // The whole reason it lives in the hint row rather than over the canvas:
    // you have to be able to copy the gesture while watching it.
    await openApp(page, { tips: true })
    await enterCustomLayout(page)
    await expect(demo(page)).toBeVisible()

    await dragOnCanvas(page, [0.5, 0.1], [0.5, 0.9])
    await expect.poll(async () => (await getZones(page)).length).toBe(2)
  })

  test('a stroke that misses offers the demo again', async ({ page }) => {
    // Suppressed tips, so the only way the demo can appear is the toast.
    await openApp(page)
    await enterCustomLayout(page)
    await expect(demo(page)).toHaveCount(0)

    // Hugging the very top edge cuts nothing — the same stroke custom-layout
    // .spec uses to prove the editor says so rather than failing silently.
    await dragOnCanvas(page, [0.1, 0.002], [0.9, 0.002])
    const showMe = page.getByRole('status').getByRole('button', { name: 'Show me' })
    await expect(showMe).toBeVisible()

    await showMe.click()
    await expect(demo(page)).toBeVisible()
  })

  test('Settings can put the tips back', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Show tips again' }).click()

    const seen = await page.evaluate(() => localStorage.getItem('pic-collage-tips-v1'))
    expect(seen).toBeNull()
  })

  test('the layers panel demonstrates dragging to reorder, once', async ({ page }) => {
    await openApp(page, { tips: true })
    await page.locator('button.w-full', { hasText: 'Skip' }).click()

    await page.getByRole('button', { name: 'Layers', exact: true }).click()
    await expect(page.locator('[data-gesture-demo="layers"]')).toBeVisible()

    // Closing and reopening must not teach it again.
    await page.getByRole('button', { name: 'Layers', exact: true }).click()
    await page.getByRole('button', { name: 'Layers', exact: true }).click()
    await expect(page.locator('[data-gesture-demo="layers"]')).toHaveCount(0)
  })

  test('tips are suppressed by default, so every other spec is unaffected', async ({ page }) => {
    await openApp(page)
    await page.locator('button.w-full', { hasText: 'Skip' }).click()
    await page.getByRole('button', { name: 'Layers', exact: true }).click()
    await expect(page.locator('[data-gesture-demo]')).toHaveCount(0)
  })
})
