import { test, expect, type Page } from '@playwright/test'
import { openApp, pngFile, waitForElements } from './helpers'

/**
 * Back up every project to one file and restore it on a device that has never seen
 * them. The second device is a fresh browser context, so nothing can come from a store
 * the first one wrote; the reload proves the restored photos are in IndexedDB, not
 * just object URLs of the restoring session.
 */

const openProjects = (page: Page) => page.getByRole('button', { name: 'Projects' }).first().click()

const srcsResolve = (page: Page) =>
  page.evaluate(async () => {
    const srcs = window
      .__editor!.getState()
      .elements.filter((e) => e.type === 'photo')
      .map((e) => (e as unknown as { src: string }).src)
    if (!srcs.length) return false
    const ok = await Promise.all(
      srcs.map((s) =>
        fetch(s).then(
          (r) => r.ok,
          () => false,
        ),
      ),
    )
    return ok.every(Boolean)
  })

test('backup restores every project, with photos, on another device', async ({
  page,
  browser,
}, testInfo) => {
  await openApp(page)
  await page.locator('#empty-gallery-input').setInputFiles(pngFile())
  await waitForElements(page, 'photo')
  await page.evaluate(async () => {
    await window.__projects!.getState().createProject('Trip')
    await window.__projects!.getState().createProject('Second')
  })

  await openProjects(page)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Back up all' }).click()
  const file = await (await download).path()
  expect((await download).suggestedFilename()).toMatch(/\.piccollage-backup$/)

  const other = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const fresh = await other.newPage()
  await openApp(fresh)
  await openProjects(fresh)
  await expect(fresh.getByText('Trip', { exact: true })).toBeHidden()
  await fresh.locator('input[accept*="piccollage-backup"]').setInputFiles(file)
  await expect(fresh.getByText('2 projects restored')).toBeVisible()
  await expect(fresh.getByText('Trip', { exact: true })).toBeVisible()

  await fresh.reload()
  await fresh.waitForFunction(() => !!window.__editor)
  await openProjects(fresh)
  await expect(fresh.getByText('Second', { exact: true })).toBeVisible()
  await fresh.getByText('Trip', { exact: true }).click()
  await waitForElements(fresh, 'photo')
  await expect.poll(() => srcsResolve(fresh)).toBe(true)
  await other.close()
})

test('a file that is not a backup is refused and adds nothing', async ({ page }) => {
  await openApp(page)
  await openProjects(page)
  await page.locator('input[accept*="piccollage-backup"]').setInputFiles({
    name: 'notes.piccollage-backup',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  })
  await expect(page.getByText("This file isn't a Pic Collage backup.")).toBeVisible()
  expect(
    await page.evaluate(async () => {
      await window.__projects!.getState().loadProjectList()
      return (window.__projects!.getState() as unknown as { projects: unknown[] }).projects.length
    }),
  ).toBe(0)
})
