import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import { useEditor } from '../../store/editorStore'

export type ViewTransform = { x: number; y: number; scale: number }

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))

/**
 * The board's on-screen placement: fitted into the space the floating chrome
 * and any open panel leave free, then zoomed by wheel, pinch or ZoomControls.
 */
export function useViewTransform(hostRef: RefObject<HTMLDivElement | null>, bottomInset: number) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [tf, setTf] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 })

  const boardWidth = useEditor((s) => s.boardWidth)
  const boardHeight = useEditor((s) => s.boardHeight)
  const mode = useEditor((s) => s.mode)
  const canvasZoom = useEditor((s) => s.canvasZoom)
  const setCanvasZoom = useEditor((s) => s.setCanvasZoom)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const ro = new ResizeObserver(() => {
      setSize({ w: host.clientWidth, h: host.clientHeight })
    })
    ro.observe(host)
    setSize({ w: host.clientWidth, h: host.clientHeight })
    return () => ro.disconnect()
  }, [hostRef])

  // Floating chrome sits *over* the stage, so the board has to be fitted into
  // what's left rather than into the whole host box — otherwise the toolbar and
  // the selection/zoom controls cover the top and bottom of the board.
  const base =
    mode === 'custom-layout'
      ? { top: 60, bottom: 120, left: 8, right: 8 } // tool bar / hint + demo + padding row
      : { top: 12, bottom: 60, left: 52, right: 8 } // snap/grid column + controls
  // An open panel sheet overlays the stage without a scrim, so it eats into the
  // same space the floating chrome does. Cap it so a tall sheet can't squeeze
  // the board down to nothing.
  const panelInset = clamp(bottomInset, 0, 0.6) * size.h
  const chromeInsets = { ...base, bottom: Math.max(base.bottom, panelInset) }

  /** Centre of the area the board is actually fitted into, in stage pixels. */
  const viewportCentre = () => ({
    x: chromeInsets.left + (size.w - chromeInsets.left - chromeInsets.right) / 2,
    y: chromeInsets.top + (size.h - chromeInsets.top - chromeInsets.bottom) / 2,
  })

  const fitToScreen = () => {
    if (!size.w || !size.h) return
    const availW = Math.max(1, size.w - chromeInsets.left - chromeInsets.right)
    const availH = Math.max(1, size.h - chromeInsets.top - chromeInsets.bottom)
    const scale = Math.min(availW / boardWidth, availH / boardHeight)
    setTf({
      x: chromeInsets.left + (availW - boardWidth * scale) / 2,
      y: chromeInsets.top + (availH - boardHeight * scale) / 2,
      scale,
    })
    // Let the zoom floor down to the fit when the fit needs it. Otherwise
    // setCanvasZoom clamps at 0.25, the sync effect writes that back over the
    // scale just computed, and the board spills out from under the chrome —
    // which is what a phone with a panel open does once the strip is there.
    useEditor.getState().setMinCanvasZoom(scale)
    // Keep the store's zoom in step, or the first ZoomControls press jumps.
    setCanvasZoom(scale)
  }

  // Re-fit when the viewport, the board or the on-canvas chrome changes.
  useEffect(fitToScreen, [size.w, size.h, boardWidth, boardHeight, mode, bottomInset])

  // Sync local zoom with store zoom (so ZoomControls works). Rewriting `scale`
  // alone would leave the pan offsets computed for the old scale, so zoom about
  // a fixed point — and that point has to be the centre of the *usable* area,
  // the same box fitToScreen centres the board in. Using the raw viewport
  // centre anchors the zoom somewhere the board isn't centred on, so every
  // press of +/− walked the board further off-centre. The offset is small in
  // free mode and nearly half the height with a panel open.
  useEffect(() => {
    setTf((prev) => {
      if (Math.abs(prev.scale - canvasZoom) < 1e-6) return prev
      const { x: cx, y: cy } = viewportCentre()
      const pointTo = { x: (cx - prev.x) / prev.scale, y: (cy - prev.y) / prev.scale }
      return {
        scale: canvasZoom,
        x: cx - pointTo.x * canvasZoom,
        y: cy - pointTo.y * canvasZoom,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasZoom, size.w, size.h, chromeInsets.top, chromeInsets.bottom, chromeInsets.left, chromeInsets.right])

  const zoomAtPoint = (px: number, py: number, factor: number) => {
    setTf((prev) => {
      const newScale = clamp(prev.scale * factor, useEditor.getState().minCanvasZoom, 4)
      const pointTo = { x: (px - prev.x) / prev.scale, y: (py - prev.y) / prev.scale }
      const next = {
        scale: newScale,
        x: px - pointTo.x * newScale,
        y: py - pointTo.y * newScale,
      }
      setCanvasZoom(newScale)
      return next
    })
  }

  return { size, tf, setTf, zoomAtPoint }
}
