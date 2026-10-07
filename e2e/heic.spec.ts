import { test, expect } from '@playwright/test'
import { countElements, openApp, waitForElements } from './helpers'

test('a HEIC this browser cannot decode is skipped with a warning, the rest still import', async ({
  page,
}) => {
  await openApp(page)
  await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(400, 300)
    canvas.getContext('2d')!.fillRect(0, 0, 400, 300)
    const jpeg = await canvas.convertToBlob({ type: 'image/jpeg' })
    const heic = new Uint8Array(64)
    heic.set([0, 0, 0, 24, ...Array.from('ftypheic', (c) => c.charCodeAt(0))])
    const dt = new DataTransfer()
    // iOS hands HEICs over with no type, so only the bytes give them away.
    dt.items.add(new File([heic], 'IMG_0001', { type: '' }))
    dt.items.add(new File([jpeg], 'b.jpg', { type: 'image/jpeg' }))
    const input = document.querySelector<HTMLInputElement>('#empty-gallery-input')!
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })

  await waitForElements(page, 'photo')
  await expect(page.getByText(/HEIC photos skipped.*\(1\)/)).toBeVisible()
  expect(await countElements(page, 'photo')).toBe(1)
})
