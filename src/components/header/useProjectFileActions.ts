import { useEditor } from '../../store/editorStore'
import { useProjects } from '../../store/projectsStore'
import { useT } from '../../i18n/useLang'
import { useToasts } from '../ToastContainer'

/** Save / open a `.piccollage` file, and zip up the board's photos. */
export function useProjectFileActions() {
  const t = useT()
  const toast = useToasts()
  const activeProjectId = useProjects((s) => s.activeProjectId)

  const handleSaveAsFile = async () => {
    const { packProject } = await import('../../lib/projectFile')
    const doc = {
      boardWidth: useEditor.getState().boardWidth,
      boardHeight: useEditor.getState().boardHeight,
      background: useEditor.getState().background,
      mode: useEditor.getState().mode,
      gridId: useEditor.getState().gridId,
      gridGap: useEditor.getState().gridGap,
      gridRadius: useEditor.getState().gridRadius,
      frame: useEditor.getState().frame,
      elements: useEditor.getState().elements,
    }
    const blob = await packProject(activeProjectId ? 'Project' : 'Collage', doc)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `collage-${Date.now()}.piccollage`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(t('toast.projectSavedFile'))
  }

  const handleOpenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { unpackProject } = await import('../../lib/projectFile')
      const { doc } = await unpackProject(file)
      useEditor.getState().loadDocument(doc)
      e.target.value = ''
      toast.success(t('toast.projectOpened'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.loadImage'))
      e.target.value = ''
    }
  }

  const handleBatchExport = async () => {
    const { batchExport } = await import('../../lib/batchExport')
    const s = useEditor.getState()
    const elements = s.elements.filter((e) => e.type === 'photo')
    if (!elements.length) {
      toast.info(t('toast.noPhotosExport'))
      return
    }
    const files: { name: string; dataUrl: string }[] = []
    for (let i = 0; i < elements.length; i++) {
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
    if (!files.length) {
      toast.info(t('toast.noExportablePhotos'))
      return
    }
    const zip = await batchExport(files)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(zip)
    a.download = `collage-batch-${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(t('toast.batchExportDone'))
  }

  return { handleSaveAsFile, handleOpenFile, handleBatchExport }
}
