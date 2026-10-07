import { getGridById } from '../grids'
import type { Background, CanvasElement, EditorMode, Frame } from '../../types'
import type { TemplateDocument, TemplateElement } from './index'

export interface BoardState {
  boardWidth: number
  boardHeight: number
  background: Background
  mode: EditorMode
  gridId: string | null
  gridGap: number
  gridRadius: number
  gridMargin?: number
  frame: Frame
  elements: CanvasElement[]
}

/**
 * Why the board can't become a template, if it can't: a template is a layout
 * waiting for photos, so it needs one. A drawn layout lives in localStorage
 * under an id that can be edited, evicted or deleted, and a template holding
 * only that id would later apply as no layout at all.
 */
export function templateBlocker(
  s: Pick<BoardState, 'mode' | 'gridId'>,
): 'needsLayout' | 'customLayout' | null {
  if (s.mode !== 'grid' || !s.gridId) return 'needsLayout'
  if (!getGridById(s.gridId)) return 'customLayout'
  return null
}

/** The current board as a template: its layout, background, frame and words, without the photos. */
export function templateFromBoard(s: BoardState): TemplateDocument | undefined {
  if (templateBlocker(s) || !s.gridId) return undefined
  // A photo background is an object URL into this session, gone after a reload; keep its colour instead.
  const { photoSrc: _src, photoId: _id, ...rest } = s.background
  const background: Partial<Background> = rest.type === 'photo' ? { ...rest, type: 'solid' } : rest
  const elements = s.elements
    .filter(
      (e): e is Extract<CanvasElement, TemplateElement> =>
        e.type === 'text' || e.type === 'sticker',
    )
    .filter((e) => !e.hidden)
    .map(({ id: _drop, groupId: _group, ...e }) => e as TemplateElement)
  return {
    boardWidth: s.boardWidth,
    boardHeight: s.boardHeight,
    background,
    gridId: s.gridId,
    gridGap: s.gridGap,
    gridRadius: s.gridRadius,
    gridMargin: s.gridMargin ?? 0,
    frame: s.frame,
    elements,
  }
}
