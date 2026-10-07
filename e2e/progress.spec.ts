import { test, expect, type Page } from '@playwright/test'
import { countElements, openApp, waitForElements } from './helpers'

/** Pick `n` freshly encoded JPEGs through the first-run gallery input. */
async function pickJpegs(page: Page, n: number, size: [number, number]) {
  await page.evaluate(
    async ([n, w, h]) => {
      const dt = new DataTransfer()
      for (let i = 0; i < n; i++) {
        const canvas = new OffscreenCanvas(w, h)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = `hsl(${i * 30} 60% 50%)`
        ctx.fillRect(0, 0, w, h)
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
        dt.items.add(new File([blob], `p${i}.jpg`, { type: 'image/jpeg' }))
      }
      const input = document.querySelector<HTMLInputElement>('#empty-gallery-input')!
      input.files = dt.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    },
    [n, ...size] as const,
  )
}

const progressToast = (page: Page) => page.getByRole('status').getByText(/Adding photo \d+\/\d+/)

test('a multi-photo import shows its progress and can be stopped', async ({ page }) => {
  test.setTimeout(90_000)
  await openApp(page)
  // Slow enough that the import is still running when Cancel is pressed.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await pickJpegs(page, 20, [4000, 3000])

  await expect(progressToast(page)).toBeVisible()
  await waitForElements(page, 'photo')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(progressToast(page)).toHaveCount(0)

  // The photo in flight when Cancel was pressed may still land; nothing after it does.
  await page.waitForTimeout(3000)
  const settled = await countElements(page, 'photo')
  expect(settled).toBeGreaterThanOrEqual(1)
  expect(settled).toBeLessThan(20)
  await page.waitForTimeout(1500)
  expect(await countElements(page, 'photo')).toBe(settled)
})

test('a finished import takes its progress toast with it', async ({ page }) => {
  await openApp(page)
  await pickJpegs(page, 3, [400, 300])
  await waitForElements(page, 'photo', 3)
  await expect(progressToast(page)).toHaveCount(0)
})

test('cancelling a pixel tool leaves the photo as it was', async ({ page }) => {
  test.setTimeout(60_000)
  await openApp(page)
  await pickJpegs(page, 1, [800, 600])
  await waitForElements(page, 'photo')
  const before = await page.evaluate(() => {
    const s = window.__editor!.getState() as unknown as {
      elements: { id: string; type: string; src: string }[]
      select: (id: string) => void
    }
    const p = s.elements.find((e) => e.type === 'photo')!
    s.select(p.id)
    return p.src
  })
  // The tool runs on the 1080px preview in a worker and is done in a blink; hold the job
  // back so Cancel is pressed while it is still in flight.
  await page.evaluate(() => {
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (this: Worker, ...args: [unknown, Transferable[]]) {
      setTimeout(() => post.apply(this, args), 3000)
    }
  })

  await page.getByRole('button', { name: 'Remove BG' }).click()
  const busy = page.getByRole('status').getByText('Removing background')
  await expect(busy).toBeVisible()
  await page.getByRole('status').getByRole('button', { name: 'Cancel' }).click()
  await expect(busy).toHaveCount(0)

  await page.waitForTimeout(5000)
  const after = await page.evaluate(
    () =>
      (
        window.__editor!.getState() as unknown as { elements: { type: string; src: string }[] }
      ).elements.find((e) => e.type === 'photo')!.src,
  )
  expect(after).toBe(before)
  await expect(page.getByText('Background removed!')).toHaveCount(0)
})
