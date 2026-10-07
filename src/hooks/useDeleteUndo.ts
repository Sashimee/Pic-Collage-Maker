import { useEffect, useRef } from 'react'
import { useEditor } from '../store/editorStore'
import { addUndoToast } from '../store/toastStore'
import { useT } from '../i18n/useLang'

/**
 * "Deleted · Undo" after any element removal, whichever of the delete paths took it —
 * so it watches the history, where every one of them ends up, rather than each button.
 */
export function useDeleteUndo() {
  const t = useT()
  const tRef = useRef(t)
  tRef.current = t

  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        const entry = s.past[s.past.length - 1]
        // Undoing back onto an older delete must not offer it again.
        if (!entry || entry.label !== 'history.delete' || prev.past.includes(entry)) return
        addUndoToast(tRef.current('element.deleted'), tRef.current('header.undo'), () => {
          const { past, undo } = useEditor.getState()
          // After further edits, one undo step would take back the latest of those instead.
          if (past[past.length - 1] === entry) undo()
        })
      }),
    [],
  )
}
