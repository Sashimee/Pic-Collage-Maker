import { useEffect, useImperativeHandle, type Ref, type RefObject } from 'react'
import type Konva from 'konva'
import { useEditor } from '../../store/editorStore'
import { exportBoard, type ExportFormat } from '../../lib/exportImage'
import type { ViewTransform } from './useViewTransform'
import type { Box } from '../../lib/align'
import { filtersSettled } from '../../lib/filters'

export interface EditorHandle {
  /** Async: the export has to wait a frame for the full-resolution photo
   *  sources to be swapped in before the canvas is snapshotted. */
  exportImage: (format: ExportFormat) => Promise<string | null>
  /** Each element's drawn bounds in board units, rotation included. */
  measure: (ids: string[]) => Record<string, Box>
}

/** Two rAFs: one for React to commit, one for Konva to redraw. */
const nextFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )

export function useExportHandle(
  ref: Ref<EditorHandle>,
  hostRef: RefObject<HTMLDivElement | null>,
  boardRef: RefObject<Konva.Group | null>,
  tf: ViewTransform,
) {
  const boardWidth = useEditor((s) => s.boardWidth)
  const boardHeight = useEditor((s) => s.boardHeight)

  // Dev-only test seam, alongside `window.__editor` in editorStore. The board
  // occupies only part of the canvas, and by a different fraction on every
  // viewport, so e2e gestures need its real on-screen rect to aim at it.
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return
    ;(window as unknown as { __boardRect?: () => DOMRectInit }).__boardRect = () => {
      const host = hostRef.current?.getBoundingClientRect()
      return {
        x: (host?.x ?? 0) + tf.x,
        y: (host?.y ?? 0) + tf.y,
        width: boardWidth * tf.scale,
        height: boardHeight * tf.scale,
      }
    }
  }, [hostRef, tf, boardWidth, boardHeight])

  useImperativeHandle(ref, () => ({
    measure: (ids) => {
      const board = boardRef.current
      if (!board) return {}
      return Object.fromEntries(
        ids.flatMap((id) => {
          const node = board.findOne('#' + id)
          return node ? [[id, node.getClientRect({ relativeTo: board, skipShadow: true })]] : []
        }),
      )
    },
    exportImage: async (format) => {
      const board = boardRef.current
      if (!board) return null

      // `exporting` swaps PhotoNode over to the full-resolution source
      // (CanvasNodes.tsx). It is consumed through a React selector, so setting
      // it and snapshotting in the same tick did nothing at all — React never
      // got to re-render, and every export silently used the 1080px preview
      // while rendering a 2160px canvas. Give React a frame to apply it, and a
      // second for Konva to redraw with the decoded originals.
      useEditor.getState().setExporting(true)
      try {
        // A pack font still loading would be snapshotted as the fallback face,
        // with chips and curves measured for it.
        await document.fonts.ready
        await nextFrame()
        await filtersSettled()
        await nextFrame()
        const state = useEditor.getState()
        return exportBoard(board, boardWidth, boardHeight, format, {
          watermark: state.watermark,
          print: state.print,
        })
      } finally {
        // Never leave the canvas pinned to originals — that is the memory-heavy
        // state, and a throw here would strand it.
        useEditor.getState().setExporting(false)
      }
    },
  }))
}
