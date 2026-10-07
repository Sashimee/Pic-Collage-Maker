import { test, expect } from '@playwright/test'
import { openApp, settleCanvas, skipGallery } from './helpers'

test('adds a speech bubble from the lazily loaded shape library', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  await page.getByRole('button', { name: 'Stickers', exact: true }).click()

  await page.getByRole('button', { name: 'Speech bubbles 1' }).click()
  await settleCanvas(page)

  const shape = await page.evaluate(() => {
    const { elements, selectedId } = window.__editor!.getState()
    const el = elements.at(-1) as {
      id: string
      type: string
      shapeType?: string
      path?: string
      name?: string
    }
    return { ...el, selected: selectedId === el.id }
  })
  expect(shape).toMatchObject({
    type: 'shape',
    shapeType: 'custom',
    name: 'Speech bubbles 1',
    selected: true,
  })
  expect(shape.path).toMatch(/^M/)

  const drawn = await page.evaluate((id) => {
    const konva = (window as unknown as { Konva: { stages: import('konva/lib/Stage').Stage[] } })
      .Konva
    return konva.stages[0].findOne('#' + id)?.getClientRect().width ?? 0
  }, shape.id)
  expect(drawn).toBeGreaterThan(10)
})
