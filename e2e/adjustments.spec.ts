import { test, expect, type Page } from '@playwright/test'
import { openApp, settleCanvas, skipGallery } from './helpers'

/** An inverting 2×2×2 .cube LUT. */
const INVERT_CUBE = [
  'TITLE "Invert"',
  'LUT_3D_SIZE 2',
  ...[0, 1].flatMap((b) =>
    [0, 1].flatMap((g) => [0, 1].map((r) => [1 - r, 1 - g, 1 - b].join(' '))),
  ),
].join('\n')

async function openFiltersFor(page: Page) {
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.evaluate(() => {
    const get = window.__editor!.getState
    get().select(get().elements.at(-1)!.id)
  })
}

async function addRedPhoto(page: Page) {
  await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 40
    c.height = 40
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 40, 40)
    const get = window.__editor!.getState
    get().addPhoto(c.toDataURL('image/png'), 40, 40)
    const { boardWidth: width, boardHeight: height } = get() as unknown as {
      boardWidth: number
      boardHeight: number
    }
    get().updateElement(get().elements.at(-1)!.id, { x: 0, y: 0, width, height } as never)
  })
}

/** The board pixel at a fraction of the board, read off the stage canvas. */
async function boardPixel(page: Page, at: [number, number]) {
  await settleCanvas(page)
  return page.evaluate(([fx, fy]) => {
    const r = window.__boardRect!()
    const canvas = document.querySelector<HTMLCanvasElement>('.konvajs-content canvas')!
    const box = canvas.getBoundingClientRect()
    const x = Math.floor(((r.x + r.width * fx - box.left) * canvas.width) / box.width)
    const y = Math.floor(((r.y + r.height * fy - box.top) * canvas.height) / box.height)
    return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data.slice(0, 3))
  }, at)
}

const lutInput = (page: Page) => page.locator('input[type="file"][accept=".cube"]')

async function importLut(page: Page, text: string, name = 'invert.cube') {
  await lutInput(page).setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) })
}

const isRed = ([r, g, b]: number[]) => r > 200 && g < 50 && b < 50
const isCyan = ([r, g, b]: number[]) => r < 50 && g > 200 && b > 200

test.describe('advanced adjustments', () => {
  test('a .cube LUT recolours the photo; hold, or press from the keyboard, to compare', async ({
    page,
  }) => {
    await openApp(page)
    await skipGallery(page)
    await addRedPhoto(page)
    await openFiltersFor(page)

    await importLut(page, INVERT_CUBE)
    await expect(page.getByRole('button', { name: 'Import .cube LUT (Invert)' })).toBeVisible()
    await expect.poll(() => boardPixel(page, [0.5, 0.5]).then(isCyan)).toBe(true)

    const compare = page.getByRole('button', { name: 'Hold to compare' })
    await compare.hover()
    await page.mouse.down()
    await expect.poll(() => boardPixel(page, [0.5, 0.5]).then(isRed)).toBe(true)
    await page.mouse.up()
    await expect.poll(() => boardPixel(page, [0.5, 0.5]).then(isCyan)).toBe(true)

    await expect(compare).toHaveAttribute('aria-pressed', 'false')

    await compare.focus()
    await page.keyboard.press('Space')
    await expect(compare).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => boardPixel(page, [0.5, 0.5]).then(isRed)).toBe(true)
    await page.keyboard.press('Space')
    await expect(compare).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => boardPixel(page, [0.5, 0.5]).then(isCyan)).toBe(true)
  })

  test('adjustments render in grid mode too', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addRedPhoto(page)
    await page.evaluate(() => {
      const get = window.__editor!.getState
      get().setMode('grid')
      get().setGrid('1-full')
    })
    await openFiltersFor(page)
    await importLut(page, INVERT_CUBE)
    await expect.poll(() => boardPixel(page, [0.5, 0.5]).then(isCyan)).toBe(true)
  })

  test('an unreadable .cube file is refused with the reason', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addRedPhoto(page)
    await openFiltersFor(page)
    await importLut(page, 'LUT_3D_SIZE 2\n0 0 0', 'short.cube')
    await expect(page.getByText(/expected 8 entries, found 1/)).toBeVisible()
    const stack = await page.evaluate(() => {
      const el = window.__editor!.getState().elements.at(-1) as unknown as {
        filterStack?: { type: string }[]
      }
      return el.filterStack?.map((op) => op.type)
    })
    expect(stack).not.toContain('lut')
  })
})
