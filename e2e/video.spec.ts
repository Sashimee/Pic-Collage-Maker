import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openApp, pngFile, skipGallery, waitForElements } from './helpers'

/**
 * The slideshow video: every page rendered off-screen, then recorded through
 * MediaRecorder in real time. What only a browser can tell us is whether the
 * file that comes out is a video a player will open, at the size we asked for.
 */

async function installVideoProbe(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __lastVideo?: Blob }
    const orig = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob && obj.type.startsWith('video/')) w.__lastVideo = obj
      return orig(obj)
    }
  })
}

/** Open the recorded file in a <video> the way a player would, and read its frame size. */
async function videoFrameSize(page: Page) {
  return page.evaluate(async () => {
    const blob = (window as unknown as { __lastVideo?: Blob }).__lastVideo
    if (!blob) return null
    const video = document.createElement('video')
    video.muted = true
    video.src = URL.createObjectURL(blob)
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve
      video.onerror = () => reject(new Error('the recorded video does not load'))
    })
    return { width: video.videoWidth, height: video.videoHeight, bytes: blob.size }
  })
}

async function addPhoto(page: Page, name: string) {
  const empty = page.locator('#empty-gallery-input')
  if (await empty.count()) {
    await empty.setInputFiles(pngFile(name))
  } else {
    await page.getByRole('button', { name: 'Photos', exact: true }).click()
    await page.locator('#panel-gallery-input').setInputFiles(pngFile(name))
    await page.getByRole('button', { name: 'Photos', exact: true }).click()
  }
  await waitForElements(page, 'photo')
}

test('records every page into a video a player opens at 1080 on the long side', async ({
  page,
}) => {
  await openApp(page)
  await skipGallery(page)
  await addPhoto(page, 'one.png')
  await page.getByRole('button', { name: 'Add page' }).click()
  await expect(page.locator('[data-page-tile]')).toHaveCount(2)
  await addPhoto(page, 'two.png')

  await installVideoProbe(page)
  await page
    .getByRole('button', { name: /Export/i })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Slideshow video' }).click()
  const sheet = page.getByRole('dialog', { name: 'Slideshow video' })
  await expect(sheet.getByText('2 pages')).toBeVisible()
  await sheet.getByRole('button', { name: '2 seconds' }).click()

  const download = page.waitForEvent('download', { timeout: 60_000 })
  await sheet.getByRole('button', { name: 'Create video' }).click()
  await expect(sheet.getByRole('status')).toContainText('Recording')
  expect((await download).suggestedFilename()).toMatch(/^slideshow-\d+\.(mp4|webm)$/)
  await expect(sheet).toBeHidden()

  const size = await videoFrameSize(page)
  expect(size).toMatchObject({ width: 864, height: 1080 })
  expect(size!.bytes).toBeGreaterThan(1000)
})

test('closing the sheet stops a recording without saving anything', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  await addPhoto(page, 'one.png')
  await installVideoProbe(page)
  let downloads = 0
  page.on('download', () => downloads++)

  await page
    .getByRole('button', { name: /Export/i })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Slideshow video' }).click()
  const sheet = page.getByRole('dialog', { name: 'Slideshow video' })
  await sheet.getByRole('button', { name: '5 seconds' }).click()
  await sheet.getByRole('button', { name: 'Create video' }).click()
  await expect(sheet.getByRole('status')).toContainText('Recording')
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(sheet).toBeHidden()

  await page.waitForTimeout(6_000)
  expect(downloads).toBe(0)
  expect(
    await page.evaluate(() => !!(window as unknown as { __lastVideo?: Blob }).__lastVideo),
  ).toBe(false)
})

test('the sheet holds the keyboard and hands focus back to Export', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  await addPhoto(page, 'one.png')
  await page.evaluate(() => {
    const editor = (
      window as unknown as {
        __editor: { getState: () => { elements: { id: string }[]; select: (id: string) => void } }
      }
    ).__editor.getState()
    editor.select(editor.elements[0].id)
  })

  const exportButton = page.getByRole('button', { name: /Export/i }).first()
  await exportButton.click()
  await page.getByRole('menuitem', { name: 'Slideshow video' }).click()
  const sheet = page.getByRole('dialog', { name: 'Slideshow video' })
  await expect(sheet.getByRole('button', { name: 'Close' })).toBeFocused()

  // Delete would remove the selected photo if it reached the editor's shortcuts.
  await page.keyboard.press('Delete')
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab')
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true)

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(exportButton).toBeFocused()
  await waitForElements(page, 'photo')
})
