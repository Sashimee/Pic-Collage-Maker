import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { WHATS_NEW_TIP } from '../src/lib/changelog'

/** A tiny 2×2 red PNG — enough for loadPhotoMeta to decode. */
export const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2r9//38gYGAEESAAEGAAasgJOgzOKCoAAAAASUVORK5CYII='

export const pngBuffer = () => Buffer.from(TINY_PNG, 'base64')

export const pngFile = (name = 'fixture.png') => ({
  name,
  mimeType: 'image/png',
  buffer: pngBuffer(),
})

/** The dev handle exposed by editorStore under import.meta.env.DEV. */
interface EditorState {
  elements: { type: string }[]
  mode: string
  customLayoutZones: { poly: unknown[]; shape?: string; overlay?: boolean }[]
  gridId: string | null
  assignLayoutId: string | null
  canvasZoom: number
  clearAll: () => void
}

/** Only the members the suite drives; the real stores have far more. */
interface ProjectsState {
  activeProjectId: string | null
  pages: unknown[]
  activePage: number
  createProject: (name: string) => Promise<string>
  openProject: (id: string) => Promise<void>
  saveActiveProject: () => Promise<void>
  addPage: () => Promise<void>
  setActivePage: (index: number) => Promise<void>
}

interface VersionState {
  getSnapshots: (projectId: string) => Promise<{ id: string; timestamp: number }[]>
  restoreSnapshot: (
    id: string,
  ) => Promise<{ elements: { type: string }[] } | null>
}

declare global {
  interface Window {
    __editor?: { getState: () => EditorState }
    /** Dev-only: the board's on-screen rect (see EditorCanvas). */
    __boardRect?: () => { x: number; y: number; width: number; height: number }
    /** Dev-only store seams, for flows that have to survive a page reload. */
    __projects?: { getState: () => ProjectsState }
    __versions?: { getState: () => VersionState }
  }
}

/*
 * These assert on editor state rather than pixels: the canvas is a single
 * <canvas>, so there is nothing in the DOM to query, and state is the thing the
 * app actually persists and exports from.
 */

export const countElements = (page: Page, type: string) =>
  page.evaluate(
    (t) => window.__editor?.getState().elements.filter((e) => e.type === t).length ?? 0,
    type,
  )

export const getMode = (page: Page) =>
  page.evaluate(() => window.__editor?.getState().mode ?? '')

export const getZones = (page: Page) =>
  page.evaluate(
    () =>
      window.__editor?.getState().customLayoutZones.map((z) => {
        const poly = z.poly as { x: number; y: number }[]
        const xs = poly.map((p) => p.x)
        const ys = poly.map((p) => p.y)
        const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
        const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
        const at = (v: number, a: number, b: number) =>
          Math.abs(v - a) < 1e-6 || Math.abs(v - b) < 1e-6
        return {
          sides: poly.length,
          shape: z.shape ?? null,
          overlay: !!z.overlay,
          // A zone is oblique exactly when some vertex is not a corner of its
          // own bounding box. Counting sides doesn't work: a diagonal crossing
          // two opposite edges yields trapezoids, which still have four.
          axisAligned: poly.every((p) => at(p.x, minX, maxX) && at(p.y, minY, maxY)),
        }
      }) ?? [],
  )

/**
 * A layout card in the start-up gallery — the first one for more than one photo,
 * since the cards are labelled "1 photo", "2 photos"… Scoped to buttons on
 * purpose: other things carry labels containing "photos" too (the empty-cell
 * file input is "Add photos"), so a bare [aria-label*="photos"] would match
 * whichever comes first in the DOM.
 */
export const layoutCard = (page: Page) =>
  page.locator('button[aria-label*="photos"]').first()

/** The photo-assignment sheet's title, disambiguated from the Photos panel's
 *  "Add photos" button, which getByText would also match. */
export const assignmentSheet = (page: Page) =>
  page.getByRole('heading', { name: 'Add Photos' })

/**
 * Open the app with every first-use tip already dismissed, so tests start on
 * the layout gallery rather than under an overlay.
 *
 * All of them live in one record (`src/lib/firstUse.ts`) precisely so this is a
 * single line: a per-tip key would mean the first one anybody forgot broke the
 * specs that drive the very tools being taught.
 *
 * Pass `tips: true` to leave them armed, for the specs that test the tips.
 */
export async function openApp(page: Page, opts: { lang?: string; tips?: boolean } = {}) {
  await page.addInitScript(
    ({ lang, tips, whatsNew }) => {
      // A timestamp of 1 reads as "seen"; the value is never displayed. The
      // welcome carousel is suppressed either way — it is a full-screen modal,
      // and a spec about a gesture tip should not have to click through it.
      const seen = tips
        ? ['welcome', whatsNew]
        : ['welcome', whatsNew, 'pinch', 'draw', 'layout', 'layers', 'cellZoom']
      localStorage.setItem(
        'pic-collage-tips-v1',
        JSON.stringify(Object.fromEntries(seen.map((id) => [id, 1]))),
      )
      if (lang) localStorage.setItem('lang', lang)
    },
    { lang: opts.lang ?? '', tips: !!opts.tips, whatsNew: WHATS_NEW_TIP },
  )
  await page.goto('/')
  await page.waitForFunction(() => !!window.__editor, undefined, { timeout: 10_000 })
}

/** Click a point given in board-relative fractions. */
export async function clickOnBoard(page: Page, at: [number, number]) {
  const box = await boardBox(page)
  await page.mouse.click(box.x + box.width * at[0], box.y + box.height * at[1])
}

/** Wait until the editor holds at least `n` elements of `type`. */
export async function waitForElements(page: Page, type: string, n = 1) {
  await page.waitForFunction(
    ({ type, n }) =>
      (window.__editor?.getState().elements.filter((e) => e.type === type).length ?? 0) >= n,
    { type, n },
    { timeout: 10_000 },
  )
}

/** Dismiss the start-up layout gallery and work on a free canvas. */
export async function skipGallery(page: Page) {
  await page.locator('button.w-full', { hasText: 'Skip' }).click()
  await expect(page.getByText('Choose a Layout')).toBeHidden()
}

/**
 * Open the draw-your-own layout editor from the start-up gallery. The gallery
 * animates out over the board, and a stroke started before it is gone lands on
 * the gallery instead — the split silently never happens, on whichever test
 * drew first. Waiting for it to leave, not just for the mode, is the point.
 */
export async function enterCustomLayout(page: Page) {
  await page.locator('button.w-full', { hasText: 'Custom Layout' }).click()
  await expect(page.getByText('Choose a Layout')).toBeHidden()
  await expect.poll(() => getMode(page)).toBe('custom-layout')
  await settleCanvas(page)
}

/**
 * Pick the first preset layout in the gallery and close the assignment sheet
 * that follows, leaving the app in grid mode.
 */
export async function pickFirstLayout(page: Page) {
  await layoutCard(page).click()
  await expect(page.getByText('Add Photos')).toBeVisible()
}

/** Spy on the download path — every export route goes through createObjectURL. */
export async function spyDownloads(page: Page) {
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).__downloadTriggered = false
    const orig = URL.createObjectURL
    URL.createObjectURL = function (...args: unknown[]) {
      ;(window as unknown as Record<string, unknown>).__downloadTriggered = true
      return orig.apply(this, args as [Blob | MediaSource])
    }
  })
}

export function downloadTriggered(page: Page) {
  return page.evaluate(
    () => (window as unknown as Record<string, unknown>).__downloadTriggered as boolean,
  )
}

/**
 * Wait until the board has stopped moving. Changing mode changes the on-canvas
 * chrome, which re-runs fitToScreen, so a gesture issued straight after a mode
 * switch races the re-fit and lands on stale coordinates. Settling on the board
 * rect itself (rather than on zoom) measures exactly what the gestures consume.
 */
export async function settleCanvas(page: Page) {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __lastRect?: string; __rectStable?: number }
      const r = window.__boardRect?.()
      if (!r) return false
      const key = `${r.x.toFixed(2)}|${r.y.toFixed(2)}|${r.width.toFixed(2)}`
      if (w.__lastRect === key) w.__rectStable = (w.__rectStable ?? 0) + 1
      else {
        w.__lastRect = key
        w.__rectStable = 0
      }
      return (w.__rectStable ?? 0) >= 4
    },
    undefined,
    { timeout: 8000, polling: 50 },
  )
  await page.evaluate(() => {
    const w = window as unknown as { __lastRect?: string; __rectStable?: number }
    w.__lastRect = undefined
    w.__rectStable = 0
  })
}

async function boardBox(page: Page) {
  await settleCanvas(page)
  const box = await page.evaluate(() => window.__boardRect?.())
  if (!box) throw new Error('__boardRect missing — is this a dev build?')
  return box
}

/**
 * Yield until the page has actually rendered a frame.
 *
 * Chromium coalesces mousemoves that arrive within one frame, so a stroke
 * driven faster than the compositor loses its middle and the editor rightly
 * reads what's left as a tap. A fixed sleep only approximates "the move was
 * processed" and gets it wrong exactly when the machine is busy — which is why
 * these gesture specs failed in a different combination on every contended run.
 * Waiting on a real frame is the condition we actually need.
 */
export const afterFrame = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )

/** Drag across the board, in board-relative fractions (0..1 of the board). */
export async function dragOnCanvas(
  page: Page,
  from: [number, number],
  to: [number, number],
  steps = 16,
) {
  const box = await boardBox(page)
  const x1 = box.x + box.width * from[0]
  const y1 = box.y + box.height * from[1]
  const x2 = box.x + box.width * to[0]
  const y2 = box.y + box.height * to[1]
  await page.mouse.move(x1, y1)
  await page.mouse.down()
  await afterFrame(page)
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps)
    await afterFrame(page)
  }
  await page.mouse.up()
  await afterFrame(page)
}

/** Draw a closed loop on the board, for the round-zone tool. */
export async function loopOnCanvas(page: Page, centre: [number, number], radiusPx = 40) {
  const box = await boardBox(page)
  const cx = box.x + box.width * centre[0]
  const cy = box.y + box.height * centre[1]
  await page.mouse.move(cx + radiusPx, cy)
  await afterFrame(page)
  await page.mouse.down()
  await afterFrame(page)
  for (let i = 1; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2
    await page.mouse.move(cx + Math.cos(a) * radiusPx, cy + Math.sin(a) * radiusPx)
    await afterFrame(page)
  }
  await page.mouse.up()
  await afterFrame(page)
}

/** Removes the File System Access pickers, as in Firefox and Safari, so project files save as downloads. */
export async function withoutFilePickers(page: Page) {
  await page.addInitScript(() => {
    for (const name of ['showSaveFilePicker', 'showOpenFilePicker'])
      Object.defineProperty(window, name, { value: undefined, configurable: true })
  })
}
