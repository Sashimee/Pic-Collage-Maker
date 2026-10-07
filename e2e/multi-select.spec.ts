import { test, expect, type Page } from '@playwright/test'
import { afterFrame, openApp, settleCanvas, skipGallery } from './helpers'

interface MultiEditor {
  elements: { id: string; x: number; y: number; rotation: number }[]
  selectedId: string | null
  multiSelected: string[]
  past: unknown[]
  addSticker: (emoji: string) => void
  updateElement: (id: string, patch: Record<string, unknown>) => void
  select: (id: string | null) => void
  undo: () => void
}

const editor = (page: Page) =>
  page.evaluate(() => {
    const s = (window.__editor as unknown as { getState: () => MultiEditor }).getState()
    return {
      selectedId: s.selectedId,
      multiSelected: s.multiSelected,
      past: s.past.length,
      elements: s.elements.map((e) => ({ id: e.id, x: e.x, y: e.y, rotation: e.rotation })),
    }
  })

/** Three stickers spread across the top, middle and bottom of the board. */
async function threeStickers(page: Page) {
  const ids = await page.evaluate(() => {
    const ed = window.__editor as unknown as { getState: () => MultiEditor }
    for (let i = 0; i < 3; i++) ed.getState().addSticker('⭐')
    const els = ed.getState().elements
    els.forEach((e, i) => ed.getState().updateElement(e.id, { x: 200 + i * 300, y: 200 + i * 400 }))
    ed.getState().select(null)
    return els.map((e) => e.id)
  })
  await settleCanvas(page)
  return ids
}

/** The on-screen centre of an element's node. */
const centreOf = (page: Page, id: string) =>
  page.evaluate((id) => {
    const konva = (window as unknown as { Konva: { stages: import('konva/lib/Stage').Stage[] } })
      .Konva
    const stage = konva.stages[0]
    const r = stage.findOne('#' + id)!.getClientRect()
    const c = stage.container().getBoundingClientRect()
    return { x: c.left + r.x + r.width / 2, y: c.top + r.y + r.height / 2 }
  }, id)

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await afterFrame(page)
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12)
    await afterFrame(page)
  }
  await page.mouse.up()
  await afterFrame(page)
}

test('shift-click builds a selection and a group drag is one undo step', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  const [a, b, c] = await threeStickers(page)

  const pa = await centreOf(page, a)
  await page.mouse.click(pa.x, pa.y)
  await page.keyboard.down('Shift')
  const pb = await centreOf(page, b)
  await page.mouse.click(pb.x, pb.y)
  await page.keyboard.up('Shift')
  await expect.poll(async () => (await editor(page)).multiSelected).toEqual([a, b])

  const before = await editor(page)
  await drag(page, pb, { x: pb.x + 40, y: pb.y + 30 })

  const after = await editor(page)
  expect(after.multiSelected).toEqual([a, b])
  const moved = (id: string) => {
    const s = before.elements.find((e) => e.id === id)!
    const e = after.elements.find((e) => e.id === id)!
    return { dx: e.x - s.x, dy: e.y - s.y }
  }
  expect(moved(a).dx).toBeGreaterThan(20)
  expect(moved(b).dx).toBeCloseTo(moved(a).dx, 6)
  expect(moved(b).dy).toBeCloseTo(moved(a).dy, 6)
  expect(moved(c)).toEqual({ dx: 0, dy: 0 })
  expect(after.past).toBe(before.past + 1)

  await page.evaluate(() =>
    (window.__editor as unknown as { getState: () => MultiEditor }).getState().undo(),
  )
  const undone = await editor(page)
  expect(undone.elements).toEqual(before.elements)
})

test('a rubber band on empty board selects what it touches', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  const [a, b, c] = await threeStickers(page)
  const pa = await centreOf(page, a)
  const pb = await centreOf(page, b)
  const pc = await centreOf(page, c)

  // From empty board above-left of the first sticker to just past the second.
  await drag(page, { x: pa.x - 30, y: pa.y - 30 }, { x: pb.x + 5, y: pb.y + 5 })
  const s = await editor(page)
  expect([...s.multiSelected].sort()).toEqual([a, b].sort())
  expect(s.multiSelected).not.toContain(c)

  await page.mouse.click(pc.x + 120, pc.y + 120)
  const cleared = await editor(page)
  expect(cleared.multiSelected).toEqual([])
  expect(cleared.selectedId).toBeNull()
})

test('a tiny rubber band is a tap, not a selection', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  const [a] = await threeStickers(page)
  const pa = await centreOf(page, a)
  await drag(page, { x: pa.x - 60, y: pa.y - 60 }, { x: pa.x - 58, y: pa.y - 58 })
  const s = await editor(page)
  expect(s.multiSelected).toEqual([])
  expect(s.selectedId).toBeNull()
})

test('Ctrl+A selects every element', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  const ids = await threeStickers(page)
  await page.keyboard.press('ControlOrMeta+a')
  await expect.poll(async () => (await editor(page)).multiSelected).toEqual(ids)
})

test('releasing a rubber band off the board still closes it', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  const [a, b] = await threeStickers(page)
  const pa = await centreOf(page, a)
  const pb = await centreOf(page, b)

  await page.mouse.move(pa.x - 30, pa.y - 30)
  await page.mouse.down()
  await afterFrame(page)
  await page.mouse.move(pb.x + 5, pb.y + 5, { steps: 8 })
  await afterFrame(page)
  await page.mouse.move(2, 2)
  await page.mouse.up()
  await afterFrame(page)
  const s = await editor(page)
  expect(s.multiSelected).toContain(a)

  // With no button held, moving back over the board must not drag a stale box.
  await page.mouse.move(pa.x, pa.y, { steps: 4 })
  await afterFrame(page)
  expect((await editor(page)).multiSelected).toEqual(s.multiSelected)
})

test('shift adds a rubber band to the selection', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  const [a, b, c] = await threeStickers(page)
  const pa = await centreOf(page, a)
  await page.mouse.click(pa.x, pa.y)
  const pc = await centreOf(page, c)
  await page.keyboard.down('Shift')
  await drag(page, { x: pc.x - 30, y: pc.y - 30 }, { x: pc.x + 5, y: pc.y + 5 })
  await page.keyboard.up('Shift')
  const s = await editor(page)
  expect(s.multiSelected).toEqual([a, c])
  expect(s.multiSelected).not.toContain(b)
})
