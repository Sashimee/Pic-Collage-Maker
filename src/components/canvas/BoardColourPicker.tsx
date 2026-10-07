import { useEffect, type RefObject } from 'react'
import { pixelAt, useColours } from '../../lib/palette'

/**
 * The eyedropper for browsers without the EyeDropper API (Safari, Firefox):
 * while armed, the next tap on the canvas reads the pixel under it.
 */
export function BoardColourPicker({ hostRef }: { hostRef: RefObject<HTMLDivElement | null> }) {
  const boardPick = useColours((s) => s.boardPick)
  const endBoardPick = useColours((s) => s.endBoardPick)

  useEffect(() => {
    if (!boardPick) return
    // Capture phase, ahead of useShortcuts: its Escape clears the selection,
    // which unmounts the very colour field the pick was started from.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      endBoardPick()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [boardPick, endBoardPick])

  if (!boardPick) return null
  return (
    <div
      data-testid="board-colour-picker"
      className="absolute inset-0 z-20 cursor-crosshair"
      onPointerDown={(e) => {
        e.preventDefault()
        const canvas = hostRef.current?.querySelector('canvas')
        if (!canvas) throw new Error('Colour picker: no board canvas to pick from')
        const hex = pixelAt(canvas, e.clientX, e.clientY)
        if (!hex) return
        endBoardPick()
        boardPick(hex)
      }}
    />
  )
}
