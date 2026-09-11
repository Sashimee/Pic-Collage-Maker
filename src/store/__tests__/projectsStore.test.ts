import { describe, it, expect, beforeEach } from 'vitest'
import { useProjects } from '../projectsStore'
import { useEditor } from '../editorStore'

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
})
