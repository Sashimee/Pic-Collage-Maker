import { test, expect, type Page } from '@playwright/test'
import { openApp, skipGallery } from './helpers'

/*
 * Pixel baselines for the board. Everything is set up through the dev store
 * seam with photos painted in the page, so the only inputs are the code under
 * test and the browser build. Baselines are linux-only and must be generated
 * in the Playwright container CI matches (see the visual-regression agent).
 */

interface VisualEditor {
  elements: { id: string; type: string }[]
  addPhoto: (src: string, w: number, h: number) => void
  addText: () => void
  updateElement: (id: string, patch: Record<string, unknown>) => void
  setGrid: (id: string | null) => void
  select: (id: string | null) => void
  clearAll: () => void
}

const editor = (page: Page) =>
  page.evaluateHandle(
    () => (window.__editor as unknown as { getState: () => VisualEditor }).getState,
  )

async function boardClip(page: Page) {
  const r = await page.evaluate(() => window.__boardRect?.())
  if (!r) throw new Error('__boardRect is missing — is the dev server running in DEV mode?')
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    width: Math.round(r.width),
    height: Math.round(r.height),
  }
}

async function expectBoard(page: Page, name: string) {
  await page.evaluate(() =>
    (window.__editor as unknown as { getState: () => VisualEditor }).getState().select(null),
  )
  await expect.soft(page).toHaveScreenshot(name, { clip: await boardClip(page) })
}

/** Paint `n` distinct test photos in the page and add them to the board. */
async function addPhotos(page: Page, n: number) {
  const get = await editor(page)
  await page.evaluate(
    ({ get, n }) => {
      for (let i = 0; i < n; i++) {
        const c = document.createElement('canvas')
        c.width = 320
        c.height = 240
        const ctx = c.getContext('2d')!
        const hue = (i * 47) % 360
        const g = ctx.createLinearGradient(0, 0, 320, 240)
        g.addColorStop(0, `hsl(${hue} 80% 55%)`)
        g.addColorStop(1, `hsl(${(hue + 160) % 360} 70% 35%)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 320, 240)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(40, 40, 80, 80)
        ctx.fillStyle = '#111111'
        ctx.beginPath()
        ctx.arc(230, 150, 50, 0, Math.PI * 2)
        ctx.fill()
        get().addPhoto(c.toDataURL('image/png'), 320, 240)
      }
    },
    { get, n },
  )
}

const photoIds = (page: Page) =>
  page.evaluate(() =>
    window
      .__editor!.getState()
      .elements.filter((e) => e.type === 'photo')
      .map((e) => (e as { id: string }).id),
  )

test.describe('visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openApp(page)
    await skipGallery(page)
  })

  test('every grid layout', async ({ page }) => {
    test.setTimeout(240_000)
    const layouts: { id: string; count: number }[] = await page.evaluate(async () => {
      const mod = await import(new URL('src/lib/grids.ts', document.baseURI).href)
      return (mod.GRID_LAYOUTS as { id: string; count: number }[]).map(({ id, count }) => ({
        id,
        count,
      }))
    })
    expect(layouts.length).toBeGreaterThan(0)
    await addPhotos(page, Math.max(...layouts.map((l) => l.count)))
    const get = await editor(page)
    for (const layout of layouts) {
      await page.evaluate(({ get, id }) => get().setGrid(id), { get, id: layout.id })
      await expectBoard(page, `grid-${layout.id}.png`)
    }
  })

  test('every filter preset', async ({ page }) => {
    await addPhotos(page, 1)
    const [id] = await photoIds(page)
    const get = await editor(page)
    for (const preset of [
      'none',
      'vivid',
      'punch',
      'warm',
      'cool',
      'fade',
      'sepia',
      'noir',
      'grayscale',
    ]) {
      await page.evaluate(
        ({ get, id, preset }) =>
          get().updateElement(id, {
            x: 140,
            y: 300,
            width: 800,
            height: 600,
            filterStack: [{ type: 'preset', id: preset }],
          }),
        { get, id, preset },
      )
      await expectBoard(page, `filter-${preset}.png`)
    }
  })

  test('text styles', async ({ page }) => {
    const get = await editor(page)
    const styles: Record<string, unknown>[] = [
      { text: 'Plain bold', y: 120 },
      {
        text: 'Italic outline',
        y: 300,
        fontStyle: 'italic',
        fill: '#f59e0b',
        stroke: '#111827',
        strokeWidth: 3,
      },
      { text: 'Shadow', y: 480, fill: '#2563eb', shadowColor: '#000000', shadowBlur: 12 },
      {
        text: 'Chip',
        y: 660,
        fill: '#ffffff',
        chip: { color: '#db2777', padding: 18, radius: 12 },
      },
      { text: 'Curved text', y: 900, curve: 80 },
    ]
    for (const style of styles) {
      await page.evaluate(
        ({ get, style }) => {
          get().addText()
          const els = get().elements
          get().updateElement(els[els.length - 1].id, { x: 120, ...style })
        },
        { get, style },
      )
    }
    await page.evaluate(() => document.fonts.ready)
    await expectBoard(page, 'text-styles.png')
  })

  test('PNG and PDF export renders', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'))
    await addPhotos(page, 4)
    const get = await editor(page)
    await page.evaluate(({ get }) => get().setGrid('4-grid'), { get })
    await expectBoard(page, 'export-board.png')

    for (const [item, file] of [
      ['Download PNG', 'export.png'],
      ['Export PDF', 'export.pdf'],
    ] as const) {
      await page.getByRole('button', { name: 'Export' }).click()
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('menuitem', { name: item }).click(),
      ])
      const path = await download.path()
      const { readFile } = await import('node:fs/promises')
      expect.soft(await readFile(path)).toMatchSnapshot(file)
    }
  })
})
