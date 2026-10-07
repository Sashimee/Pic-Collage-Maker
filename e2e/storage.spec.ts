import { test, expect, type Page } from '@playwright/test'
import { openApp } from './helpers'

/**
 * The device-storage line under the project list, and the request to keep saved projects
 * out of the browser's automatic cleanup. Playwright's Chromium answers both from its own
 * profile, so the storage API is replaced with one whose answers the test controls.
 */

async function stubStorage(page: Page, persisted: boolean) {
  await page.addInitScript((persisted) => {
    const calls = { persist: 0 }
    ;(window as unknown as { __persistCalls: typeof calls }).__persistCalls = calls
    let granted = persisted
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: async () => ({ usage: 2.5 * 1024 ** 2, quota: 2 * 1024 ** 3 }),
        persisted: async () => granted,
        persist: async () => {
          calls.persist++
          granted = true
          return true
        },
      },
    })
  }, persisted)
}

const persistCalls = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __persistCalls: { persist: number } }).__persistCalls.persist,
  )

test.describe('storage', () => {
  test('the project list shows how much space is in use', async ({ page }) => {
    await stubStorage(page, false)
    await openApp(page)
    await page.getByRole('button', { name: 'Projects' }).first().click()

    const meter = page.getByRole('meter', { name: 'Storage used' })
    await expect(meter).toHaveAttribute('aria-valuetext', '2.5 MB / 2 GB')
    await expect(page.getByText('2.5 MB / 2 GB')).toBeVisible()
    await expect(page.getByText(/may clear your projects/)).toBeVisible()
  })

  test('saving a project yourself asks to keep the data, once', async ({ page }) => {
    await stubStorage(page, false)
    await openApp(page)
    expect(await persistCalls(page)).toBe(0)

    // Saving on the user's behalf (export, Add page) must not raise Firefox's prompt.
    await page.evaluate(() => window.__projects!.getState().createProject('Implicit'))
    expect(await persistCalls(page)).toBe(0)

    await page.getByRole('button', { name: 'Projects' }).first().click()
    await expect(page.getByText(/may clear your projects/)).toBeVisible()
    for (const name of ['One', 'Two']) {
      await page.getByRole('button', { name: 'New project' }).click()
      await page.getByPlaceholder(/name/i).fill(name)
      await page.keyboard.press('Enter')
      await expect(page.getByText(name, { exact: true })).toBeVisible()
    }
    expect(await persistCalls(page)).toBe(1)
    await expect(page.getByText(/kept until you delete them/)).toBeVisible()
  })
})
