import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openApp, pngFile, skipGallery, waitForElements } from './helpers'

/**
 * The photo book. What makes this worth an e2e rather than a unit test is that
 * it exercises the off-screen renderer against a real Konva stage: pages that
 * are *not* loaded in the editor have to come out as real bitmaps, decoded and
 * drawn, without disturbing the board the user is looking at.
 */

/** Capture the PDF the download path produces. */
async function installPdfProbe(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __lastPdf?: Blob }
    const orig = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      // The image probe in export-watermark.spec filters on image/*; a PDF
      // would slip straight past it.
      if (obj instanceof Blob && obj.type === 'application/pdf') w.__lastPdf = obj
      return orig(obj)
    }
  })
}

/** The produced PDF, base64'd out of the page so Node can parse it. */
async function pdfBase64(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const blob = (window as unknown as { __lastPdf?: Blob }).__lastPdf
    if (!blob) return null
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
    return btoa(bin)
  })
}

/**
 * Page sizes in PDF points. Parsed in Node with pdf-lib rather than in the
 * page: a bare module specifier does not resolve at runtime in the browser,
 * and pdf-lib compresses its output into object streams, so scraping
 * /MediaBox out of the raw bytes would not work either.
 */
async function pdfPageSizes(page: Page) {
  const b64 = await pdfBase64(page)
  if (!b64) return null
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.load(Buffer.from(b64, 'base64'))
  return doc.getPages().map((p) => {
    const { width, height } = p.getSize()
    return { width: Math.round(width), height: Math.round(height) }
  })
}

const tiles = (page: Page) => page.locator('[data-page-tile]')

async function addPhoto(page: Page, name: string) {
  const empty = page.locator('#empty-gallery-input')
  if (await empty.count()) {
    await empty.setInputFiles(pngFile(name))
  } else {
    await page.getByRole('button', { name: 'Photos', exact: true }).click()
    await page.locator('#panel-gallery-input').setInputFiles(pngFile(name))
    await page.getByRole('button', { name: 'Photos', exact: true }).click()
  }
  await waitForElements(page, 'photo')
}

async function openBookSheet(page: Page) {
  await page.getByRole('button', { name: /Export/i }).first().click()
  await page.getByRole('menuitem', { name: 'Photo book (PDF)' }).click()
  await expect(page.getByRole('heading', { name: 'Photo book' })).toBeVisible()
}

test.describe('photo book', () => {
  test('binds every page at the chosen physical size', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'one.png')
    await page.getByRole('button', { name: 'Add page' }).click()
    await expect(tiles(page)).toHaveCount(2)
    await addPhoto(page, 'two.png')

    await installPdfProbe(page)
    await openBookSheet(page)
    await page.getByRole('button', { name: 'A4 portrait' }).click()
    await page.locator('[data-book-create]').click()

    await expect.poll(() => pdfPageSizes(page), { timeout: 60_000 }).not.toBeNull()
    const sizes = await pdfPageSizes(page)
    expect(sizes).toHaveLength(2)
    // A4 is 210x297mm = 595x842pt. The old code would have produced a page
    // the size of the bitmap in points — thousands, not hundreds.
    for (const s of sizes!) {
      expect(s.width).toBe(595)
      expect(s.height).toBe(842)
    }
  })

  test('renders pages the editor is not showing, and leaves it alone', async ({ page }) => {
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'one.png')
    await page.getByRole('button', { name: 'Add page' }).click()
    await expect(tiles(page)).toHaveCount(2)
    await addPhoto(page, 'two.png')

    const before = await page.evaluate(() => ({
      activePage: window.__projects!.getState().activePage,
      elements: window.__editor!.getState().elements.length,
      rect: window.__boardRect!(),
    }))

    await installPdfProbe(page)
    await openBookSheet(page)
    await page.locator('[data-book-create]').click()
    await expect.poll(() => pdfPageSizes(page), { timeout: 60_000 }).not.toBeNull()

    const after = await page.evaluate(() => ({
      activePage: window.__projects!.getState().activePage,
      elements: window.__editor!.getState().elements.length,
      rect: window.__boardRect!(),
      exporting: (window.__editor!.getState() as unknown as { exporting: boolean }).exporting,
    }))

    // The off-screen stage exists precisely so none of this moves.
    expect(after.activePage).toBe(before.activePage)
    expect(after.elements).toBe(before.elements)
    expect(after.rect).toEqual(before.rect)
    // A stranded `exporting` flag pins every photo to its full-resolution
    // source — the memory-heavy state.
    expect(after.exporting).toBe(false)
  })

  test('leaves the live document\'s own photo URLs alone', async ({ page }) => {
    // `rehydratePhotos` hands an already-live photo straight back rather than
    // re-minting it, so rendering the *live* document returns the editor's own
    // object URLs. Revoking those blanks the board on screen — reachable
    // whenever there is no page list to read (private mode) and the caller
    // falls back to the live document.
    await openApp(page)
    await skipGallery(page)
    await addPhoto(page, 'one.png')

    const stillResolves = await page.evaluate(async () => {
      const { renderPages } = await import('/Pic-Collage-Maker/src/lib/renderPages.tsx')
      const s = window.__editor!.getState() as unknown as Record<string, unknown>
      const doc = {
        boardWidth: s.boardWidth,
        boardHeight: s.boardHeight,
        background: s.background,
        mode: s.mode,
        gridId: s.gridId,
        gridGap: s.gridGap,
        gridRadius: s.gridRadius,
        frame: s.frame,
        elements: s.elements,
      }
      await (renderPages as (p: unknown[], o: unknown) => Promise<string[]>)([doc], {
        width: 320,
        height: 400,
      })

      // The board is still on screen; its sources must still be fetchable.
      const srcs = window
        .__editor!.getState()
        .elements.filter((e) => e.type === 'photo')
        .map((e) => (e as unknown as { src: string }).src)
      const results = await Promise.all(
        srcs.map((src) =>
          fetch(src)
            .then((r) => r.ok)
            .catch(() => false),
        ),
      )
      return { count: srcs.length, ok: results.every(Boolean) }
    })

    expect(stillResolves.count).toBeGreaterThan(0)
    expect(stillResolves.ok).toBe(true)
  })

  test('draws each page\'s own content, not the one on screen', async ({ page }) => {
    // The sharp end of the whole feature: a page the editor is not showing has
    // to render as itself. Backgrounds make that checkable in pixels — a byte
    // count does not, since a blank A4 sheet at 300 DPI is already ~50 KB.
    await openApp(page)
    await skipGallery(page)

    const colours = await page.evaluate(async () => {
      const { renderPages } = await import('/Pic-Collage-Maker/src/lib/renderPages.tsx')
      const s = window.__editor!.getState() as unknown as Record<string, unknown>
      const base = {
        boardWidth: s.boardWidth,
        boardHeight: s.boardHeight,
        mode: s.mode,
        gridId: s.gridId,
        gridGap: s.gridGap,
        gridRadius: s.gridRadius,
        frame: s.frame,
        elements: [],
      }
      const bg = (color: string) => ({
        ...(s.background as Record<string, unknown>),
        type: 'solid',
        color,
      })
      const urls = await (renderPages as (p: unknown[], o: unknown) => Promise<string[]>)(
        [
          { ...base, background: bg('#ff0000') },
          { ...base, background: bg('#0000ff') },
        ],
        { width: 620, height: 877 },
      )

      // Sample the middle of each rendered page.
      const sample = async (url: string) => {
        const img = new Image()
        await new Promise((r) => {
          img.onload = r
          img.src = url
        })
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        c.getContext('2d')!.drawImage(img, 0, 0)
        const d = c.getContext('2d')!.getImageData(img.width >> 1, img.height >> 1, 1, 1).data
        return [d[0], d[1], d[2]]
      }
      return { count: urls.length, first: await sample(urls[0]), second: await sample(urls[1]) }
    })

    expect(colours.count).toBe(2)
    // Red page then blue page — each drawn from its own document. JPEG is
    // lossy, so allow a little slack rather than demanding exact values.
    expect(colours.first[0]).toBeGreaterThan(200)
    expect(colours.first[2]).toBeLessThan(60)
    expect(colours.second[2]).toBeGreaterThan(200)
    expect(colours.second[0]).toBeLessThan(60)
  })
})
