import { test, expect } from '@playwright/test'
import { openApp, skipGallery, waitForElements } from './helpers'

test.describe('smoke', () => {
  test('app loads and shows the layout gallery', async ({ page }) => {
    await openApp(page)
    await expect(page.getByText('Pic Collage', { exact: true })).toBeVisible()
    await expect(page.getByText('Choose a Layout')).toBeVisible()
    await expect(page.getByText('Pick a structure, then add your photos')).toBeVisible()
  })

  test('can switch language', async ({ page }) => {
    await openApp(page)
    // The flags sit behind a dropdown, so it has to be opened first. The
    // trigger's name is exactly the active language (its aria-label); the menu
    // items carry a flag emoji too, so `exact` tells them apart.
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await page.getByRole('button', { name: /Deutsch/ }).click()
    await expect(page.getByText('Layout wählen')).toBeVisible()

    await page.getByRole('button', { name: 'Deutsch', exact: true }).click()
    await page.getByRole('button', { name: /English/ }).click()
    await expect(page.getByText('Choose a Layout')).toBeVisible()
  })

  test('can add text and see it on canvas', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await page.getByRole('button', { name: 'Text', exact: true }).click()
    await page.getByRole('button', { name: /Add text/ }).click()
    await waitForElements(page, 'text')
  })

  test('a font-pack font is fetched from this origin only once a text uses it', async ({
    page,
  }) => {
    const requests: string[] = []
    const fonts: string[] = []
    page.on('request', (r) => {
      requests.push(r.url())
      if (r.resourceType() === 'font') fonts.push(r.url())
    })
    await openApp(page)
    await skipGallery(page)
    await page.getByRole('button', { name: 'Text', exact: true }).click()
    await page.getByRole('button', { name: /Add text/ }).click()
    await waitForElements(page, 'text')
    expect(fonts.filter((u) => /\/pack-[^/]*\.woff2/.test(u))).toEqual([])

    await page.locator('select:has(option[value="Lobster"])').selectOption('Lobster')
    await expect
      .poll(() => fonts.filter((u) => /\/pack-lobster[^/]*\.woff2/.test(u)).length)
      .toBe(1)
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.fonts].some(
            (f) => f.family.replace(/"/g, '') === 'Lobster' && f.status === 'loaded',
          ),
        ),
      )
      .toBe(true)
    expect(fonts.filter((u) => /\/pack-[^/]*\.woff2/.test(u))).toHaveLength(1)

    const origin = new URL(page.url()).origin
    const offsite = requests.filter((u) => /^https?:/.test(u) && new URL(u).origin !== origin)
    expect(offsite).toEqual([])
  })

  test('export menu opens', async ({ page }) => {
    await openApp(page)
    // Regression guard: the header needs its own stacking context, or this
    // dropdown paints behind the canvas and is invisible on desktop.
    await page.getByRole('button', { name: 'Export' }).click()
    await expect(page.getByRole('menuitem', { name: 'Download PNG' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Download JPG' })).toBeVisible()
  })

  test('theme toggle names the mode it switches to', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Night mode' }).click()
    await expect(page.getByRole('button', { name: 'Day mode' })).toBeVisible()
  })

  test('no Facebook route is offered', async ({ page }) => {
    // It could only ever post a link, never the collage, and on a phone it just
    // opened the Facebook app. Removed rather than left to mislead.
    await openApp(page)
    await page.getByRole('button', { name: 'Export' }).click()
    await expect(page.getByRole('menuitem', { name: /Facebook/i })).toHaveCount(0)
  })

  test('no menu item is labelled with a raw translation key', async ({ page }) => {
    // `t()` renders the key itself when it is missing from the language map,
    // which is how a menu item reading "export.facebook" reached production.
    // (src/i18n/__tests__ covers all six languages; this checks it renders.)
    await openApp(page)
    await page.getByRole('button', { name: 'Export' }).click()
    const labels = await page.getByRole('menuitem').allInnerTexts()
    expect(labels.length).toBeGreaterThan(4)
    expect(labels.filter((l) => /^[a-z]+\.[a-zA-Z]+$/.test(l.trim()))).toEqual([])
  })
})

test.describe('mobile chrome', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the menu says it scrolls', async ({ page }) => {
    // The action sheet holds ~20 rows; more than half sits below the fold with
    // nothing to suggest it. The cue only shows when there is more to see.
    await openApp(page)
    await page.getByRole('button', { name: 'Menu' }).click()

    const fade = page.locator('.bg-gradient-to-t.from-surface')
    await expect(fade).toBeVisible()

    // ...and goes away once you reach the end.
    const body = page.locator('[role="dialog"] .overflow-y-auto')
    await body.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await expect(fade).toBeHidden()
  })
})
