import { test, expect } from '@playwright/test'
import {
  assignmentSheet,
  clickOnBoard,
  dragOnCanvas,
  enterCustomLayout,
  getMode,
  getZones,
  loopOnCanvas,
  openApp,
  pngFile,
  waitForElements,
} from './helpers'

/**
 * The draw-your-own layout editor. Every case here is a regression guard: this
 * feature used to need 20+ strokes before anything split, because the splitter
 * demanded 35% cell coverage and the hit target was exactly board-sized, so any
 * stroke that overshot an edge was dropped.
 */
test.describe('custom layout', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
    await enterCustomLayout(page)
    await expect.poll(() => getZones(page)).toHaveLength(1)
  })

  test('one horizontal stroke splits the board on the first try', async ({ page }) => {
    await dragOnCanvas(page, [0.1, 0.5], [0.9, 0.5])
    const zones = await getZones(page)
    expect(zones).toHaveLength(2)
    // An axis-aligned cut must still yield plain rectangles.
    expect(zones.every((z) => z.sides === 4 && z.axisAligned)).toBe(true)
  })

  test('a stroke that overshoots the board still cuts', async ({ page }) => {
    await dragOnCanvas(page, [-0.15, 0.35], [1.15, 0.35])
    expect(await getZones(page)).toHaveLength(2)
  })

  test('a stroke confined to one zone only splits that zone', async ({ page }) => {
    await dragOnCanvas(page, [0.1, 0.5], [0.9, 0.5])
    await dragOnCanvas(page, [0.5, 0.62], [0.5, 0.9])
    expect(await getZones(page)).toHaveLength(3)
  })

  test('a diagonal stroke produces oblique zones', async ({ page }) => {
    await dragOnCanvas(page, [0.08, 0.15], [0.92, 0.85])
    const zones = await getZones(page)
    expect(zones).toHaveLength(2)
    // Triangles/trapezoids — i.e. corners that don't sit on their own bounding
    // box — rather than rectangles snapped back to an axis.
    expect(zones.every((z) => !z.axisAligned)).toBe(true)
  })

  test('the circle tool rounds off a zone', async ({ page }) => {
    await page.getByTitle('Round zone').click()
    await loopOnCanvas(page, [0.5, 0.5], 40)
    const zones = await getZones(page)
    expect(zones).toHaveLength(1)
    expect(zones[0].shape).toMatch(/circle|ellipse/)
  })

  test('the circle tool can float a round zone on top', async ({ page }) => {
    await page.getByTitle('Round zone').click()
    await page.getByTitle('On top').click()
    await loopOnCanvas(page, [0.5, 0.5], 40)
    const zones = await getZones(page)
    expect(zones).toHaveLength(2)
    expect(zones.filter((z) => z.overlay)).toHaveLength(1)
  })

  test('a gesture that cannot split says so instead of failing silently', async ({ page }) => {
    // Hugs the very top edge: any cut there would leave an unusable sliver.
    await dragOnCanvas(page, [0.1, 0.002], [0.9, 0.002])
    await expect(page.getByText(/didn't cross a zone/i)).toBeVisible()
    expect(await getZones(page)).toHaveLength(1)
  })

  test('tapping a zone merges it back', async ({ page }) => {
    await dragOnCanvas(page, [0.1, 0.5], [0.9, 0.5])
    expect(await getZones(page)).toHaveLength(2)

    await clickOnBoard(page, [0.5, 0.25])
    await expect.poll(() => getZones(page)).toHaveLength(1)
  })

  test('undo steps back one split at a time', async ({ page }) => {
    await dragOnCanvas(page, [0.1, 0.5], [0.9, 0.5])
    await dragOnCanvas(page, [0.5, 0.62], [0.5, 0.9])
    expect(await getZones(page)).toHaveLength(3)

    await page.getByTitle('Undo last').click()
    await expect.poll(() => getZones(page)).toHaveLength(2)
  })

  test('applying the layout opens the assignment sheet', async ({ page }) => {
    await dragOnCanvas(page, [0.1, 0.5], [0.9, 0.5])
    await page.getByTitle('Apply layout').click()
    await expect.poll(() => getMode(page)).toBe('grid')
    await expect(assignmentSheet(page)).toBeVisible()
  })

  test('tapping an empty cell opens the photo picker', async ({ page }) => {
    await dragOnCanvas(page, [0.1, 0.5], [0.9, 0.5])
    await page.getByTitle('Apply layout').click()
    await expect.poll(() => getMode(page)).toBe('grid')
    await page.getByRole('button', { name: /Skip for now/i }).click()
    await expect(assignmentSheet(page)).toBeHidden()

    // Regression: empty cells had no click handler at all, so tapping the "＋"
    // placeholder did nothing.
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      clickOnBoard(page, [0.5, 0.25]),
    ])
    await chooser.setFiles(pngFile())
    await waitForElements(page, 'photo')
  })
})
