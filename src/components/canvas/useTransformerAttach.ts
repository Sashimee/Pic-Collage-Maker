import { useEffect, type RefObject } from 'react'
import type Konva from 'konva'
import { useEditor } from '../../store/editorStore'

/**
 * Attach the shared Transformer to the selected element when it is a free
 * node — anything in free mode, only non-photo elements in grid mode.
 */
export function useTransformerAttach(
  trRef: RefObject<Konva.Transformer | null>,
  stageRef: RefObject<Konva.Stage | null>,
) {
  const selectedId = useEditor((s) => s.selectedId)
  const mode = useEditor((s) => s.mode)
  const elements = useEditor((s) => s.elements)

  useEffect(() => {
    const tr = trRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    const sel = selectedId
      ? elements.find((e) => e.id === selectedId)
      : undefined
    const attachable = !!sel && (mode !== 'grid' || sel.type !== 'photo')
    const node = attachable ? stage.findOne('#' + selectedId) : undefined
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [trRef, stageRef, selectedId, mode, elements])
}
