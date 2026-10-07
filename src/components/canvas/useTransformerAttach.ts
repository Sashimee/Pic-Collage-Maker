import { useEffect, type RefObject } from 'react'
import type Konva from 'konva'
import { useEditor } from '../../store/editorStore'

/**
 * Attach the shared Transformer to the selection — every multi-selected
 * element, or else the selected one — keeping only free nodes: anything in
 * free mode, only non-photo elements in grid mode, never locked or hidden ones.
 */
export function useTransformerAttach(
  trRef: RefObject<Konva.Transformer | null>,
  stageRef: RefObject<Konva.Stage | null>,
) {
  const selectedId = useEditor((s) => s.selectedId)
  const multiSelected = useEditor((s) => s.multiSelected)
  const mode = useEditor((s) => s.mode)
  const elements = useEditor((s) => s.elements)

  useEffect(() => {
    const tr = trRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    const ids = multiSelected.length > 1 ? multiSelected : selectedId ? [selectedId] : []
    const nodes = ids.flatMap((id) => {
      const el = elements.find((e) => e.id === id)
      if (!el || el.locked || el.hidden || (mode === 'grid' && el.type === 'photo')) return []
      const node = stage.findOne('#' + id)
      return node ? [node] : []
    })
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [trRef, stageRef, selectedId, multiSelected, mode, elements])
}
