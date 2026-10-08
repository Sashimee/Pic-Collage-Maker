import { test, expect, type Page } from '@playwright/test'
import { openApp } from './helpers'

async function expectPrivacyPage(popup: Page) {
  await popup.waitForLoadState()
  expect(new URL(popup.url()).pathname).toMatch(/\/privacy\.html$/)
  await expect(popup.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible()
  await expect(popup.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeAttached()
}

test('the header opens the privacy page in a new tab', async ({ page }) => {
  await openApp(page)
  const popup = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Privacy', exact: true }).click()
  await expectPrivacyPage(await popup)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the menu opens the privacy page', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Menu' }).click()
    const popup = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Privacy', exact: true }).click()
    await expectPrivacyPage(await popup)
  })
})
