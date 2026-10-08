import { test, expect, type Page } from '@playwright/test'
import {
  cspViolations,
  downloadTriggered,
  openApp,
  recordCspViolations,
  spyDownloads,
  waitForElements,
} from './helpers'

async function exportAs(page: Page, item: string | RegExp) {
  await page.evaluate(() => {
    ;(window as unknown as { __downloadTriggered?: boolean }).__downloadTriggered = false
  })
  await page.getByRole('button', { name: 'Export' }).first().click()
  await page.getByRole('menuitem', { name: item }).click()
  await expect.poll(() => downloadTriggered(page)).toBe(true)
}

test('the policy lets the whole edit-and-export path through', async ({ page }) => {
  await recordCspViolations(page)
  await openApp(page)
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  expect(policy).toContain("object-src 'none'")

  // Painted on a canvas, decoded in the pixel worker, stored as blobs.
  await page.getByRole('button', { name: 'Try with sample photos' }).click()
  await waitForElements(page, 'photo', 4)

  await spyDownloads(page)
  await exportAs(page, 'Download PNG')
  await exportAs(page, /SVG/)
  await exportAs(page, 'Export PDF')

  expect(await cspViolations(page)).toEqual([])
})
