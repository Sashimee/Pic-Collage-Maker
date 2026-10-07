import { create } from 'zustand'
import { saveProject, loadProject, deleteProject, listProjects, type Project } from '../services/localProjects'
import { useEditor, type LoadedDocument } from './editorStore'
import { useVersionStore } from './versionStore'
import {
  rehydrateBackground,
  rehydratePhotos,
  stripBackgroundUrl,
  stripPhotoUrls,
} from '../lib/photoRehydrate'
import {
  PROJECT_SCHEMA,
  activeDocument,
  singlePage,
  toProjectDocument,
  withActivePage,
  type ProjectDocument,
} from '../lib/projectSchema'
import { hasCrashed } from '../lib/crashState'

export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

interface ProjectsState {
  projects: ProjectMeta[]
  activeProjectId: string | null
  isLoading: boolean

  // actions
  loadProjectList: () => Promise<void>
  createProject: (name: string) => Promise<string>
  openProject: (id: string) => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
  duplicateProject: (id: string) => Promise<string>
  /** Resolves to the deleted record, so the caller can offer an undo. */
  deleteProject: (id: string) => Promise<Project | null>
  /**
   * Puts a deleted project back. With `documentId`, also reattaches the editor to it —
   * but only if nothing else has been loaded into the editor since (see editorStore).
   */
  restoreProject: (project: Project, documentId?: number) => Promise<void>
  saveActiveProject: () => Promise<void>
  /** Saves any pending edits, then detaches the editor from the project. */
  closeProject: () => Promise<void>

  /* ---- pages -----------------------------------------------------------
   * The editor always holds exactly one live document — the page you are
   * looking at — so `pages[activePage]` here is the *stored* copy and lags
   * the editor until the next save. Anything that persists must fold the
   * live document back in first; `liveDocument()` does that.
   */
  pages: LoadedDocument[]
  activePage: number
  addPage: () => Promise<void>
  duplicatePage: (index?: number) => Promise<void>
  /** Resolves to the deleted page, so the caller can offer an undo. */
  deletePage: (index: number) => Promise<LoadedDocument | null>
  /** Puts a deleted page back at `index` and switches to it. */
  restorePage: (index: number, page: LoadedDocument) => Promise<void>
  reorderPages: (from: number, to: number) => Promise<void>
  /** `skipCommit` is internal: deletePage has already written the pages. */
  setActivePage: (index: number, skipCommit?: boolean) => Promise<void>
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

/**
 * Name for a project created implicitly (e.g. saving before a share), where
 * prompting would put a dialog in the user's way. Follows the UI language via
 * the browser's locale rather than hard-coding English.
 */
export function defaultProjectName(now = new Date()): string {
  return `Collage ${now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
}

/**
 * Record a version-history entry alongside the project save. `versionStore`
 * has always had the machinery for this, but nothing ever called it — which is
 * why the History panel was permanently empty. It de-duplicates and prunes
 * internally, so callers can fire it on every save.
 */
async function recordVersion(projectId: string) {
  const s = useEditor.getState()
  await useVersionStore.getState().saveSnapshot(projectId, s.elements, s.background)
}

function getSnapshot(): LoadedDocument {
  const s = useEditor.getState()
  return {
    boardWidth: s.boardWidth,
    boardHeight: s.boardHeight,
    background: stripBackgroundUrl(s.background),
    mode: s.mode,
    gridId: s.gridId,
    gridGap: s.gridGap,
    gridRadius: s.gridRadius,
    gridMargin: s.gridMargin,
    frame: s.frame,
    // Photos' object URLs are per-document and die on reload; keep only the
    // photoId so openProject can rebuild them from IndexedDB.
    elements: stripPhotoUrls(s.elements),
  }
}

/** A blank page that inherits the current page's size and frame, so a project
 *  stays dimensionally consistent — which is what a photo book wants. */
function blankPage(like: LoadedDocument): LoadedDocument {
  return { ...like, elements: [], gridId: null, mode: 'free' }
}


type Get = () => ProjectsState
type Set = (patch: Partial<ProjectsState>) => void

/**
 * Apply `mutate` to the project's page list and persist the result.
 *
 * Always folds the *live* editor document into the active page first — the
 * store's copy lags until a save, so mutating without folding would silently
 * discard whatever the user has just drawn. Returns the new page list, or null
 * if there is no project to write to.
 */
async function commitPages(
  get: Get,
  set: Set,
  mutate: (doc: ProjectDocument) => ProjectDocument,
): Promise<LoadedDocument[] | null> {
  const { activeProjectId, pages, activePage } = get()
  if (!activeProjectId || typeof indexedDB === 'undefined') return null

  const live: ProjectDocument = {
    schema: PROJECT_SCHEMA,
    pages: pages.map((p, i) => (i === activePage ? getSnapshot() : p)),
    activePage,
  }
  const next = mutate(live)
  const clampedCursor = Math.max(0, Math.min(next.pages.length - 1, next.activePage))
  set({ pages: next.pages, activePage: clampedCursor })
  await persistPages(get)
  return next.pages
}

/** Write the store's page list to the active project record. */
async function persistPages(get: Get): Promise<void> {
  const { activeProjectId, pages, activePage } = get()
  if (!activeProjectId || typeof indexedDB === 'undefined') return
  const project = await loadProject(activeProjectId)
  if (!project) return
  project.data = { schema: PROJECT_SCHEMA, pages, activePage }
  project.updatedAt = Date.now()
  await saveProject(project)
}

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,
  pages: [],
  activePage: 0,

  loadProjectList: async () => {
    if (typeof indexedDB === 'undefined') return
    set({ isLoading: true })
    try {
      const ids = await listProjects()
      const loaded: ProjectMeta[] = []
      for (const id of ids) {
        const p = await loadProject(id)
        if (p) {
          loaded.push({
            id: p.id,
            name: p.name,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })
        }
      }
      loaded.sort((a, b) => b.updatedAt - a.updatedAt)
      set({ projects: loaded, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createProject: async (name) => {
    if (typeof indexedDB === 'undefined') return ''
    const id = uid()
    const now = Date.now()
    const snapshot = singlePage(getSnapshot())
    const project: Project = {
      id,
      name: name || 'Untitled',
      createdAt: now,
      updatedAt: now,
      data: snapshot,
    }
    await saveProject(project)
    await recordVersion(id)
    set((state) => ({
      projects: [{ id, name: project.name, createdAt: now, updatedAt: now }, ...state.projects],
      activeProjectId: id,
      pages: snapshot.pages,
      activePage: snapshot.activePage,
    }))
    return id
  },

  openProject: async (id) => {
    if (typeof indexedDB === 'undefined') return
    const project = await loadProject(id)
    if (!project) return
    // Migrates a legacy single-document project into a one-page one; returns
    // null only when there is nothing usable, in which case leave the canvas
    // as it is rather than clearing the user's work.
    const doc = toProjectDocument(project.data)
    if (!doc) return
    const page = activeDocument(doc)
    const elements = await rehydratePhotos(page.elements)
    const background = await rehydrateBackground(page.background)
    useEditor.getState().loadDocument({ ...page, elements, background })
    set({ activeProjectId: id, pages: doc.pages, activePage: doc.activePage })
  },

  renameProject: async (id, name) => {
    if (typeof indexedDB === 'undefined') return
    const project = await loadProject(id)
    if (!project) return
    project.name = name
    project.updatedAt = Date.now()
    await saveProject(project)
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: project.updatedAt } : p
      ),
    }))
  },

  duplicateProject: async (id) => {
    if (typeof indexedDB === 'undefined') return ''
    const project = await loadProject(id)
    if (!project) throw new Error('Project not found')
    const newId = uid()
    const now = Date.now()
    const newProject: Project = {
      id: newId,
      name: project.name + ' (Copy)',
      createdAt: now,
      updatedAt: now,
      data: project.data,
    }
    await saveProject(newProject)
    set((state) => ({
      projects: [
        { id: newId, name: newProject.name, createdAt: now, updatedAt: now },
        ...state.projects,
      ],
    }))
    return newId
  },

  deleteProject: async (id) => {
    if (typeof indexedDB === 'undefined') return null
    // Flush pending edits first, so the record an undo puts back is the latest one.
    if (get().activeProjectId === id) await get().closeProject()
    const deleted = (await loadProject(id)) ?? null
    await deleteProject(id)
    set((state) => {
      const nextProjects = state.projects.filter((p) => p.id !== id)
      const nextActive = state.activeProjectId === id ? null : state.activeProjectId
      return { projects: nextProjects, activeProjectId: nextActive }
    })
    return deleted
  },

  restoreProject: async (project, documentId) => {
    if (typeof indexedDB === 'undefined') return
    await saveProject(project)
    await get().loadProjectList()
    if (documentId === undefined || get().activeProjectId !== null) return
    if (useEditor.getState().documentId !== documentId) return
    const doc = toProjectDocument(project.data)
    if (!doc) return
    set({ activeProjectId: project.id, pages: doc.pages, activePage: doc.activePage })
    // Edits made while it was gone are only on the board until this folds them in.
    await trackSave()
  },

  saveActiveProject: async () => {
    if (typeof indexedDB === 'undefined') return
    const { activeProjectId } = get()
    if (!activeProjectId) return
    const project = await loadProject(activeProjectId)
    if (!project) return
    // Keep any other pages; only the one being edited is replaced.
    const existing = toProjectDocument(project.data)
    const next = existing
      ? withActivePage(existing, getSnapshot())
      : singlePage(getSnapshot())
    project.data = next
    project.updatedAt = Date.now()
    await saveProject(project)
    await recordVersion(activeProjectId)
    set({ pages: next.pages, activePage: next.activePage })
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === activeProjectId ? { ...p, updatedAt: project.updatedAt } : p
      ),
    }))
  },

  /* ---- pages ----------------------------------------------------------- */

  closeProject: async () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
      if (!hasCrashed()) trackSave().catch(() => {})
    }
    // A save still under way would set this project's pages again after the detach.
    await inFlightSave
    set({ activeProjectId: null, pages: [], activePage: 0 })
  },

  addPage: async () => {
    const pages = await commitPages(get, set, (doc) => ({
      ...doc,
      pages: [...doc.pages, blankPage(activeDocument(doc))],
    }))
    if (pages) await get().setActivePage(pages.length - 1)
  },

  duplicatePage: async (index) => {
    const from = index ?? get().activePage
    const pages = await commitPages(get, set, (doc) => {
      const copy = structuredClone(doc.pages[from] ?? activeDocument(doc))
      const next = doc.pages.slice()
      next.splice(from + 1, 0, copy)
      return { ...doc, pages: next }
    })
    if (pages) await get().setActivePage(from + 1)
  },

  deletePage: async (index) => {
    // A project always has at least one page; removing the last would leave
    // openProject with nothing to load.
    if (get().pages.length <= 1) return null
    const wasActive = get().activePage
    let deleted: LoadedDocument | null = null
    const pages = await commitPages(get, set, (doc) => {
      deleted = doc.pages[index] ?? null
      return { ...doc, pages: doc.pages.filter((_, i) => i !== index) }
    })
    if (!pages) return null
    // Follow the page that took its place, clamped to the new end.
    const target = index < wasActive ? wasActive - 1 : Math.min(wasActive, pages.length - 1)
    await get().setActivePage(target, true)
    return deleted
  },

  restorePage: async (index, page) => {
    const at = Math.max(0, Math.min(get().pages.length, index))
    const pages = await commitPages(get, set, (doc) => {
      const next = doc.pages.slice()
      next.splice(at, 0, page)
      // The cursor has to follow the live page, or the switch below folds it into its neighbour.
      return { ...doc, pages: next, activePage: doc.activePage + (at <= doc.activePage ? 1 : 0) }
    })
    if (pages) await get().setActivePage(at)
  },

  reorderPages: async (from, to) => {
    const { pages: current, activePage } = get()
    if (from === to || from < 0 || from >= current.length) return
    const clamped = Math.max(0, Math.min(current.length - 1, to))
    const moved = current[activePage]
    const pages = await commitPages(get, set, (doc) => {
      const next = doc.pages.slice()
      const [item] = next.splice(from, 1)
      next.splice(clamped, 0, item)
      return { ...doc, pages: next }
    })
    if (!pages) return
    // Keep looking at the same page, wherever it ended up.
    const stillActive = pages.indexOf(moved)
    if (stillActive !== -1 && stillActive !== get().activePage) {
      set({ activePage: stillActive })
      await persistPages(get)
    }
  },

  setActivePage: async (index, skipCommit = false) => {
    const { activeProjectId, activePage } = get()
    if (!activeProjectId) return
    // Fold the live document back into the page being left *before* moving the
    // cursor, or the debounced autosave writes it into the wrong page.
    const pages = skipCommit
      ? get().pages
      : await commitPages(get, set, (doc) => doc)
    if (!pages) return

    const target = Math.max(0, Math.min(pages.length - 1, index))
    if (target === activePage && !skipCommit) return

    set({ activePage: target })
    await persistPages(get)

    const page = pages[target]
    const elements = await rehydratePhotos(page.elements)
    const background = await rehydrateBackground(page.background)
    // loadDocument clears past/future, so undo is per page — a Snapshot is a
    // whole document and an undo stack spanning pages would restore the wrong
    // board.
    useEditor.getState().loadDocument({ ...page, elements, background })
  },
}))


// Auto-save: whenever the editor state changes, save to the active project.
// Debounced to avoid hammering IndexedDB during rapid edits.
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let inFlightSave: Promise<void> | null = null
// Saves run one after another, so an older one can never finish last and leave its pages.
function trackSave(): Promise<void> {
  const save = (inFlightSave ?? Promise.resolve())
    .catch(() => {})
    .then(() => useProjects.getState().saveActiveProject())
  inFlightSave = save
  return save.finally(() => {
    if (inFlightSave === save) inFlightSave = null
  })
}
useEditor.subscribe(() => {
  if (typeof indexedDB === 'undefined') return
  const { activeProjectId } = useProjects.getState()
  if (!activeProjectId) return
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveTimeout = null
    if (hasCrashed()) return
    trackSave().catch(() => {})
  }, 1500)
})

// Dev-only test seam, alongside `window.__editor` in editorStore. Lets the e2e
// suite drive project save/open across a page reload, which is the only way to
// exercise photo rehydration — within a session the stale URLs still resolve.
if (import.meta.env.DEV) {
  ;(window as unknown as { __projects?: typeof useProjects }).__projects = useProjects
}
