import type Konva from 'konva'
import type { BaseElement, CanvasElement } from '../../types'

export function toBlend(mode: BaseElement['blendMode']): Konva.NodeConfig['globalCompositeOperation'] {
  return !mode || mode === 'normal' ? 'source-over' : mode
}

export interface NodeProps<T extends CanvasElement> {
  el: T
  onSelect: (e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  onChange: (patch: Partial<CanvasElement>) => void
  onEditText?: (id: string) => void
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void
}

// Shared transform → store bridge. We keep scaleX/scaleY on the node (rather
// than baking size) so a single Transformer works uniformly for every type.
export function commonHandlers(
  onChange: (patch: Partial<CanvasElement>) => void,
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void,
): {
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void
} {
  return {
    onDragMove: (e) => {
      onDragMove?.(e)
    },
    onDragEnd: (e) => onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e) => {
      const node = e.target
      onChange({
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      })
    },
  }
}
