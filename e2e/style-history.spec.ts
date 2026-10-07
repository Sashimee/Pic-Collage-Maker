import { test, expect, type Page } from '@playwright/test'
import { openApp, skipGallery, waitForElements } from './helpers'

const texts = (page: Page) =>
  page.evaluate(() =>
    window.__editor!.getState().elements.map((e) => {
      const t = e as { id: string; fill?: string; opacity?: number }
      return { id: t.id, fill: t.fill, opacity: t.opacity }
    }),
  )

test.describe('copy / paste style and named history', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await page.getByRole('button', { name: 'Text', exact: true }).click()
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: /Add text/ }).click()
      await page.waitForTimeout(120)
    }
    await waitForElements(page, 'text', 2)
  })

  test('copies a style from the selection bar and pastes it onto another element', async ({
    page,
  }) => {
    const [a, b] = await texts(page)
    await page.evaluate(
      ({ id }) => {
        const s = window.__editor!.getState()
        s.updateElement(id, { fill: '#ff0000', opacity: 0.4 })
        s.select(id)
      },
      { id: a.id },
    )
    await expect(page.getByRole('button', { name: 'Paste style' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Copy style' }).click()
    await expect(page.getByText('Style copied')).toBeVisible()

    await page.evaluate(({ id }) => window.__editor!.getState().select(id), { id: b.id })
    await page.getByRole('button', { name: 'Paste style' }).click()
    await expect
      .poll(async () => (await texts(page))[1])
      .toMatchObject({
        fill: '#ff0000',
        opacity: 0.4,
      })
  })

  test('lists named steps and jumps back and forward through them', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.__editor!.getState()
      s.setBackground({ color: '#123456' })
    })
    await page.getByRole('button', { name: 'History', exact: true }).click()
    const steps = page
      .getByRole('list')
      .filter({ has: page.getByRole('button', { name: 'Start' }) })
    await expect(steps.getByRole('button')).toHaveText([
      'Start',
      'Layout',
      'Add text',
      'Add text',
      'Background',
    ])
    await expect(steps.locator('[aria-current="step"]')).toHaveText('Background')

    await steps.getByRole('button', { name: 'Add text' }).first().click()
    await expect.poll(async () => (await texts(page)).length).toBe(1)
    await expect(steps.locator('[aria-current="step"]')).toHaveText('Add text')
    await expect(steps.getByRole('button')).toHaveCount(5)

    await steps.getByRole('button', { name: 'Background' }).click()
    await expect
      .poll(() => page.evaluate(() => window.__editor!.getState().background.color))
      .toBe('#123456')
    await expect.poll(async () => (await texts(page)).length).toBe(2)
  })
})
