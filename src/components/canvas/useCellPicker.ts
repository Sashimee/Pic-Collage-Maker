import { useRef } from 'react'
import { useEditor } from '../../store/editorStore'
import { useT } from '../../i18n/useLang'
import { useToasts } from '../ToastContainer'
import { useImportFiles } from '../../hooks/useImportFiles'

/** Tapping an empty grid cell picks photos straight into that cell. */
export function useCellPicker() {
  const t = useT()
  const importFiles = useImportFiles()
  const toast = useToasts()
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCell = useRef<number | null>(null)

  const open = (index: number) => {
    pendingCell.current = index
    inputRef.current?.click()
  }

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const start = pendingCell.current
    pendingCell.current = null
    if (!input.files?.length) return
    // Only the first picked photo claims the tapped cell; any extras fall into
    // the remaining free slots in order.
    let first = true
    try {
      await importFiles(input.files, (src, w, h, photoId, opts) => {
        const store = useEditor.getState()
        store.addPhoto(src, w, h, photoId, opts)
        if (first && start != null) {
          const els = useEditor.getState().elements
          const added = els[els.length - 1]
          if (added?.type === 'photo') store.updateElement(added.id, { cellIndex: start })
        }
        first = false
      })
    } catch {
      toast.info(t('error.loadImage'))
    }
    input.value = ''
  }

  return { inputRef, open, onChange }
}
