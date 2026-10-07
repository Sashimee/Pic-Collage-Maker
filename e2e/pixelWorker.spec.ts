import { test, expect, type Page } from '@playwright/test'
import { openApp, pngFile, waitForElements } from './helpers'

declare global {
  interface Window {
    __longTasks?: { start: number; duration: number }[]
  }
}

const longTasksSince = (page: Page, since: number) =>
  page.evaluate(
    (t) =>
      (window.__longTasks ?? []).filter((e) => e.start >= t).map((e) => Math.round(e.duration)),
    since,
  )

test('a 24 MP photo imports and takes a pixel tool without freezing the page', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    window.__longTasks = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        window.__longTasks!.push({ start: e.startTime, duration: e.duration })
    }).observe({ type: 'longtask' })
  })
  const warnings: string[] = []
  page.on('console', (m) => warnings.push(m.text()))
  await openApp(page)
  // The editor mounting on the first photo is a long task of its own, and not pixel work.
  await page.locator('#empty-gallery-input').setInputFiles(pngFile('small.png'))
  await waitForElements(page, 'photo')
  await page.locator('#panel-gallery-input').waitFor({ state: 'attached' })

  // Encoding the fixture is itself a long task, so it happens before the clock starts.
  const since = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(6000, 4000)
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 6000, 4000)
    g.addColorStop(0, '#f8f8f8')
    g.addColorStop(1, '#e8e8e8')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 6000, 4000)
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(2000, 1200, 2000, 1600)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    ;(window as unknown as { __fixture: File }).__fixture = new File([blob], 'big.jpg', {
      type: 'image/jpeg',
    })
    await new Promise((r) => setTimeout(r, 300))
    return performance.now()
  })

  // Roughly a mid-range phone; at this rate the old on-page decode blocked for over 500 ms.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })

  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#panel-gallery-input')!
    const dt = new DataTransfer()
    dt.items.add((window as unknown as { __fixture: File }).__fixture)
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await waitForElements(page, 'photo', 2)
  const photo = await page.evaluate(() => {
    const s = window.__editor!.getState() as unknown as {
      elements: { id: string; type: string; width: number; height: number }[]
      select: (id: string) => void
    }
    const p = s.elements.filter((e) => e.type === 'photo')[1]
    s.select(p.id)
    return p.width / p.height
  })
  expect(photo).toBeCloseTo(1.5)
  expect(warnings.filter((w) => w.includes('worker decode failed'))).toEqual([])

  await page.getByRole('button', { name: 'Remove BG' }).click()
  await expect(page.getByText('Background removed!')).toBeVisible({ timeout: 30_000 })
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = window.__editor!.getState() as unknown as { elements: { src?: string }[] }
        return s.elements[1]?.src?.slice(0, 15)
      }),
    )
    .toBe('data:image/png;')

  const tasks = await longTasksSince(page, since)
  expect(Math.max(0, ...tasks)).toBeLessThan(200)
})
