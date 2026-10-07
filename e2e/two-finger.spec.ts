import { test, expect, type Page } from '@playwright/test'
import { openApp, skipGallery } from './helpers'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

interface TwistEditor {
  elements: { id: string; x: number; y: number; rotation: number; scaleX: number; scaleY: number }[]
  selectedId: string | null
  canvasZoom: number
  boardWidth: number
  addSticker: (emoji: string) => void
  select: (id: string | null) => void
  undo: () => void
}

const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window.__editor as unknown as { getState: () => TwistEditor }).getState()
    const [el] = s.elements
    return {
      selectedId: s.selectedId,
      canvasZoom: s.canvasZoom,
      el: { x: el.x, y: el.y, rotation: el.rotation, scaleX: el.scaleX, scaleY: el.scaleY },
    }
  })

/** Board point → viewport point. */
async function onScreen(page: Page, bx: number, by: number) {
  return page.evaluate(
    ([bx, by]) => {
      const s = (window.__editor as unknown as { getState: () => TwistEditor }).getState()
      const r = window.__boardRect!()
      const k = r.width / s.boardWidth
      return { x: r.x + bx * k, y: r.y + by * k }
    },
    [bx, by],
  )
}

/**
 * Two real touch points through CDP: both land around `centre`, `spread0` px
 * apart and level, then glide to `spread1` px apart at `turnDeg` degrees.
 */
async function twoFingerGesture(
  page: Page,
  centre: { x: number; y: number },
  {
    spread0,
    spread1,
    turnDeg,
    pauseMs = 0,
  }: { spread0: number; spread1: number; turnDeg: number; pauseMs?: number },
) {
  const cdp = await page.context().newCDPSession(page)
  const fingers = (spread: number, deg: number) => {
    const r = (deg * Math.PI) / 180
    const hx = (Math.cos(r) * spread) / 2
    const hy = (Math.sin(r) * spread) / 2
    return [
      { x: centre.x - hx, y: centre.y - hy, id: 1 },
      { x: centre.x + hx, y: centre.y + hy, id: 2 },
    ]
  }
  const [first, second] = fingers(spread0, 0)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] })
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: fingers(spread0 + (spread1 - spread0) * t, turnDeg * t),
    })
    if (i === steps / 2 && pauseMs) await page.waitForTimeout(pauseMs)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

test.describe('two-finger gestures', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const calls: number[] = []
      ;(window as unknown as { __vibrations: number[] }).__vibrations = calls
      navigator.vibrate = (p: VibratePattern) => {
        calls.push(Number(p))
        return true
      }
    })
    await openApp(page)
    await skipGallery(page)
    await page.evaluate(() =>
      (window.__editor as unknown as { getState: () => TwistEditor }).getState().addSticker('⭐'),
    )
  })

  test('pinch-and-twist rotates and scales the selected element, snapping to 15°', async ({
    page,
  }) => {
    const before = await state(page)
    expect(before.selectedId).not.toBeNull()
    // Start with one finger off the element, on the empty board: that must not
    // deselect it once the second finger turns the touch into a gesture.
    const centre = await onScreen(page, before.el.x, before.el.y + 250)

    await twoFingerGesture(page, centre, { spread0: 120, spread1: 180, turnDeg: 43 })

    const after = await state(page)
    expect(after.selectedId).toBe(before.selectedId)
    expect(after.el.rotation).toBe(45)
    expect(after.el.scaleX).toBeCloseTo(1.5, 1)
    expect(after.el.scaleY).toBeCloseTo(1.5, 1)
    expect(after.canvasZoom).toBe(before.canvasZoom)
    expect(
      await page.evaluate(() => (window as unknown as { __vibrations: number[] }).__vibrations),
    ).not.toHaveLength(0)

    await page.evaluate(() =>
      (window.__editor as unknown as { getState: () => TwistEditor }).getState().undo(),
    )
    expect((await state(page)).el).toEqual(before.el)
  })

  test('a twist that starts with a finger on the element, and pauses, is still one undo step', async ({
    page,
  }) => {
    const before = await state(page)
    // Both fingers land on the sticker itself, which arms Konva's own drag.
    const centre = await onScreen(page, before.el.x, before.el.y)

    await twoFingerGesture(page, centre, { spread0: 16, spread1: 32, turnDeg: 88, pauseMs: 900 })

    const after = await state(page)
    expect(after.el.rotation).toBe(90)
    expect(after.el.scaleX).toBeCloseTo(2, 1)
    await page.evaluate(() =>
      (window.__editor as unknown as { getState: () => TwistEditor }).getState().undo(),
    )
    expect((await state(page)).el).toEqual(before.el)
  })

  test('with nothing selected, two fingers zoom the board and leave elements alone', async ({
    page,
  }) => {
    await page.evaluate(() =>
      (window.__editor as unknown as { getState: () => TwistEditor }).getState().select(null),
    )
    const before = await state(page)
    const centre = await onScreen(page, 540, 675)

    await twoFingerGesture(page, centre, { spread0: 100, spread1: 200, turnDeg: 30 })

    const after = await state(page)
    expect(after.canvasZoom).toBeGreaterThan(before.canvasZoom)
    expect(after.el).toEqual(before.el)
  })

  test('a one-finger tap on the empty board still deselects', async ({ page }) => {
    const before = await state(page)
    expect(before.selectedId).not.toBeNull()
    const spot = await onScreen(page, 60, 1300)
    await page.touchscreen.tap(spot.x, spot.y)
    await expect.poll(async () => (await state(page)).selectedId).toBeNull()
  })
})
