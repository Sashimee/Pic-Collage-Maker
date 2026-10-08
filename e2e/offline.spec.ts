import { test, expect } from '@playwright/test'
import { cspViolations, pngFile, recordCspViolations } from './helpers'

/**
 * Load once, lose the network, and everything still works: the app reloads
 * from the service worker, a photo imports, text goes on, and the PNG export
 * downloads. Runs against the production build (see offline.config.ts), so
 * the dev-only seams like window.__editor are not there — this drives the UI.
 */
test('loads, edits and exports with no network after the first visit', async ({
  page,
  context,
}) => {
  // The production build's policy, which unlike the dev server's allows no inline script.
  await recordCspViolations(page)
  await page.addInitScript(() => {
    const seen = ['welcome', 'pinch', 'draw', 'layout', 'layers', 'cellZoom']
    localStorage.setItem(
      'pic-collage-tips-v1',
      JSON.stringify(Object.fromEntries(seen.map((id) => [id, 1]))),
    )
  })
  await page.goto('/')
  // `ready` resolves once the worker is active, i.e. after the precache install.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))

  const failed: string[] = []
  page.on('requestfailed', (r) => failed.push(r.url()))
  await context.setOffline(true)

  await page.reload()
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await expect(page.getByText('Choose a Layout')).toBeVisible()

  await page.locator('#empty-gallery-input').setInputFiles(pngFile())
  await expect(page.getByText('Choose a Layout')).toBeHidden()

  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByRole('button', { name: /Add text/ }).click()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByRole('menuitem', { name: 'Download PNG' }).click()
  const file = await (await download).path()

  const { readFile } = await import('node:fs/promises')
  const png = await readFile(file)
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  // 1080×1350 board at pixelRatio 2.
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2160, 2700])

  // Only the update check may go to the network, and it is allowed to fail.
  expect(failed.filter((url) => !url.includes('version.json'))).toEqual([])
  expect(await cspViolations(page)).toEqual([])
})
