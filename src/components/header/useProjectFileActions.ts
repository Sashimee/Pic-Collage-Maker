import { useEditor, type LoadedDocument } from '../../store/editorStore'
import { useProjects } from '../../store/projectsStore'
import { useT } from '../../i18n/useLang'
import { useToasts } from '../ToastContainer'
import { hasCrashed } from '../../lib/crashState'
import {
  PROJECT_FILE_TYPES,
  canPickFiles,
  isAbort,
  linkFile,
  linkedHandle,
  unlinkFile,
  writeFile,
} from '../../lib/linkedFile'

/** Save / open a `.piccollage` file, and zip up the board's photos. */
export function useProjectFileActions() {
  const t = useT()
  const toast = useToasts()
  const activeProjectId = useProjects((s) => s.activeProjectId)

  const boardDoc = () => {
    const s = useEditor.getState()
    return {
      boardWidth: s.boardWidth,
      boardHeight: s.boardHeight,
      background: s.background,
      mode: s.mode,
      gridId: s.gridId,
      gridGap: s.gridGap,
      gridRadius: s.gridRadius,
      gridMargin: s.gridMargin,
      frame: s.frame,
      elements: s.elements,
    }
  }

  const pack = async (doc: LoadedDocument) => {
    const { packProject } = await import('../../lib/projectFile')
    return packProject(activeProjectId ? 'Project' : 'Collage', doc)
  }

  const saveTo = async (handle: FileSystemFileHandle) => {
    if (hasCrashed()) return
    // Read together, so the board that gets written is the one the link is checked against.
    const documentId = useEditor.getState().documentId
    const doc = boardDoc()
    try {
      await writeFile(handle, () => pack(doc))
    } catch (err) {
      console.error('[projectFile] could not write the project file', err)
      unlinkFile()
      toast.error(t('file.writeFailed'))
      return
    }
    if (useEditor.getState().documentId === documentId) linkFile(handle)
    toast.success(`${t('file.savedTo')} ${handle.name}`)
  }

  const handleSaveAsNewFile = async () => {
    if (hasCrashed()) return
    if (!canPickFiles() || !window.showSaveFilePicker) {
      let blob: Blob
      try {
        blob = await pack(boardDoc())
      } catch (err) {
        console.error('[projectFile] could not pack the project file', err)
        toast.error(t('file.writeFailed'))
        return
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `collage-${Date.now()}.piccollage`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success(t('toast.projectSavedFile'))
      return
    }
    // Pick before packing: a large project packs for longer than the click's user activation lasts.
    let handle: FileSystemFileHandle
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: `collage-${Date.now()}.piccollage`,
        types: PROJECT_FILE_TYPES,
      })
    } catch (err) {
      if (isAbort(err)) return
      console.error('[projectFile] the save picker failed', err)
      toast.error(t('file.writeFailed'))
      return
    }
    await saveTo(handle)
  }

  const handleSaveAsFile = async () => {
    const handle = linkedHandle()
    return handle ? saveTo(handle) : handleSaveAsNewFile()
  }

  const openFile = async (file: File, handle?: FileSystemFileHandle) => {
    const { unpackProject } = await import('../../lib/projectFile')
    const { doc } = await unpackProject(file)
    useEditor.getState().loadDocument(doc)
    if (handle) linkFile(handle)
    toast.success(t('toast.projectOpened'))
  }

  const handleOpenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await openFile(file)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.loadImage'))
    }
    e.target.value = ''
  }

  /** Opens through the File System Access picker, so the file can be saved in place. Call from a click. */
  const handlePickFile = () => {
    if (!window.showOpenFilePicker) return
    const pick = window.showOpenFilePicker({ types: PROJECT_FILE_TYPES, multiple: false })
    void (async () => {
      let handle: FileSystemFileHandle
      try {
        ;[handle] = await pick
      } catch (err) {
        if (isAbort(err)) return
        console.error('[projectFile] the open picker failed', err)
        toast.error(t('error.loadImage'))
        return
      }
      try {
        await openFile(await handle.getFile(), handle)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('error.loadImage'))
      }
    })()
  }

  const handleBatchExport = async () => {
    const { batchExport } = await import('../../lib/batchExport')
    const s = useEditor.getState()
    const elements = s.elements.filter((e) => e.type === 'photo')
    if (!elements.length) {
      toast.info(t('toast.noPhotosExport'))
      return
    }
    const signal = { cancelled: false }
    const label = (n: number) => `${t('export.packing')} ${n}/${elements.length}`
    const progress = toast.progress(label(1), {
      label: t('menu.cancel'),
      onClick: () => {
        signal.cancelled = true
        progress.done()
      },
    })
    const files: { name: string; dataUrl: string }[] = []
    for (let i = 0; i < elements.length; i++) {
      if (signal.cancelled) return
      progress.update(label(i + 1))
      const el = elements[i]
      const dataUrl = el.src
      if (dataUrl && dataUrl.startsWith('data:')) {
        files.push({ name: `photo-${i + 1}.png`, dataUrl })
      } else if (dataUrl && dataUrl.startsWith('blob:')) {
        // Convert blob URL to data URL
        try {
          const res = await fetch(dataUrl)
          const blob = await res.blob()
          const reader = new FileReader()
          const dataUrlPromise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          const durl = await dataUrlPromise
          files.push({ name: `photo-${i + 1}.png`, dataUrl: durl })
        } catch { /* skip */ }
      }
    }
    if (signal.cancelled) return
    if (!files.length) {
      progress.done()
      toast.info(t('toast.noExportablePhotos'))
      return
    }
    let zip: Blob
    try {
      zip = await batchExport(files)
    } finally {
      progress.done()
    }
    if (signal.cancelled) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(zip)
    a.download = `collage-batch-${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(t('toast.batchExportDone'))
  }

  return { handleSaveAsFile, handleSaveAsNewFile, handleOpenFile, handlePickFile, handleBatchExport }
}
