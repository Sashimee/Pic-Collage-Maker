import { test, expect } from '@playwright/test'
import { openApp, pngFile, settleCanvas, skipGallery, waitForElements } from './helpers'

/** Element ids bottom-to-top — the store's own z-order. */
const order = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__editor!.getState().elements.map((e) => e.id))

/** Board centre as a fraction of its host box, so it survives any viewport. */
async function boardCentre(page: import('@playwright/test').Page) {
  await settleCanvas(page)
  return page.evaluate(() => {
    const r = window.__boardRect!()
    const host = document.querySelector('canvas')!.parentElement!.getBoundingClientRect()
    return {
      x: (r.x + r.width / 2 - host.left) / host.width,
      y: (r.y + r.height / 2 - host.top) / host.height,
    }
  })
}

/** ZoomControls' +/− buttons call setCanvasZoom; go through the same door.
 *  Clicking them directly is unreliable because the floating selection bar
 *  overlaps them whenever something is selected. */
async function setZoom(page: import('@playwright/test').Page, z: number) {
  await page.evaluate((v) => {
    ;(window.__editor!.getState() as unknown as {
      setCanvasZoom: (n: number) => void
    }).setCanvasZoom(v)
  }, z)
  await page.waitForTimeout(150)
}

test.describe('canvas zoom', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
    await page.locator('#empty-gallery-input').setInputFiles(pngFile())
    await waitForElements(page, 'photo')
  })

  test('keeps the board centred through zoom in and out', async ({ page }) => {
    // The zoom anchor used to be the raw viewport centre, but fitToScreen
    // centres the board inside the *inset* box (tool rail, zoom controls, and
    // on mobile an open panel). Anchoring somewhere the board isn't centred
    // walked it further off-centre with every press.
    const before = await boardCentre(page)

    await setZoom(page, 1.6)
    const zoomedIn = await boardCentre(page)
    expect(zoomedIn.x).toBeCloseTo(before.x, 2)
    expect(zoomedIn.y).toBeCloseTo(before.y, 2)

    await setZoom(page, 0.5)
    const zoomedOut = await boardCentre(page)
    expect(zoomedOut.x).toBeCloseTo(before.x, 2)
    expect(zoomedOut.y).toBeCloseTo(before.y, 2)
  })

  test('stays centred with a panel open, where the inset is largest', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    const before = await boardCentre(page)

    await setZoom(page, 1.5)
    const after = await boardCentre(page)
    expect(after.x).toBeCloseTo(before.x, 2)
    expect(after.y).toBeCloseTo(before.y, 2)
  })
})

test.describe('layer reordering', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await page.getByRole('button', { name: 'Text', exact: true }).click()
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /Add text/ }).click()
      await page.waitForTimeout(120)
    }
    await waitForElements(page, 'text', 3)
    await page.getByRole('button', { name: 'Layers', exact: true }).click()
    await expect(page.locator('[data-drag-handle]')).toHaveCount(3)
  })

  test('dragging the grip reorders the layer', async ({ page }) => {
    // Reordering runs on pointer events now. It used to use HTML5
    // drag-and-drop, which never fires from touch on iOS or Android — so on a
    // phone the grip looked draggable and did nothing at all. A mouse drag
    // exercises the same pointerdown/move/up path a finger produces.
    const before = await order(page)
    const grips = page.locator('[data-drag-handle]')
    const from = (await grips.nth(0).boundingBox())!
    const to = (await grips.nth(2).boundingBox())!

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(
        from.x + from.width / 2,
        from.y + from.height / 2 + ((to.y - from.y) * i) / 8,
      )
      await page.waitForTimeout(16)
    }
    await page.mouse.up()

    await expect.poll(() => order(page)).not.toEqual(before)
    // The list renders top-layer-first, so the row that was at the top is now
    // the bottom of the z-order.
    expect((await order(page))[0]).toBe(before[before.length - 1])
  })

  test('dragging down the list sends the layer backward, not forward', async ({ page }) => {
    // The old code mapped "down the list" to bringForward, but the list is
    // rendered top-layer-first — so it moved layers the wrong way even on
    // desktop, where the drag itself worked.
    const before = await order(page)
    const topLayerId = before[before.length - 1]

    await page.locator('[data-drag-handle]').nth(0).focus()
    await page.keyboard.press('ArrowDown')

    await expect.poll(() => order(page)).not.toEqual(before)
    const after = await order(page)
    expect(after.indexOf(topLayerId)).toBe(before.indexOf(topLayerId) - 1)
  })

  test('the grip works from the keyboard too', async ({ page }) => {
    const before = await order(page)
    const bottomLayerId = before[0]

    await page.locator('[data-drag-handle]').nth(2).focus() // bottom row
    await page.keyboard.press('ArrowUp')

    await expect.poll(() => order(page)).not.toEqual(before)
    expect((await order(page)).indexOf(bottomLayerId)).toBe(1)
  })
})

interface LayerProps {
  id: string
  name?: string
  hidden?: boolean
  locked?: boolean
  opacity?: number
  blendMode?: string
}

const layerProps = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    (window.__editor!.getState().elements as unknown as LayerProps[]).map(
      ({ id, name, hidden, locked, opacity, blendMode }) => ({
        id,
        name,
        hidden,
        locked,
        opacity,
        blendMode,
      }),
    ),
  )

/** What the live stage draws for an element: null when there is no node. */
const nodeState = (page: import('@playwright/test').Page, id: string) =>
  page.evaluate((id) => {
    const konva = (window as unknown as { Konva: { stages: import('konva/lib/Stage').Stage[] } })
      .Konva
    const stage = konva.stages[0]
    if (!stage) return 'no stage yet'
    const node = stage.findOne('#' + id)
    if (!node) return null
    const r = node.getClientRect()
    const c = konva.stages[0].container().getBoundingClientRect()
    return {
      listening: node.listening(),
      opacity: node.opacity(),
      blend: node.globalCompositeOperation(),
      centre: { x: c.left + r.x + r.width / 2, y: c.top + r.y + r.height / 2 },
    }
  }, id)

/** Whether the autosaved document in IndexedDB mentions `text` yet. */
const autosaveHas = (page: import('@playwright/test').Page, text: string) =>
  page.evaluate(
    (text) =>
      new Promise<boolean>((resolve) => {
        const req = indexedDB.open('piccollage')
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('doc')) {
            db.close()
            return resolve(false)
          }
          const t = db.transaction('doc', 'readonly')
          const get = t.objectStore('doc').getAll()
          get.onsuccess = () => resolve(JSON.stringify(get.result).includes(text))
          get.onerror = () => resolve(false)
          t.oncomplete = () => db.close()
        }
        req.onerror = () => resolve(false)
      }),
    text,
  )

test('layer name, visibility, lock, opacity and blend survive a reload', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  const [a, b] = await page.evaluate(() => {
    const ed = window.__editor!.getState() as unknown as {
      addSticker: (e: string) => void
      updateElement: (id: string, p: Record<string, unknown>) => void
      select: (id: string | null) => void
    }
    ed.addSticker('⭐')
    ed.addSticker('🌙')
    const els = window.__editor!.getState().elements
    ed.updateElement(els[0].id, { x: 200, y: 300, opacity: 0.5, blendMode: 'multiply' })
    ed.updateElement(els[1].id, { x: 600, y: 900 })
    ed.select(null)
    return els.map((e) => e.id)
  })
  await settleCanvas(page)
  await page.getByRole('button', { name: 'Layers', exact: true }).click()

  // Rows are listed top layer first: b, then a.
  await page.getByRole('button', { name: /^Rename/ }).nth(1).click()
  await page.getByRole('textbox', { name: /^Rename/ }).fill('Hero star')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /Hero star/ }).first()).toBeFocused()

  await page.getByRole('button', { name: /^Rename/ }).nth(0).click()
  await page.getByRole('textbox', { name: /^Rename/ }).fill('scrapped')
  await page.keyboard.press('Escape')
  await expect(page.getByText('scrapped')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Rename/ }).nth(0)).not.toBeFocused()

  await page.getByRole('button', { name: 'Hide' }).nth(0).click()
  await page.getByRole('button', { name: 'Lock' }).nth(1).click()
  await expect.poll(() => nodeState(page, b)).toBeNull()

  const locked = (await nodeState(page, a)) as Exclude<
    Awaited<ReturnType<typeof nodeState>>,
    string | null
  >
  expect(locked).toMatchObject({ listening: false, opacity: 0.5, blend: 'multiply' })
  await page.mouse.move(locked.centre.x, locked.centre.y)
  await page.mouse.down()
  await page.mouse.move(locked.centre.x + 60, locked.centre.y + 40, { steps: 6 })
  await page.mouse.up()
  const state = await page.evaluate(() => window.__editor!.getState())
  expect(state.selectedId).not.toBe(a)
  expect(state.elements.find((e) => e.id === a)).toMatchObject({ x: 200, y: 300 })

  const before = await layerProps(page)
  expect(before).toEqual([
    { id: a, name: 'Hero star', hidden: undefined, locked: true, opacity: 0.5, blendMode: 'multiply' },
    { id: b, name: undefined, hidden: true, locked: undefined, opacity: undefined, blendMode: undefined },
  ])

  await expect.poll(() => autosaveHas(page, '"locked":true'), { timeout: 15_000 }).toBe(true)
  await page.reload()
  await page.waitForFunction(() => !!window.__editor)
  await waitForElements(page, 'sticker', 2)
  expect(await layerProps(page)).toEqual(before)
  await expect
    .poll(() => nodeState(page, a))
    .toMatchObject({ listening: false, opacity: 0.5, blend: 'multiply' })
  expect(await nodeState(page, b)).toBeNull()
})
