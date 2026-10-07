import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { afterFrame, countElements, openApp, pngFile, skipGallery, waitForElements } from './helpers'

/**
 * The page strip, driven the way a user drives it. The store actions already
 * have unit coverage; what these cover is the UI actually being wired to them —
 * including the case with no project yet, where `addPage()` alone is a no-op
 * and the strip has to create the project first.
 */

const tiles = (page: Page) => page.locator('[data-page-tile]')
const addButton = (page: Page) => page.getByRole('button', { name: 'Add page' })

const pageCount = (page: Page) =>
  page.evaluate(() => window.__projects!.getState().pages.length)

const activePage = (page: Page) =>
  page.evaluate(() => window.__projects!.getState().activePage)

/** Put one photo on the current page and wait for it to land. */
async function addPhoto(page: Page, name: string) {
  const empty = page.locator('#empty-gallery-input')
  if (await empty.count()) {
    await empty.setInputFiles(pngFile(name))
  } else {
    await page.getByRole('button', { name: 'Photos', exact: true }).click()
    await page.locator('#panel-gallery-input').setInputFiles(pngFile(name))
  }
  await waitForElements(page, 'photo')
}

test.describe('page strip', () => {
  test('shows a single page before anything has been saved', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    // No project exists yet, but the canvas is still a page — and the strip has
    // to show it, or there is no way to reach the "+" that creates the project.
    await expect(tiles(page)).toHaveCount(1)
    await expect(addButton(page)).toBeVisible()
  })

  test('adding a page creates the project it needs and leaves a blank board', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'first.png')

    await addButton(page).click()

    await expect(tiles(page)).toHaveCount(2)
    // addPage is a silent no-op without a project; the strip creates one.
    expect(await page.evaluate(() => window.__projects!.getState().activeProjectId)).toBeTruthy()
    expect(await pageCount(page)).toBe(2)
    // Poll rather than read once: the tiles appear as soon as the page list
    // grows, but loading the new blank page into the editor waits on an
    // IndexedDB round-trip, so the board blanks a moment later.
    await expect.poll(() => activePage(page)).toBe(1)
    await expect.poll(() => countElements(page, 'photo')).toBe(0)
  })

  test('tapping a tile switches the board back and forth', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'first.png')
    await addButton(page).click()
    await expect(tiles(page)).toHaveCount(2)
    await addPhoto(page, 'second.png')

    await tiles(page).nth(0).click()
    await expect.poll(() => activePage(page)).toBe(0)
    // The first page's work survived being left — this is the regression the
    // live-document fold in commitPages exists for.
    await expect.poll(() => countElements(page, 'photo')).toBe(1)

    await tiles(page).nth(1).click()
    await expect.poll(() => activePage(page)).toBe(1)
    await expect.poll(() => countElements(page, 'photo')).toBe(1)
  })

  test('dragging a tile past its neighbour reorders the pages', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'first.png')
    await addButton(page).click()
    await expect(tiles(page)).toHaveCount(2)

    // Page 1 has a photo, page 2 is blank — enough to tell them apart.
    const before = await page.evaluate(() =>
      window.__projects!.getState().pages.map((p) => (p as { elements: unknown[] }).elements.length),
    )
    expect(before).toEqual([1, 0])

    const from = (await tiles(page).nth(0).boundingBox())!
    const to = (await tiles(page).nth(1).boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await afterFrame(page)
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(
        from.x + from.width / 2 + ((to.x - from.x) * i) / 8,
        from.y + from.height / 2,
      )
      await afterFrame(page)
    }
    await page.mouse.up()
    await afterFrame(page)

    await expect
      .poll(() =>
        page.evaluate(() =>
          window
            .__projects!.getState()
            .pages.map((p) => (p as { elements: unknown[] }).elements.length),
        ),
      )
      .toEqual([0, 1])
  })

  test('the arrow keys reorder pages too', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'first.png')
    await addButton(page).click()
    await expect(tiles(page)).toHaveCount(2)
    // The strip ignores input while a page switch is in flight, so let the one
    // that "+" started finish before pressing a key at it.
    await expect.poll(() => activePage(page)).toBe(1)

    await tiles(page).nth(0).focus()
    await page.keyboard.press('ArrowRight')

    await expect
      .poll(() =>
        page.evaluate(() =>
          window
            .__projects!.getState()
            .pages.map((p) => (p as { elements: unknown[] }).elements.length),
        ),
      )
      .toEqual([0, 1])
  })

  test('a tap on a tile still selects rather than counting as a drag', async ({ page }) => {
    // The whole tile is draggable, so the gesture needs a movement threshold or
    // every tap becomes a no-op reorder.
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'first.png')
    await addButton(page).click()
    await expect(tiles(page)).toHaveCount(2)

    const box = (await tiles(page).nth(0).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await afterFrame(page)
    await page.mouse.up()

    await expect.poll(() => activePage(page)).toBe(0)
    await expect.poll(() => pageCount(page)).toBe(2)
  })

  test('both pages survive a reload with their photos', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'first.png')
    await addButton(page).click()
    await expect(tiles(page)).toHaveCount(2)
    await addPhoto(page, 'second.png')

    const projectId = await page.evaluate(async () => {
      await window.__projects!.getState().saveActiveProject()
      return window.__projects!.getState().activeProjectId
    })

    await page.reload()
    await page.waitForFunction(() => !!window.__editor)
    await page.evaluate(async (id) => {
      window.__editor!.getState().clearAll()
      await window.__projects!.getState().openProject(id!)
    }, projectId)

    await expect(tiles(page)).toHaveCount(2)
    for (const index of [0, 1]) {
      await tiles(page).nth(index).click()
      await expect.poll(() => activePage(page)).toBe(index)
      await expect.poll(() => countElements(page, 'photo')).toBe(1)
    }
  })

  test('deleting a page removes it and cannot empty the project', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'first.png')
    await addButton(page).click()
    await expect(tiles(page)).toHaveCount(2)

    await page.getByRole('button', { name: 'Delete page' }).click()

    await expect(tiles(page)).toHaveCount(1)
    // The last page can't be deleted — the button is the honest place to say so.
    await expect(page.getByRole('button', { name: 'Delete page' })).toBeDisabled()
  })

  test('a deleted page comes back, with its work, from the toast', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'first.png')
    await addButton(page).click()
    await expect(tiles(page)).toHaveCount(2)
    await tiles(page).first().click()
    await expect.poll(() => activePage(page)).toBe(0)

    await page.getByRole('button', { name: 'Delete page' }).click()
    await expect(tiles(page)).toHaveCount(1)
    await expect.poll(() => countElements(page, 'photo')).toBe(0)

    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
    await expect(tiles(page)).toHaveCount(2)
    await expect.poll(() => activePage(page)).toBe(0)
    await expect.poll(() => countElements(page, 'photo')).toBe(1)
  })
})
