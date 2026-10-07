import { test, expect } from '@playwright/test'
import { openApp, skipGallery, waitForElements } from './helpers'

const elementCount = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__editor!.getState().elements.length)

test.describe('keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const live = new Set<unknown>()
      const add = window.addEventListener.bind(window)
      const remove = window.removeEventListener.bind(window)
      window.addEventListener = ((type: string, fn: unknown, opts?: unknown) => {
        if (type === 'keydown') live.add(fn)
        return add(type, fn as EventListener, opts as AddEventListenerOptions)
      }) as typeof window.addEventListener
      window.removeEventListener = ((type: string, fn: unknown, opts?: unknown) => {
        if (type === 'keydown') live.delete(fn)
        return remove(type, fn as EventListener, opts as EventListenerOptions)
      }) as typeof window.removeEventListener
      ;(window as unknown as { __keydownListeners: () => number }).__keydownListeners = () => live.size
    })
    await openApp(page)
    await skipGallery(page)
    await page.getByRole('button', { name: 'Text', exact: true }).click()
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /Add text/ }).click()
      await page.waitForTimeout(120)
    }
    await waitForElements(page, 'text', 3)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  })

  // Two hooks used to listen for the same keys, so a shortcut could run twice.
  // Whether the second one fired depended on render timing, which is why this
  // counts listeners rather than relying on a keypress to show the double.
  test('the editor listens for shortcuts exactly once', async ({ page }) => {
    const count = await page.evaluate(() =>
      (window as unknown as { __keydownListeners: () => number }).__keydownListeners(),
    )
    expect(count).toBe(1)
  })

  test('one undo press steps back exactly one edit', async ({ page }) => {
    await page.keyboard.press('Control+z')
    await expect.poll(() => elementCount(page)).toBe(2)
    await page.waitForTimeout(200)
    expect(await elementCount(page)).toBe(2)
  })

  test('one duplicate press adds exactly one element', async ({ page }) => {
    await page.keyboard.press('Control+d')
    await expect.poll(() => elementCount(page)).toBe(4)
    await page.waitForTimeout(200)
    expect(await elementCount(page)).toBe(4)
  })

  test.describe('command palette', () => {
    const select = (page: import('@playwright/test').Page) =>
      page.evaluate(() => {
        const s = window.__editor!.getState() as unknown as {
          elements: { id: string }[]
          select: (id: string | null) => void
        }
        s.select(s.elements[0].id)
      })
    const selectedId = (page: import('@playwright/test').Page) =>
      page.evaluate(
        () => (window.__editor!.getState() as unknown as { selectedId: string | null }).selectedId,
      )

    test('ctrl+k finds and runs a command, then gets out of the way', async ({ page }) => {
      await select(page)
      await page.keyboard.press('Control+k')
      const dialog = page.getByRole('dialog', { name: 'Command palette' })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('combobox')).toBeFocused()
      await page.keyboard.type('dupl')
      await expect(dialog.getByRole('option')).toHaveText(['DuplicateCtrl+D'])
      await page.keyboard.press('Enter')
      await expect(dialog).toBeHidden()
      await expect.poll(() => elementCount(page)).toBe(4)
    })

    test('escape closes the palette and leaves the selection alone', async ({ page }) => {
      await select(page)
      await page.keyboard.press('Control+k')
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toBeHidden()
      expect(await selectedId(page)).not.toBeNull()
    })

    test('a panel opens from the palette', async ({ page }) => {
      await page.keyboard.press('Control+k')
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.type('panel layers')
      await page.keyboard.press('Enter')
      await expect(page.getByRole('heading', { name: 'Layers' }).first()).toBeVisible()
    })

    test('? lists the shortcuts, including ones not usable right now', async ({ page }) => {
      await page.evaluate(() =>
        (window.__editor!.getState() as unknown as { select: (id: null) => void }).select(null),
      )
      await page.keyboard.press('Shift+?')
      const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
      await expect(sheet).toBeVisible()
      await expect(sheet.getByRole('button', { name: 'Close' })).toBeFocused()
      await expect(sheet.getByRole('term').filter({ hasText: /^Delete$/ })).toBeVisible()
      await expect(sheet.getByRole('definition').filter({ hasText: 'Ctrl+K' })).toBeVisible()
      await page.keyboard.press('Control+a')
      await page.keyboard.press('Escape')
      await expect(sheet).toBeHidden()
      const selected = await page.evaluate(
        () => (window.__editor!.getState() as unknown as { multiSelected: string[] }).multiSelected,
      )
      expect(selected).toEqual([])
    })
  })
})
