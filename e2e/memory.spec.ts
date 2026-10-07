import { test, expect, type Page } from '@playwright/test'
import { openApp, pngFile, waitForElements } from './helpers'

const cachedImages = (page: Page) =>
  page.evaluate(() => {
    const { Konva } = window as unknown as {
      Konva: { stages: import('konva/lib/Stage').Stage[] }
    }
    const images = Konva.stages[0]?.find<import('konva/lib/shapes/Image').Image>('Image') ?? []
    // Until the bitmap is decoded no filter effect has run, so "uncached" would prove nothing.
    if (!images.length || images.some((n) => !n.image())) return null
    return images.filter((n) => n.isCached()).length
  })

test('only a photo with adjustments carries a filter cache', async ({ page }) => {
  await openApp(page)
  await page.locator('#empty-gallery-input').setInputFiles(pngFile())
  await waitForElements(page, 'photo')
  await expect.poll(() => cachedImages(page)).toBe(0)

  await page.evaluate(() => {
    const editor = (
      window as unknown as {
        __editor: {
          getState(): {
            elements: { id: string; type: string }[]
            updateFilterStack(id: string, stack: { type: 'brightness'; value: number }[]): void
          }
        }
      }
    ).__editor.getState()
    const photo = editor.elements.find((e) => e.type === 'photo')!
    editor.updateFilterStack(photo.id, [{ type: 'brightness', value: 0.3 }])
  })
  await expect.poll(() => cachedImages(page)).toBe(1)
})
