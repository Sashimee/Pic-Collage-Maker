import { test, expect } from '@playwright/test'
import { openApp, pngFile, waitForElements } from './helpers'

/**
 * Photo elements carry their pixels as blob: object URLs — handles into the
 * current document that die on reload. Saved projects and version snapshots
 * stored them verbatim, so reopening either after a restart gave a collage with
 * its photos missing. A reload is the only thing that reproduces this; within a
 * session the stale URLs still resolve and everything looks fine.
 */

/** Photo sources currently in the editor. */
const photoSrcs = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    window
      .__editor!.getState()
      .elements.filter((e) => e.type === 'photo')
      .map((e) => (e as unknown as { src: string }).src),
  )

/** Photos in the autosaved document as it actually sits in IndexedDB. */
const persistedPhotoCount = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        // Mirrors src/lib/persistence.ts — DB 'piccollage', store 'doc'.
        const req = indexedDB.open('piccollage')
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('doc')) {
            db.close()
            return resolve(0)
          }
          const t = db.transaction('doc', 'readonly')
          const get = t.objectStore('doc').getAll()
          get.onsuccess = () => {
            const docs = get.result as { elements?: { type: string }[] }[]
            resolve(
              docs.reduce(
                (n, d) => n + (d?.elements?.filter((e) => e.type === 'photo').length ?? 0),
                0,
              ),
            )
          }
          get.onerror = () => resolve(0)
          t.oncomplete = () => db.close()
        }
        req.onerror = () => resolve(0)
      }),
  )

/** The background's photoId as it actually sits in the autosaved document. */
const persistedBackgroundId = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const req = indexedDB.open('piccollage')
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('doc')) {
            db.close()
            return resolve(null)
          }
          const t = db.transaction('doc', 'readonly')
          const get = t.objectStore('doc').getAll()
          get.onsuccess = () => {
            const docs = get.result as { background?: { photoId?: string } }[]
            resolve(docs.map((d) => d?.background?.photoId).find(Boolean) ?? null)
          }
          get.onerror = () => resolve(null)
          t.oncomplete = () => db.close()
        }
        req.onerror = () => resolve(null)
      }),
  )

/** Do the sources actually resolve, or are they dead handles? */
const srcsResolve = async (page: import('@playwright/test').Page) => {
  const srcs = await photoSrcs(page)
  if (!srcs.length) return false
  return page.evaluate(
    (list) =>
      Promise.all(
        list.map((s) =>
          fetch(s)
            .then((r) => r.ok)
            .catch(() => false),
        ),
      ).then((rs) => rs.every(Boolean)),
    srcs,
  )
}

test.describe('photos survive a reload', () => {
  test('the autosaved document keeps its photos', async ({ page }) => {
    await openApp(page)
    await page.locator('#empty-gallery-input').setInputFiles(pngFile())
    await waitForElements(page, 'photo')
    // Wait for the write itself, not a guess at how long the 500ms debounce
    // plus an IndexedDB round-trip takes. A fixed sleep is fine on an idle
    // machine and wrong exactly when the suite is busy.
    await expect.poll(() => persistedPhotoCount(page), { timeout: 15_000 }).toBeGreaterThan(0)

    await page.reload()
    await page.waitForFunction(() => !!window.__editor)
    await waitForElements(page, 'photo')

    expect(await srcsResolve(page)).toBe(true)
  })

  test('a saved project keeps its photos', async ({ page }) => {
    await openApp(page)
    await page.locator('#empty-gallery-input').setInputFiles(pngFile())
    await waitForElements(page, 'photo')

    const projectId = await page.evaluate(() =>
      window.__projects!.getState().createProject('Reload Test'),
    )
    expect(projectId).toBeTruthy()

    await page.reload()
    await page.waitForFunction(() => !!window.__editor)

    await page.evaluate(async (id) => {
      // Clear the canvas first, so a pass cannot come from the autosaved doc.
      window.__editor!.getState().clearAll()
      await window.__projects!.getState().openProject(id)
    }, projectId)

    await waitForElements(page, 'photo')
    expect(await srcsResolve(page)).toBe(true)
  })

  test('a project saved by the old single-page version still opens', async ({ page }) => {
    // Projects stored before the page model hold a bare document in `data`.
    // Rewrite a record into that shape to stand in for one already on a user's
    // device — the migration exists precisely so these keep working.
    await openApp(page)
    await page.locator('#empty-gallery-input').setInputFiles(pngFile())
    await waitForElements(page, 'photo')

    const projectId = await page.evaluate(() =>
      window.__projects!.getState().createProject('Legacy'),
    )

    const downgraded = await page.evaluate(
      (id) =>
        new Promise<boolean>((resolve) => {
          const req = indexedDB.open('pic-collage-db')
          req.onsuccess = () => {
            const db = req.result
            const t = db.transaction('projects', 'readwrite')
            const store = t.objectStore('projects')
            const get = store.get(id)
            get.onsuccess = () => {
              const rec = get.result
              if (!rec?.data?.pages) return resolve(false)
              rec.data = rec.data.pages[0] // strip the wrapper
              store.put(rec)
            }
            t.oncomplete = () => {
              db.close()
              resolve(true)
            }
          }
          req.onerror = () => resolve(false)
        }),
      projectId,
    )
    expect(downgraded).toBe(true)

    await page.reload()
    await page.waitForFunction(() => !!window.__editor)
    await page.evaluate(async (id) => {
      window.__editor!.getState().clearAll()
      await window.__projects!.getState().openProject(id)
    }, projectId)

    await waitForElements(page, 'photo')
    expect(await srcsResolve(page)).toBe(true)
  })

  test('a second page survives a reload, with its photos', async ({ page }) => {
    // Pages live in the project record; the editor only ever holds the one you
    // are looking at. A reload is the only thing that proves the other pages
    // were really written rather than just held in memory.
    await openApp(page)
    await page.locator('#empty-gallery-input').setInputFiles(pngFile())
    await waitForElements(page, 'photo')

    const projectId = await page.evaluate(async () => {
      const p = window.__projects!.getState()
      const id = await p.createProject('Two Pages')
      await window.__projects!.getState().addPage()
      return id
    })
    // The new page is blank...
    expect(await page.evaluate(() => window.__editor!.getState().elements.length)).toBe(0)

    // ...so give it a photo of its own.
    await page.locator('#panel-gallery-input').setInputFiles(pngFile('second.png')).catch(async () => {
      await page.getByRole('button', { name: 'Photos', exact: true }).click()
      await page.locator('#panel-gallery-input').setInputFiles(pngFile('second.png'))
    })
    await waitForElements(page, 'photo')
    await page.evaluate(() => window.__projects!.getState().saveActiveProject())

    await page.reload()
    await page.waitForFunction(() => !!window.__editor)
    await page.evaluate(async (id) => {
      window.__editor!.getState().clearAll()
      await window.__projects!.getState().openProject(id)
    }, projectId)

    const pageCount = await page.evaluate(() => window.__projects!.getState().pages.length)
    expect(pageCount).toBe(2)

    // Both pages still have a resolvable photo.
    for (const index of [0, 1]) {
      await page.evaluate((i) => window.__projects!.getState().setActivePage(i), index)
      await waitForElements(page, 'photo')
      expect(await srcsResolve(page)).toBe(true)
    }
  })

  test('a restored version keeps its photos', async ({ page }) => {
    await openApp(page)
    await page.locator('#empty-gallery-input').setInputFiles(pngFile())
    await waitForElements(page, 'photo')

    const projectId = await page.evaluate(() =>
      window.__projects!.getState().createProject('Version Test'),
    )

    await page.reload()
    await page.waitForFunction(() => !!window.__editor)

    const restored = await page.evaluate(async (id) => {
      const vs = window.__versions!.getState()
      const rows = await vs.getSnapshots(id)
      if (!rows.length) return { rows: 0, srcs: [] as string[] }
      const data = await vs.restoreSnapshot(rows[0].id)
      return {
        rows: rows.length,
        srcs: (data?.elements ?? [])
          .filter((e) => e.type === 'photo')
          .map((e) => (e as unknown as { src: string }).src),
      }
    }, projectId)

    // Creating the project wrote a version, and it has the photo in it.
    expect(restored.rows).toBeGreaterThan(0)
    expect(restored.srcs).toHaveLength(1)
    expect(restored.srcs[0]).toMatch(/^blob:/)

    const ok = await page.evaluate(
      (s) => fetch(s).then((r) => r.ok).catch(() => false),
      restored.srcs[0],
    )
    expect(ok).toBe(true)
  })

  test('a photo background survives a reload', async ({ page }) => {
    // The background is not a CanvasElement, so the strip/rehydrate pair never
    // touched it: its blob: URL was persisted verbatim and dead on reload —
    // and the picker never stored the bytes at all, so there was nothing left
    // to rebuild it from either.
    await openApp(page)
    await page.locator('#empty-gallery-input').setInputFiles(pngFile())
    await waitForElements(page, 'photo')

    await page.getByRole('button', { name: 'Background', exact: true }).click()
    await page.getByRole('button', { name: 'Photo', exact: true }).click()
    await page.locator('#bg-photo-input').setInputFiles(pngFile('bg.png'))

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window.__editor!.getState() as unknown as { background: { photoSrc?: string } })
              .background.photoSrc ?? null,
        ),
      )
      .toMatch(/^blob:/)

    // Wait for the *background* to reach IndexedDB, not for the photo count —
    // that was already non-zero before the background was picked, so polling it
    // would let the reload beat the autosave debounce.
    await expect.poll(() => persistedBackgroundId(page), { timeout: 15_000 }).toBeTruthy()
    await page.reload()
    await page.waitForFunction(() => !!window.__editor)
    await waitForElements(page, 'photo')

    const src = await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window.__editor!.getState() as unknown as { background: { photoSrc?: string } })
                .background.photoSrc ?? null,
          ),
        { timeout: 15_000 },
      )
      .toMatch(/^blob:/)
    void src

    // And it resolves — a rebuilt URL that 404s is no better than a dead one.
    const ok = await page.evaluate(async () => {
      const s = (window.__editor!.getState() as unknown as {
        background: { photoSrc?: string }
      }).background.photoSrc
      if (!s) return false
      return fetch(s).then((r) => r.ok).catch(() => false)
    })
    expect(ok).toBe(true)
  })
})

test('the grid margin survives a reload', async ({ page }) => {
  await openApp(page)
  await page.locator('#empty-gallery-input').setInputFiles(pngFile())
  await waitForElements(page, 'photo')
  await page.evaluate(() => {
    const s = window.__editor!.getState()
    s.setGrid('mag-cover')
    s.setGridMargin(48)
  })

  const persistedMargin = () =>
    page.evaluate(
      () =>
        new Promise<number | null>((resolve) => {
          const req = indexedDB.open('piccollage')
          req.onsuccess = () => {
            const db = req.result
            if (!db.objectStoreNames.contains('doc')) {
              db.close()
              return resolve(null)
            }
            const t = db.transaction('doc', 'readonly')
            const get = t.objectStore('doc').getAll()
            get.onsuccess = () => {
              const docs = get.result as { gridMargin?: number }[]
              resolve(docs.map((d) => d?.gridMargin).find((m) => m !== undefined) ?? null)
            }
            get.onerror = () => resolve(null)
            t.oncomplete = () => db.close()
          }
          req.onerror = () => resolve(null)
        }),
    )

  await expect.poll(persistedMargin, { timeout: 15_000 }).toBe(48)
  await page.reload()
  await page.waitForFunction(() => !!window.__editor)
  await waitForElements(page, 'photo')
  expect(
    await page.evaluate(() => {
      const s = window.__editor!.getState()
      return { gridId: s.gridId, gridMargin: s.gridMargin }
    }),
  ).toEqual({ gridId: 'mag-cover', gridMargin: 48 })
})
