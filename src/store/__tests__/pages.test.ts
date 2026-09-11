import { describe, it, expect, beforeEach } from 'vitest'
import { useProjects } from '../projectsStore'
import { useEditor } from '../editorStore'
import { loadProject } from '../../services/localProjects'
import { toProjectDocument } from '../../lib/projectSchema'

/*
 * The editor holds one live document; the store holds the rest of the pages.
 * Every one of these actions has to fold the live document back in before it
 * touches the list, or the page you were editing silently loses its work. That
 * is what most of these tests are really checking.
 */

const projects = () => useProjects.getState()
const editor = () => useEditor.getState()

/** Text content of the live board, as a stand-in for "which page am I on". */
const liveTexts = () =>
  editor()
    .elements.filter((e) => e.type === 'text')
    .map((e) => (e as unknown as { text: string }).text)

async function addTextPage(label: string) {
  editor().addText()
  const els = editor().elements
  const last = els[els.length - 1]
  editor().updateElement(last.id, { text: label } as never)
}

beforeEach(async () => {
  useEditor.setState({ elements: [], selectedId: null, past: [], future: [] })
  useProjects.setState({
    projects: [],
    activeProjectId: null,
    isLoading: false,
    pages: [],
    activePage: 0,
  })
})

describe('page actions', () => {
  it('a new project starts as a single page', async () => {
    await projects().createProject('P')
    expect(projects().pages).toHaveLength(1)
    expect(projects().activePage).toBe(0)
  })

  it('addPage appends and moves to it, leaving a blank board', async () => {
    await addTextPage('page one')
    await projects().createProject('P')

    await projects().addPage()

    expect(projects().pages).toHaveLength(2)
    expect(projects().activePage).toBe(1)
    expect(liveTexts()).toEqual([]) // the new page is empty
  })

  it('keeps the first page’s work when adding a second', async () => {
    // The regression that matters: the live document must be folded back in
    // before the page list changes.
    await addTextPage('page one')
    await projects().createProject('P')
    await projects().addPage()

    await projects().setActivePage(0)
    expect(liveTexts()).toEqual(['page one'])
  })

  it('carries edits made after the project was created', async () => {
    await projects().createProject('P')
    await addTextPage('added later') // edited, not yet saved
    await projects().addPage()

    await projects().setActivePage(0)
    expect(liveTexts()).toEqual(['added later'])
  })

  it('switching pages swaps the board both ways', async () => {
    await addTextPage('one')
    await projects().createProject('P')
    await projects().addPage()
    await addTextPage('two')

    await projects().setActivePage(0)
    expect(liveTexts()).toEqual(['one'])
    await projects().setActivePage(1)
    expect(liveTexts()).toEqual(['two'])
  })

  it('undo history does not leak across pages', async () => {
    await addTextPage('one')
    await projects().createProject('P')
    await projects().addPage()
    // A fresh page must not be able to undo into the previous page's content.
    expect(editor().past).toHaveLength(0)
  })

  it('duplicatePage copies the page and lands on the copy', async () => {
    await addTextPage('original')
    await projects().createProject('P')

    await projects().duplicatePage()

    expect(projects().pages).toHaveLength(2)
    expect(projects().activePage).toBe(1)
    expect(liveTexts()).toEqual(['original'])
  })

  it('deletePage removes it and follows a sensible page', async () => {
    await addTextPage('one')
    await projects().createProject('P')
    await projects().addPage()
    await addTextPage('two')

    await projects().deletePage(1)

    expect(projects().pages).toHaveLength(1)
    expect(projects().activePage).toBe(0)
    expect(liveTexts()).toEqual(['one'])
  })

  it('refuses to delete the last page', async () => {
    await projects().createProject('P')
    await projects().deletePage(0)
    expect(projects().pages).toHaveLength(1)
  })

  it('reorderPages moves a page and keeps you on the one you were editing', async () => {
    await addTextPage('one')
    await projects().createProject('P')
    await projects().addPage()
    await addTextPage('two')

    // Currently on page 2 (index 1); move page 1 to the end.
    await projects().reorderPages(0, 1)

    expect(projects().pages).toHaveLength(2)
    expect(liveTexts()).toEqual(['two'])
  })

  it('persists pages to the project record, not just to memory', async () => {
    await addTextPage('one')
    const id = await projects().createProject('P')
    await projects().addPage()
    await addTextPage('two')
    await projects().saveActiveProject()

    const stored = toProjectDocument((await loadProject(id))!.data)!
    expect(stored.pages).toHaveLength(2)
    expect(stored.activePage).toBe(1)
  })

  it('does nothing without a project rather than throwing', async () => {
    await expect(projects().addPage()).resolves.toBeUndefined()
    await expect(projects().setActivePage(3)).resolves.toBeUndefined()
    expect(projects().pages).toHaveLength(0)
  })

  it('clamps a page index that is out of range', async () => {
    await projects().createProject('P')
    await projects().setActivePage(99)
    expect(projects().activePage).toBe(0)
  })
})
