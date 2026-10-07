import { test, expect, type Page } from '@playwright/test'
import { openApp, skipGallery, waitForElements } from './helpers'

/** Elements in the autosaved document as it sits in IndexedDB ('piccollage' / 'doc'). */
const persistedTexts = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const req = indexedDB.open('piccollage')
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('doc')) {
            db.close()
            return resolve([])
          }
          const t = db.transaction('doc', 'readonly')
          const get = t.objectStore('doc').getAll()
          get.onsuccess = () => {
            const docs = get.result as { elements?: { type: string; text?: string }[] }[]
            resolve(
              docs.flatMap((d) => d?.elements ?? []).flatMap((e) => (e.text ? [e.text] : [])),
            )
          }
          get.onerror = () => resolve([])
          t.oncomplete = () => db.close()
        }
        req.onerror = () => resolve([])
      }),
  )

interface ProjectsSeam {
  getState: () => {
    createProject: (name: string) => Promise<string>
    openProject: (id: string) => Promise<void>
  }
}

const crashScreen = (page: Page) => page.getByRole('heading', { name: 'Something went wrong' })

/** Two texts on the board; returns their ids. */
const addTwoTexts = (page: Page) =>
  page.evaluate(() => {
    const ed = window.__editor!.getState()
    ed.addText()
    ed.addText()
    const texts = window.__editor!.getState().elements
    ed.updateElement(texts[0].id, { text: 'Before crash A' })
    ed.updateElement(texts[1].id, { text: 'Before crash B' })
    return texts.map((e) => e.id)
  })

// A corrupt span list throws while TextNode renders — the kind of bad state a
// bug elsewhere could leave in the store.
const corrupt = (page: Page, id: string) =>
  page.evaluate((id) => {
    window.__editor!.getState().updateElement(id, { spans: [null] } as never)
  }, id)

/** Click Recover and wait for the reload it triggers, not just the old page's seam. */
async function recover(page: Page) {
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Recover last autosave' }).click(),
  ])
  await page.waitForFunction(() => !!window.__editor, undefined, { timeout: 10_000 })
}

const liveTexts = (page: Page) =>
  page.evaluate(() =>
    window.__editor!.getState().elements.map((e) => ({
      text: (e as { text?: string }).text,
      spans: (e as { spans?: unknown }).spans,
    })),
  )

test('a crash offers diagnostics and recovering the autosave restores the board', async ({
  page,
}) => {
  await openApp(page)
  await skipGallery(page)

  const ids = await addTwoTexts(page)
  await expect.poll(() => persistedTexts(page)).toEqual(['Before crash A', 'Before crash B'])

  await corrupt(page, ids[1])

  await expect(crashScreen(page)).toBeVisible()

  await page.getByText('Details').click()
  const report = page.locator('details pre')
  await expect(report).toContainText('Pic Collage Maker crash report')
  await expect(report).toContainText('userAgent:')
  await expect(report).toContainText('board: 1080x1350, 2 elements')
  await expect(report).toContainText('elements')
  await expect(report).not.toContainText('Before crash')

  await recover(page)
  await waitForElements(page, 'text', 2)

  await expect(crashScreen(page)).toBeHidden()
  expect(await liveTexts(page)).toEqual([
    { text: 'Before crash A', spans: undefined },
    { text: 'Before crash B', spans: undefined },
  ])
})

test('a crash never reaches the saved copy of the open project', async ({ page }) => {
  await openApp(page)
  await skipGallery(page)
  const projectId = await page.evaluate(() =>
    (window as unknown as { __projects: ProjectsSeam }).__projects
      .getState()
      .createProject('Crash test'),
  )
  const ids = await addTwoTexts(page)
  await expect.poll(() => persistedTexts(page)).toEqual(['Before crash A', 'Before crash B'])
  // Let the project autosave (1.5 s debounce) land the good state first.
  await page.waitForTimeout(2_000)

  await corrupt(page, ids[1])
  await expect(crashScreen(page)).toBeVisible()
  // Past the project autosave's debounce, which a crash does not unmount.
  await page.waitForTimeout(2_000)

  await recover(page)
  await page.evaluate(
    (id) =>
      (window as unknown as { __projects: ProjectsSeam }).__projects.getState().openProject(id),
    projectId,
  )
  await waitForElements(page, 'text', 2)
  await expect(crashScreen(page)).toBeHidden()
  expect(await liveTexts(page)).toEqual([
    { text: 'Before crash A', spans: undefined },
    { text: 'Before crash B', spans: undefined },
  ])
})

test('when the saved board itself crashes, recover is withdrawn instead of looping', async ({
  page,
}) => {
  await openApp(page)
  await skipGallery(page)
  const ids = await addTwoTexts(page)
  await expect.poll(() => persistedTexts(page)).toEqual(['Before crash A', 'Before crash B'])

  // The crash that saves before it surfaces: e.g. a node that only breaks once
  // an image decodes, after the autosave has already written the bad state.
  await page.evaluate(async (id) => {
    const ed = window.__editor!.getState()
    const doc = {
      ...ed,
      elements: ed.elements.map((e) => (e.id === id ? { ...e, spans: [null] } : e)),
    }
    const plain = JSON.parse(JSON.stringify(doc, (_k, v) => (typeof v === 'function' ? undefined : v)))
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('piccollage')
      req.onsuccess = () => {
        const t = req.result.transaction('doc', 'readwrite')
        t.objectStore('doc').put(plain, 'current')
        t.oncomplete = () => {
          req.result.close()
          resolve()
        }
        t.onerror = () => reject(t.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, ids[1])
  await corrupt(page, ids[1])
  await expect(crashScreen(page)).toBeVisible()

  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Recover last autosave' }).click(),
  ])
  await expect(crashScreen(page)).toBeVisible()
  await expect(page.getByText("Recovering didn't help")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Recover last autosave' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Copy diagnostics' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset App' })).toBeVisible()
})
