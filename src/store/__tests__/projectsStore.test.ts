import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProjects } from '../projectsStore'
import { useEditor } from '../editorStore'
import { loadProject } from '../../services/localProjects'
import { toProjectDocument } from '../../lib/projectSchema'

describe('projectsStore', () => {
  beforeEach(() => {
    // Reset stores
    useEditor.setState({
      elements: [],
      selectedId: null,
      past: [],
      future: [],
    })
    useProjects.setState({
      projects: [],
      activeProjectId: null,
      isLoading: false,
    })
  })

  it('creates a project from current editor state', async () => {
    // Add an element so state is non-empty
    useEditor.getState().addText()
    const id = await useProjects.getState().createProject('Test Project')
    expect(useProjects.getState().projects.length).toBe(1)
    expect(useProjects.getState().projects[0].name).toBe('Test Project')
    expect(useProjects.getState().activeProjectId).toBe(id)
  })

  it('lists projects sorted by updatedAt', async () => {
    useEditor.getState().addText()
    await useProjects.getState().createProject('A')
    await useProjects.getState().createProject('B')
    const names = useProjects.getState().projects.map((p) => p.name)
    expect(names).toEqual(['B', 'A'])
  })

  it('renames a project', async () => {
    useEditor.getState().addText()
    const id = await useProjects.getState().createProject('Old')
    await useProjects.getState().renameProject(id, 'New')
    expect(useProjects.getState().projects[0].name).toBe('New')
  })

  it('duplicates a project', async () => {
    useEditor.getState().addText()
    const id = await useProjects.getState().createProject('Original')
    await useProjects.getState().duplicateProject(id)
    expect(useProjects.getState().projects.length).toBe(2)
    expect(useProjects.getState().projects[0].name).toContain('Copy')
  })

  it('deletes a project', async () => {
    useEditor.getState().addText()
    const id = await useProjects.getState().createProject('ToDelete')
    await useProjects.getState().deleteProject(id)
    expect(useProjects.getState().projects.length).toBe(0)
    expect(useProjects.getState().activeProjectId).toBeNull()
  })

  it('restores a deleted project from what deleteProject returned', async () => {
    useEditor.getState().addText()
    const id = await useProjects.getState().createProject('Undo me')
    const deleted = await useProjects.getState().deleteProject(id)
    expect(deleted?.name).toBe('Undo me')

    await useProjects.getState().restoreProject(deleted!)

    expect(useProjects.getState().projects.map((p) => p.id)).toContain(id)
  })

  it('undoing the delete of the open project reattaches it, edits included', async () => {
    const id = await useProjects.getState().createProject('Open')
    useEditor.getState().addText()
    const documentId = useEditor.getState().documentId

    const deleted = await useProjects.getState().deleteProject(id)
    expect(useProjects.getState().activeProjectId).toBeNull()
    useEditor.getState().addText()
    await useProjects.getState().restoreProject(deleted!, documentId)

    expect(useProjects.getState().activeProjectId).toBe(id)
    const stored = toProjectDocument((await loadProject(id))!.data)!
    expect(stored.pages[stored.activePage].elements).toHaveLength(2)
  })

  it('does not reattach once something else is on the board', async () => {
    const id = await useProjects.getState().createProject('Open')
    const documentId = useEditor.getState().documentId
    const deleted = await useProjects.getState().deleteProject(id)

    useEditor.getState().clearAll()
    await useProjects.getState().restoreProject(deleted!, documentId)

    expect(useProjects.getState().activeProjectId).toBeNull()
    expect(useProjects.getState().projects.map((p) => p.id)).toContain(id)
  })

  it('deleting a project that is not there returns null', async () => {
    expect(await useProjects.getState().deleteProject('missing')).toBeNull()
  })

  it('saves a pending edit as soon as the page is hidden', async () => {
    const id = await useProjects.getState().createProject('Hidden')
    useEditor.getState().addText()

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    try {
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.waitFor(async () => {
        const stored = toProjectDocument((await loadProject(id))?.data)
        expect(stored?.pages[stored.activePage].elements).toHaveLength(1)
      }, 1000)
    } finally {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    }
  })
})
