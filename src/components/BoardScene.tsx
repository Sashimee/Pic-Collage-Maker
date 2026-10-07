import type { ReactNode } from 'react'
import type Konva from 'konva'
import type { CanvasElement, PhotoElement } from '../types'
import type { LoadedDocument } from '../store/editorStore'
import { resolveLayoutById } from '../lib/grids'
import { Background } from './Background'
import { BoardFrame } from './BoardFrame'
import { ElementNode } from './CanvasNodes'
import { GridView } from './GridView'

/**
 * Everything that belongs *on* a board, and nothing that belongs to the editor.
 *
 * This is the exportable definition of a collage: background, the photos (laid
 * into grid cells or free), then the frame. Snap guides, rulers, the dot grid,
 * the in-progress brush stroke and the transformer are editing chrome — they
 * live in EditorCanvas and are passed in through `backdrop` where they need to
 * sit under the content.
 *
 * It exists as its own component so a board can be drawn somewhere other than
 * the live stage: the photo book has to render pages the editor is not
 * currently showing, and a second renderer would drift from this one the first
 * time either changed.
 */
export interface BoardInteractions {
  selectedId: string | null
  onSelect: (id: string, e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  onChange: (id: string, patch: Partial<CanvasElement>) => void
  onEditText?: (id: string) => void
  onDragMove?: (el: CanvasElement) => (e: Konva.KonvaEventObject<DragEvent>) => void
  onEmptyCell?: (index: number) => void
}

export function BoardScene({
  doc,
  interactions,
  backdrop,
  overlay,
}: {
  doc: LoadedDocument
  /** Omit off-screen: nothing is selectable and nothing can be dragged. */
  interactions?: BoardInteractions
  /** Editor-only chrome drawn over the background and under the content. */
  backdrop?: ReactNode
  /**
   * Editor-only chrome drawn over the content but still under the frame — the
   * frame has to stay on top, or an in-progress brush stroke sits above it and
   * then drops below it the moment it is committed.
   */
  overlay?: ReactNode
}) {
  const { boardWidth, boardHeight, background, frame, elements, mode, gridId } = doc

  const gridLayout = gridId ? resolveLayoutById(gridId) : undefined
  const inGrid = mode === 'grid' && !!gridLayout
  // Hidden photos give up their cell, as in the page strip and the photo book's image count.
  const photos = elements.filter((e): e is PhotoElement => e.type === 'photo' && !e.hidden)
  // In grid mode the photos are laid out by GridView; text and stickers still
  // render as free overlays on top of it.
  const freeElements = inGrid ? elements.filter((e) => e.type !== 'photo') : elements

  const noop = () => {}

  return (
    <>
      <Background bg={background} width={boardWidth} height={boardHeight} />
      {backdrop}
      {inGrid && gridLayout && (
        <GridView
          layout={gridLayout}
          photos={photos}
          width={boardWidth}
          height={boardHeight}
          gap={doc.gridGap}
          radius={doc.gridRadius}
          margin={doc.gridMargin ?? 0}
          selectedId={interactions?.selectedId ?? null}
          onSelect={(id) => interactions?.onSelect(id)}
          onUpdate={(id, patch) => interactions?.onChange(id, patch)}
          onEmptyCell={interactions?.onEmptyCell}
        />
      )}
      {freeElements.map((el) => (
        <ElementNode
          key={el.id}
          el={el}
          onSelect={(e) => interactions?.onSelect(el.id, e)}
          onChange={(patch) => interactions?.onChange(el.id, patch)}
          onEditText={interactions?.onEditText}
          onDragMove={interactions?.onDragMove?.(el) ?? noop}
        />
      ))}
      {overlay}
      <BoardFrame frame={frame} width={boardWidth} height={boardHeight} />
    </>
  )
}
