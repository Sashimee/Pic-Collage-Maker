import { useEffect, useRef } from 'react'
import { useEditor } from '../store/editorStore'
import { useT } from '../i18n/useLang'
import { useToast } from '../store/toastStore'
import type { CanvasElement } from '../types'

export interface ShortcutCallbacks {
  onExport?: () => void
  onSave?: () => void
  onOpenProject?: () => void
  onDuplicate?: () => void
}

export function useShortcuts(callbacks: ShortcutCallbacks = {}) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks
  const t = useT()
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      const key = e.key.toLowerCase()

      // Undo
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useEditor.getState().undo()
        return
      }

      // Redo
      if (mod && e.shiftKey && key === 'z') {
        e.preventDefault()
        useEditor.getState().redo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        useEditor.getState().redo()
        return
      }

      // Copy / paste style. By code, not key: Option+C types "ç" on a Mac.
      if (mod && e.altKey && (e.code === 'KeyC' || e.code === 'KeyV')) {
        e.preventDefault()
        const { selectedId, multiSelected, copyStyle, pasteStyle, copiedStyle } =
          useEditor.getState()
        if (!selectedId) return
        if (e.code === 'KeyC') {
          copyStyle(selectedId)
          useToast.getState().add(tRef.current('style.copied'), 'success')
        } else if (copiedStyle) {
          pasteStyle(multiSelected.length > 1 ? multiSelected : [selectedId])
        }
        return
      }

      // Select all
      if (mod && key === 'a') {
        e.preventDefault()
        const { elements, mode, selectMany } = useEditor.getState()
        selectMany(
          elements.filter((el) => mode !== 'grid' || el.type !== 'photo').map((el) => el.id),
        )
        return
      }

      // Duplicate
      if (mod && key === 'd') {
        e.preventDefault()
        const sel = useEditor.getState().selectedId
        if (sel) useEditor.getState().duplicateElement(sel)
        cbRef.current.onDuplicate?.()
        return
      }

      // Group
      if (mod && key === 'g' && !e.shiftKey) {
        e.preventDefault()
        // group selected + any selected via multi-select would need a selection array
        // simplified: group all visible selected-like elements (future: multi-select)
        return
      }

      // Ungroup
      if (mod && e.shiftKey && key === 'g') {
        e.preventDefault()
        const sel = useEditor.getState().selected()
        if (sel?.groupId) {
          useEditor.getState().ungroupElements(sel.groupId)
        }
        return
      }

      // Bring to front / Send to back
      if (mod && e.shiftKey && key === ']') {
        e.preventDefault()
        const sel = useEditor.getState().selectedId
        if (sel) useEditor.getState().bringToFront(sel)
        return
      }
      if (mod && e.shiftKey && key === '[') {
        e.preventDefault()
        const sel = useEditor.getState().selectedId
        if (sel) useEditor.getState().sendToBack(sel)
        return
      }

      // Bring forward / Send backward
      if (mod && !e.shiftKey && key === ']') {
        e.preventDefault()
        const sel = useEditor.getState().selectedId
        if (sel) useEditor.getState().bringForward(sel)
        return
      }
      if (mod && !e.shiftKey && key === '[') {
        e.preventDefault()
        const sel = useEditor.getState().selectedId
        if (sel) useEditor.getState().sendBackward(sel)
        return
      }

      // Clear canvas
      if (mod && e.shiftKey && key === 'c') {
        e.preventDefault()
        if (window.confirm(tRef.current('header.clearConfirm'))) useEditor.getState().clearAll()
        return
      }

      // Copy
      if (mod && key === 'c') {
        e.preventDefault()
        const el = useEditor.getState().selected()
        if (el) {
          const json = JSON.stringify(el)
          navigator.clipboard.writeText(json).catch(() => {
            // Fallback for insecure contexts
            const ta = document.createElement('textarea')
            ta.value = json
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            document.body.removeChild(ta)
          })
        }
        return
      }

      // Paste
      if (mod && key === 'v') {
        e.preventDefault()
        navigator.clipboard.readText().then((text) => {
          try {
            const el = JSON.parse(text)
            if (!el || !el.type) return
            const { id, x, y, ...rest } = el
            const newId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2)
            const store = useEditor.getState()
            const newEl = { ...rest, id: newId, x: (x ?? 0) + 20, y: (y ?? 0) + 20 } as CanvasElement
            if (newEl.type === 'photo') {
              store.updateElement(id, newEl) // can't truly add via update, we need addPhoto
              // Instead: manually insert into elements array
              useEditor.setState({
                elements: [...store.elements, newEl],
                selectedId: newId,
              })
            } else {
              useEditor.setState({
                elements: [...store.elements, newEl],
                selectedId: newId,
              })
            }
          } catch {
            // ignore invalid clipboard
          }
        }).catch(() => {
          // clipboard read denied
        })
        return
      }

      // Arrow nudge
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        const { selectedId: sel, multiSelected, elements, updateElement, updateElements } =
          useEditor.getState()
        if (!sel) return
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        let dx = 0, dy = 0
        if (key === 'arrowup') dy = -step
        if (key === 'arrowdown') dy = step
        if (key === 'arrowleft') dx = -step
        if (key === 'arrowright') dx = step
        if (multiSelected.length > 1) {
          updateElements(
            Object.fromEntries(
              elements
                .filter((el) => multiSelected.includes(el.id))
                .map((el) => [el.id, { x: el.x + dx, y: el.y + dy }]),
            ),
          )
          return
        }
        const el = elements.find((e) => e.id === sel)
        if (!el) return
        updateElement(sel, { x: el.x + dx, y: el.y + dy })
        return
      }

      // Delete / Backspace
      if (key === 'delete' || key === 'backspace') {
        const { selectedId, multiSelected, removeElement, removeElements } = useEditor.getState()
        if (multiSelected.length > 1) {
          e.preventDefault()
          removeElements(multiSelected)
        } else if (selectedId) {
          e.preventDefault()
          removeElement(selectedId)
        }
        return
      }

      // Save
      if (mod && key === 's') {
        e.preventDefault()
        cbRef.current.onSave?.()
        return
      }

      // Export
      if (mod && key === 'e') {
        e.preventDefault()
        cbRef.current.onExport?.()
        return
      }

      // Open project
      if (mod && key === 'o') {
        e.preventDefault()
        cbRef.current.onOpenProject?.()
        return
      }

      // Escape deselect
      if (key === 'escape') {
        e.preventDefault()
        useEditor.getState().select(null)
        return
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
