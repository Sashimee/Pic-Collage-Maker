import { test, expect } from '@playwright/test'
import { WHATS_NEW_TIP } from '../src/lib/changelog'

test.describe("what's new", () => {
  test('shows once after an update, to someone who has used the app before', async ({ page }) => {
    await page.addInitScript(() => {
      // Only on the first load: the second one checks that the sheet stays gone.
      if (sessionStorage.getItem('armed')) return
      sessionStorage.setItem('armed', '1')
      localStorage.setItem('pic-collage-tips-v1', JSON.stringify({ welcome: 1 }))
    })
    await page.goto('/')
    const sheet = page.getByRole('dialog', { name: "What's new" })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Got it' }).click()
    await expect(sheet).toBeHidden()

    await page.reload()
    await page.waitForFunction(() => !!window.__editor)
    await expect(page.getByText('Choose a Layout')).toBeVisible()
    await expect(sheet).toBeHidden()
  })

  test('stays out of the way of a first visit', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => !!window.__editor)
    await expect(page.getByRole('dialog', { name: "What's new" })).toBeHidden()
    const seen = await page.evaluate(() => localStorage.getItem('pic-collage-tips-v1'))
    expect(JSON.parse(seen ?? '{}')).toHaveProperty([WHATS_NEW_TIP])
  })
})
