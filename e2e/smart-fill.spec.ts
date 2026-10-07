import { test, expect, type Page } from '@playwright/test'
import { openApp, waitForElements } from './helpers'

async function solidPng(page: Page, name: string, width: number, height: number) {
  const base64 = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#3b82f6'
      ctx.fillRect(0, 0, width, height)
      return canvas.toDataURL('image/png').split(',')[1]
    },
    { width, height },
  )
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

const cellIndexes = (page: Page) =>
  page.evaluate(() =>
    (window.__editor!.getState().elements as { type: string; cellIndex?: number }[])
      .filter((e) => e.type === 'photo')
      .map((e) => e.cellIndex ?? null),
  )

test('smart fill seats each photo in the cell of its shape, as one undo step', async ({ page }) => {
  await openApp(page)
  const wide = await solidPng(page, 'wide.png', 800, 300)
  const tall = await solidPng(page, 'tall.png', 400, 800)
  await page.locator('#empty-gallery-input').setInputFiles([wide, tall])
  await waitForElements(page, 'photo', 2)
  await page.evaluate(() => {
    const get = window.__editor!.getState
    get().setMode('grid')
    get().setGrid('2-big-small')
  })
  expect(await cellIndexes(page)).toEqual([null, null])

  await page.getByRole('button', { name: 'Layout', exact: true }).click()
  await page.getByRole('button', { name: 'Smart fill' }).click()
  await expect(page.getByText('Photos placed to keep faces in frame')).toBeVisible()
  // The wide photo takes the short bottom cell, the tall one the big top cell.
  await expect.poll(() => cellIndexes(page)).toEqual([1, 0])

  await page.keyboard.press('Control+z')
  await expect.poll(() => cellIndexes(page)).toEqual([null, null])
})

test('smart fill is offered only in grid mode', async ({ page }) => {
  await openApp(page)
  const a = await solidPng(page, 'a.png', 600, 600)
  const b = await solidPng(page, 'b.png', 600, 600)
  await page.locator('#empty-gallery-input').setInputFiles([a, b])
  await waitForElements(page, 'photo', 2)
  await page.evaluate(() => {
    const get = window.__editor!.getState
    get().setMode('grid')
    get().setGrid('2-big-small')
    get().setMode('free')
  })
  await page.getByRole('button', { name: 'Layout', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Smart fill' })).toHaveCount(0)
})

test('smart fill leaves photos pinned around a gap where they are when nothing fits better', async ({
  page,
}) => {
  await openApp(page)
  const a = await solidPng(page, 'a.png', 600, 600)
  const b = await solidPng(page, 'b.png', 600, 600)
  await page.locator('#empty-gallery-input').setInputFiles([a, b])
  await waitForElements(page, 'photo', 2)
  await page.evaluate(() => {
    const get = window.__editor!.getState
    get().setMode('grid')
    get().setGrid('4-grid')
    const ids = get()
      .elements.filter((e) => e.type === 'photo')
      .map((e) => e.id)
    get().updateElements({ [ids[0]]: { cellIndex: 2 }, [ids[1]]: { cellIndex: 3 } })
  })
  await page.getByRole('button', { name: 'Layout', exact: true }).click()
  await page.getByRole('button', { name: 'Smart fill' }).click()
  await expect(page.getByText('Photos placed to keep faces in frame')).toBeVisible()
  expect(await cellIndexes(page)).toEqual([2, 3])
})
