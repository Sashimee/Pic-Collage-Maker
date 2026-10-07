import { test, expect, type Page } from '@playwright/test'
import { openApp } from './helpers'

test.use({ viewport: { width: 1280, height: 800 } })

async function openSettings(page: Page) {
  const tab = page.getByRole('button', { name: 'Settings', exact: true }).first()
  if ((await tab.getAttribute('aria-pressed')) !== 'true') await tab.click()
  await expect(page.getByLabel('Units')).toBeVisible()
}

test.describe('settings', () => {
  test('units change the size readout and survive a reload', async ({ page }) => {
    await openApp(page)
    const footer = page.locator('footer')
    await expect(footer.getByText('1080 × 1350 px')).toBeVisible()

    await openSettings(page)
    await page.getByLabel('Units').selectOption('mm')
    await expect(footer.getByText('91 × 114 mm')).toBeVisible()

    await page.reload()
    await page.waitForFunction(() => !!window.__editor)
    await expect(footer.getByText('91 × 114 mm')).toBeVisible()
    await openSettings(page)
    await expect(page.getByLabel('Units')).toHaveValue('mm')
  })

  test('the default download decides what Ctrl/Cmd+E saves', async ({ page }) => {
    await openApp(page)
    await openSettings(page)
    await page.getByLabel('Default download').selectOption('jpg')
    await page.locator('body').click({ position: { x: 5, y: 400 } })
    const download = page.waitForEvent('download')
    await page.keyboard.press('ControlOrMeta+e')
    expect((await download).suggestedFilename()).toMatch(/\.jpe?g$/)
  })

  test('the analytics switch is on by default and remembers being turned off', async ({ page }) => {
    await openApp(page)
    await openSettings(page)
    const box = page.getByLabel('Anonymous usage counts')
    await expect(box).toBeChecked()
    await box.uncheck()
    await page.reload()
    await page.waitForFunction(() => !!window.__editor)
    await openSettings(page)
    await expect(page.getByLabel('Anonymous usage counts')).not.toBeChecked()
  })
})
