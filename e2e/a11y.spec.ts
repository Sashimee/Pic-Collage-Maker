import { createRequire } from 'node:module'
import { test, expect, type Page } from '@playwright/test'
import { openApp, pngFile, waitForElements } from './helpers'

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')

interface Violation {
  id: string
  impact: string | null
  nodes: { html: string; failureSummary?: string }[]
}

declare global {
  interface Window {
    axe?: { run: (context: Document, options: object) => Promise<{ violations: Violation[] }> }
  }
}

/** Serious and critical axe violations on the page as it stands, one line per node. */
async function audit(page: Page) {
  // A fade caught half way reads as low contrast. Cancelled animations reject, and
  // spinners never end, so only the finite ones are waited for.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  )
  await page.addScriptTag({ path: AXE })
  const violations = await page.evaluate(
    async () => (await window.axe!.run(document, { resultTypes: ['violations'] })).violations,
  )
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) =>
      v.nodes.map(
        (n) =>
          `${v.id}: ${n.html.slice(0, 160)} — ${(n.failureSummary ?? '').replace(/\s+/g, ' ')}`,
      ),
    )
}

const PANELS = [
  'Photos',
  'Layout',
  'Text',
  'Draw',
  'Stickers',
  'Background',
  'Filters',
  'Layers',
  'History',
  'Settings',
]

const SHEETS: [string, (page: Page, device: string) => Promise<void>][] = [
  [
    'export menu',
    async (page) => {
      await page.getByRole('button', { name: 'Export' }).first().click()
      await expect(page.getByRole('menu').or(page.getByRole('dialog')).first()).toBeVisible()
    },
  ],
  [
    'projects sheet',
    async (page, device) => {
      if (device === 'phone')
        await page
          .getByRole('button', { name: /more|menu/i })
          .first()
          .click()
      await page.getByRole('button', { name: 'Projects' }).first().click()
      await expect(page.getByRole('dialog', { name: 'Projects' })).toBeVisible()
    },
  ],
]

// Light theme only: the dark theme's accent fails contrast both as text and under
// white text, which needs a palette decision first (#159).
for (const [device, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test.describe(`axe on ${device}`, () => {
    test.use({ viewport })

    test('the start screen', async ({ page }) => {
      await openApp(page)
      await expect(page.getByText('Choose a Layout')).toBeVisible()
      expect(await audit(page)).toEqual([])
    })

    test.describe('with a photo selected', () => {
      test.beforeEach(async ({ page }) => {
        await openApp(page)
        await page.locator('#empty-gallery-input').setInputFiles(pngFile())
        await waitForElements(page, 'photo')
        await expect(page.getByText('Choose a Layout')).toBeHidden()
        await page.evaluate(() => {
          const state = window.__editor!.getState() as unknown as {
            elements: { id: string }[]
            select: (id: string) => void
          }
          state.select(state.elements[0].id)
        })
      })

      test('the editor', async ({ page }) => {
        expect(await audit(page)).toEqual([])
      })

      for (const panel of PANELS) {
        test(`the ${panel} panel`, async ({ page }) => {
          const tab = page.getByRole('button', { name: panel, exact: true }).first()
          // A press on the open tab closes it.
          if ((await tab.getAttribute('aria-pressed')) !== 'true') await tab.click()
          await expect(tab).toHaveAttribute('aria-pressed', 'true')
          expect(await audit(page)).toEqual([])
        })
      }

      for (const [name, open] of SHEETS) {
        test(`the ${name}`, async ({ page }) => {
          await open(page, device)
          expect(await audit(page)).toEqual([])
        })
      }
    })
  })
}
