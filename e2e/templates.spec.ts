import { test, expect, type Page } from '@playwright/test'
import { downloadTriggered, openApp, pngFile, spyDownloads, waitForElements } from './helpers'

const editor = (page: Page) =>
  page.evaluate(() => {
    const s = window.__editor!.getState() as unknown as {
      boardWidth: number
      boardHeight: number
      gridId: string | null
      mode: string
      elements: { type: string; text?: string }[]
    }
    return {
      size: [s.boardWidth, s.boardHeight],
      gridId: s.gridId,
      mode: s.mode,
      types: s.elements.map((e) => e.type),
      texts: s.elements.flatMap((e) => (e.text ? [e.text] : [])),
    }
  })

const imagesOnStage = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { Konva: { stages: import('konva/lib/Stage').Stage[] } }
      ).Konva.stages[0].find('Image').length,
  )

test.describe('templates', () => {
  test('template → photos into its frames → export', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Templates' }).click()
    await page.getByRole('button', { name: 'Happy Birthday!, Square' }).click()

    await expect(page.getByText('Template applied')).toBeVisible()
    await expect(page.getByText('Choose a Layout')).toBeHidden()
    await expect
      .poll(() => editor(page))
      .toMatchObject({
        size: [1080, 1080],
        gridId: 'polaroid-2',
        mode: 'grid',
        texts: ['Happy Birthday!', 'Make a wish'],
      })

    await page.getByRole('button', { name: 'Photos', exact: true }).click()
    await page.locator('#panel-gallery-input').setInputFiles([pngFile('a.png'), pngFile('b.png')])
    await waitForElements(page, 'photo', 2)
    await expect.poll(() => imagesOnStage(page)).toBeGreaterThanOrEqual(2)
    expect((await editor(page)).gridId).toBe('polaroid-2')

    await spyDownloads(page)
    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByRole('menuitem', { name: 'Download PNG' }).click()
    await expect.poll(() => downloadTriggered(page)).toBe(true)
  })

  test('the Layout panel applies a template over existing photos, and undo brings the old board back', async ({
    page,
  }) => {
    await openApp(page)
    await page.locator('#empty-gallery-input').setInputFiles(pngFile())
    await waitForElements(page, 'photo')
    const before = await editor(page)

    await page.getByRole('button', { name: 'Layout', exact: true }).click()
    await page
      .getByRole('group', { name: 'Templates' })
      .getByRole('button', { name: 'Print', exact: true })
      .click()
    await page.getByRole('button', { name: /\d{4}, Portrait$/ }).click()

    await expect
      .poll(() => editor(page))
      .toMatchObject({ gridId: 'tpl-calendar', size: [1080, 1350] })
    const after = await editor(page)
    expect(after.types[0]).toBe('photo')
    expect(after.texts[0]).toMatch(String(new Date().getFullYear()))

    await page.keyboard.press('Control+z')
    await expect
      .poll(() => editor(page))
      .toMatchObject({ gridId: before.gridId, types: before.types })
  })

  test('a board saved as my template survives a reload and applies again', async ({ page }) => {
    await openApp(page)
    await page.locator('#empty-gallery-input').setInputFiles(pngFile())
    await waitForElements(page, 'photo')
    await page.getByRole('button', { name: 'Layout', exact: true }).click()
    await page.getByRole('button', { name: 'Happy Birthday!, Square' }).click()
    await expect.poll(() => editor(page)).toMatchObject({ gridId: 'polaroid-2' })

    const gallery = page.getByRole('group', { name: 'Templates' })
    await gallery.getByRole('button', { name: 'Mine', exact: true }).click()
    await expect(page.getByText('Templates you save show up here.')).toBeVisible()
    await page.getByRole('button', { name: 'Save as my template' }).click()
    await expect(page.getByText('Saved to your templates.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Happy Birthday!', exact: true })).toBeVisible()

    await page.reload()
    await page.waitForFunction(() => !!window.__editor, undefined, { timeout: 10_000 })
    await waitForElements(page, 'photo')
    await page.evaluate(() => {
      const get = window.__editor!.getState
      for (const e of get().elements) if (e.type !== 'photo') get().removeElement(e.id)
      get().setGrid('4-grid')
      get().setBoardSize(1080, 1920)
    })
    await expect.poll(() => editor(page)).toMatchObject({ gridId: '4-grid', texts: [] })

    // The reload restores the open Layout panel; clicking its tab now would close it.
    await expect(gallery).toBeVisible()
    await gallery.getByRole('button', { name: 'Mine', exact: true }).click()
    await page.getByRole('button', { name: 'Happy Birthday!', exact: true }).click()
    await expect
      .poll(() => editor(page))
      .toMatchObject({
        size: [1080, 1080],
        gridId: 'polaroid-2',
        mode: 'grid',
        types: ['photo', 'text', 'text', 'sticker', 'sticker'],
        texts: ['Happy Birthday!', 'Make a wish'],
      })

    await page.getByRole('button', { name: 'Delete template: Happy Birthday!' }).click()
    await expect(page.getByText('Templates you save show up here.')).toBeVisible()
  })
})
