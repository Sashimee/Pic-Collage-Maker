import { useEffect, useRef } from 'react'
import { useEditor } from '../store/editorStore'
import { useImportFiles } from './useImportFiles'
import { useToasts } from '../components/ToastContainer'
import { useT } from '../i18n/useLang'

interface LaunchParams {
  files: readonly FileSystemFileHandle[]
}

declare global {
  interface Window {
    launchQueue?: { setConsumer: (consumer: (params: LaunchParams) => void) => void }
  }
}

const isProjectFile = (file: File) => file.name.toLowerCase().endsWith('.piccollage')

/**
 * Opens what the OS hands the installed app through the manifest's `file_handlers`:
 * a `.piccollage` replaces the board, images join it. Waits for `ready` — the startup
 * restore — which would otherwise replace the board under them.
 */
export function useLaunchFiles(ready: boolean) {
  const importFiles = useImportFiles()
  const addPhoto = useEditor((s) => s.addPhoto)
  const toast = useToasts()
  const t = useT()
  const latest = useRef({ importFiles, addPhoto, toast, t })
  useEffect(() => {
    latest.current = { importFiles, addPhoto, toast, t }
  })

  useEffect(() => {
    if (!ready || !window.launchQueue) return
    window.launchQueue.setConsumer((params) => {
      if (!params.files.length) return
      void (async () => {
        const { importFiles, addPhoto, toast, t } = latest.current
        const fail = (err: unknown) => {
          console.error('[launchFiles] could not open the launched files', err)
          toast.error(err instanceof Error ? err.message : t('error.loadImages'))
        }
        let files: File[]
        try {
          files = await Promise.all(params.files.map((handle) => handle.getFile()))
        } catch (err) {
          fail(err)
          return
        }
        const project = files.find(isProjectFile)
        // On a cold start the restored board may be the user's only copy of their work.
        const boardEmpty = !useEditor.getState().elements.length
        if (project && (boardEmpty || window.confirm(t('launch.replaceConfirm')))) {
          try {
            const { unpackProject } = await import('../lib/projectFile')
            const { doc } = await unpackProject(project)
            useEditor.getState().loadDocument(doc)
            toast.success(t('toast.projectOpened'))
          } catch (err) {
            fail(err)
          }
        }
        const images = new DataTransfer()
        for (const file of files) if (!isProjectFile(file)) images.items.add(file)
        if (images.files.length) await importFiles(images.files, addPhoto).catch(fail)
      })()
    })
  }, [ready])
}
