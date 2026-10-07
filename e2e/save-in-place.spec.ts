import { test, expect, type Page } from '@playwright/test'
import { openApp, waitForElements } from './helpers'

declare global {
  interface Window {
    /** File name → the text last written to it, through the fake pickers below. */
    __files?: Record<string, string>
    __savePicks?: number
  }
}

/** Stands in for the OS file dialogs: every save picks `name`, and every open picks it too. */
async function fakePickers(page: Page, name: string) {
  await page.addInitScript((name) => {
    const files: Record<string, string> = {}
    window.__files = files
    window.__savePicks = 0
    const handle = {
      name,
      kind: 'file',
      getFile: async () => new File([files[name] ?? ''], name),
      createWritable: async () => {
        const parts: string[] = []
        return {
          write: async (data: Blob) => void parts.push(await data.text()),
          close: async () => void (files[name] = parts.join('')),
          abort: async () => {},
        }
      },
    }
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => {
        window.__savePicks = (window.__savePicks ?? 0) + 1
        return handle
      },
    })
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [handle],
    })
  }, name)
}

const savedElements = (page: Page, name: string) =>
  page.evaluate((name) => {
    const text = window.__files?.[name]
    return text ? (JSON.parse(text) as { doc: { elements: unknown[] } }).doc.elements.length : -1
  }, name)

const savePicks = (page: Page) => page.evaluate(() => window.__savePicks ?? 0)

const addText = (page: Page) => page.evaluate(() => window.__editor!.getState().addText())

async function openExportMenu(page: Page) {
  await page.getByRole('button', { name: 'Export' }).click()
}

test('saving again writes over the same file without asking where', async ({ page }) => {
  await fakePickers(page, 'trip.piccollage')
  await openApp(page)
  await addText(page)

  await openExportMenu(page)
  await page.getByText('Save as .piccollage').click()
  await expect(page.getByText('Saved to trip.piccollage')).toBeVisible()
  await expect.poll(() => savedElements(page, 'trip.piccollage')).toBe(1)

  await addText(page)
  await openExportMenu(page)
  await page.getByText('Save to trip.piccollage').click()
  await expect.poll(() => savedElements(page, 'trip.piccollage')).toBe(2)
  expect(await savePicks(page)).toBe(1)
})

test('"Save as new file" asks where, even while a file is linked', async ({ page }) => {
  await fakePickers(page, 'trip.piccollage')
  await openApp(page)
  await addText(page)
  await openExportMenu(page)
  await page.getByText('Save as .piccollage').click()
  await expect.poll(() => savePicks(page)).toBe(1)

  await openExportMenu(page)
  await page.getByText('Save as new file…').click()
  await expect.poll(() => savePicks(page)).toBe(2)
})

test('after New, saving asks for a file instead of overwriting the old one', async ({ page }) => {
  await fakePickers(page, 'trip.piccollage')
  await openApp(page)
  await addText(page)
  await openExportMenu(page)
  await page.getByText('Save as .piccollage').click()
  await expect.poll(() => savedElements(page, 'trip.piccollage')).toBe(1)

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'New / clear' }).click()
  await expect.poll(() => page.evaluate(() => window.__editor!.getState().elements.length)).toBe(0)

  await openExportMenu(page)
  await expect(page.getByText('Save as .piccollage')).toBeVisible()
  await expect(page.getByText('Save to trip.piccollage')).toHaveCount(0)
})

test('a file opened through the picker saves back in place', async ({ page }) => {
  await fakePickers(page, 'trip.piccollage')
  await openApp(page)
  await addText(page)
  await openExportMenu(page)
  await page.getByText('Save as .piccollage').click()
  await expect.poll(() => savedElements(page, 'trip.piccollage')).toBe(1)

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'New / clear' }).click()
  await expect.poll(() => page.evaluate(() => window.__editor!.getState().elements.length)).toBe(0)

  await openExportMenu(page)
  await page.getByText('Open .piccollage').click()
  await expect(page.getByText('Project opened')).toBeVisible()
  await waitForElements(page, 'text', 1)

  await addText(page)
  await openExportMenu(page)
  await page.getByText('Save to trip.piccollage').click()
  await expect.poll(() => savedElements(page, 'trip.piccollage')).toBe(2)
  expect(await savePicks(page)).toBe(1)
})
