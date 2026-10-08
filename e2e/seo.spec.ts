import { test, expect } from '@playwright/test'
import { openApp } from './helpers'

test.describe('search', () => {
  test('a ?lang= link opens the app in that language with its own title and canonical', async ({
    page,
  }) => {
    await openApp(page)
    await page.goto('./?lang=fr')
    await page.waitForFunction(() => !!window.__editor)
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(page).toHaveTitle('Pic Collage Maker — Éditeur de collages photo')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://sashimee.github.io/Pic-Collage-Maker/?lang=fr',
    )
  })

  test('every language has an alternate, and the structured data parses', async ({ page }) => {
    await openApp(page)
    const hreflangs = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((links) => links.map((l) => l.getAttribute('hreflang')))
    expect(hreflangs.sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'pt', 'x-default'])
    const ld = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '',
    )
    expect(ld['@type']).toBe('WebApplication')
    expect(ld.offers.price).toBe('0')
  })
})
