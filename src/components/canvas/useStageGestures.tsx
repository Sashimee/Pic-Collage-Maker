import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import Konva from 'konva'
import { useEditor } from '../../store/editorStore'
import { useT } from '../../i18n/useLang'
import { hasSeen, markSeen } from '../../lib/firstUse'
import { useToasts } from '../ToastContainer'
import { PinchDemo } from '../GestureDemo'
import { clamp, type ViewTransform } from './useViewTransform'
import { snapAngle, twoFingerPlacement, type FingerPair, type Placement } from '../../lib/twoFinger'

interface Options {
  stageRef: RefObject<Konva.Stage | null>
  tf: ViewTransform
  setTf: Dispatch<SetStateAction<ViewTransform>>
  zoomAtPoint: (px: number, py: number, factor: number) => void
  onBackgroundPress: () => void
}

/**
 * Stage-level pointer handling: wheel and two-finger pinch zoom (or per-cell
 * zoom on a selected grid photo, or pinch-and-twist on a selected free
 * element), freehand drawing, and tap-to-deselect.
 */
export function useStageGestures({ stageRef, tf, setTf, zoomAtPoint, onBackgroundPress }: Options) {
  const t = useT()
  const toast = useToasts()
  const elements = useEditor((s) => s.elements)
  const mode = useEditor((s) => s.mode)
  const selectedId = useEditor((s) => s.selectedId)
  const select = useEditor((s) => s.select)
  const clearMultiSelect = useEditor((s) => s.clearMultiSelect)
  const updateElement = useEditor((s) => s.updateElement)
  const setCanvasZoom = useEditor((s) => s.setCanvasZoom)
  const tool = useEditor((s) => s.tool)
  const brushColor = useEditor((s) => s.brushColor)
  const brushSize = useEditor((s) => s.brushSize)
  const addDrawing = useEditor((s) => s.addDrawing)

  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null)
  const twist = useRef<{
    id: string
    start: Placement
    from: FingerPair
    snapped: number | null
    placement: Placement | null
  } | null>(null)
  const pinchHintShown = useRef(false)
  const pendingTouchPress = useRef<Konva.KonvaEventObject<TouchEvent> | null>(null)
  const drawMode = tool === 'draw'
  const drawing = useRef(false)
  const ptsRef = useRef<number[]>([])
  const [, setTick] = useState(0)

  // Pinch-to-zoom hint (one-time), now on the shared first-use registry.
  useEffect(() => {
    pinchHintShown.current = hasSeen('pinch')
  }, [])

  const showPinchHint = () => {
    if (pinchHintShown.current) return
    pinchHintShown.current = true
    markSeen('pinch')
    toast.rich(
      <span className="flex items-center gap-2.5">
        <span className="h-9 w-9 shrink-0 text-text/70" data-gesture-demo="pinch">
          <PinchDemo />
        </span>
        <span>{t('canvas.pinchZoom')}</span>
      </span>,
    )
  }

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    showPinchHint()
    e.evt.preventDefault()
    const stage = stageRef.current
    const p = stage?.getPointerPosition()
    if (!p) return
    zoomAtPoint(p.x, p.y, e.evt.deltaY > 0 ? 1 / 1.06 : 1.06)
  }

  const localPoint = (t: Touch) => {
    const rect = stageRef.current?.container().getBoundingClientRect()
    return { x: t.clientX - (rect?.left ?? 0), y: t.clientY - (rect?.top ?? 0) }
  }

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches
    if (touches.length !== 2) return
    e.evt.preventDefault()
    e.evt.stopPropagation()
    const p1 = localPoint(touches[0])
    const p2 = localPoint(touches[1])
    const sel = elements.find((el) => el.id === selectedId)
    if (sel && !sel.locked && !sel.hidden && (mode !== 'grid' || sel.type !== 'photo')) {
      twistElement(sel.id, { a: toBoard(p1.x, p1.y), b: toBoard(p2.x, p2.y) })
      return
    }
    showPinchHint()
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
    const cx = (p1.x + p2.x) / 2
    const cy = (p1.y + p2.y) / 2
    const prev = pinch.current
    if (prev) {
      const factor = clamp(dist / prev.dist, 0.5, 2)
      if (mode === 'grid' && sel?.type === 'photo') {
        const newZoom = clamp((sel.cellZoom ?? 1) * factor, 1, 4)
        updateElement(sel.id, { cellZoom: newZoom })
      } else {
        setTf((t) => {
          const newScale = clamp(t.scale * factor, useEditor.getState().minCanvasZoom, 4)
          const pointTo = { x: (cx - t.x) / t.scale, y: (cy - t.y) / t.scale }
          setCanvasZoom(newScale)
          return {
            scale: newScale,
            x: cx - pointTo.x * newScale + (cx - prev.cx),
            y: cy - pointTo.y * newScale + (cy - prev.cy),
          }
        })
      }
    }
    pinch.current = { dist, cx, cy }
  }

  // The node is moved live and the store written once when the fingers lift,
  // as Konva's own drag and Transformer do, so a gesture is one undo step
  // however long it pauses.
  const twistElement = (id: string, fingers: FingerPair) => {
    const node = stageRef.current?.findOne('#' + id)
    if (!node) return
    const g = twist.current
    if (!g || g.id !== id) {
      // A finger on the element arms Konva's drag, and one on a Transformer
      // anchor (easy to hit on a small element) starts a transform. Left alone,
      // either takes over and Konva swallows every stage touchmove after it.
      Konva.DD._dragElements.forEach((d, key) => {
        if (d.dragStatus === 'dragging') d.node.stopDrag()
        else Konva.DD._dragElements.delete(key)
      })
      stageRef.current?.find<Konva.Transformer>('Transformer').forEach((tr) => {
        if (tr.isTransforming()) tr.stopTransform()
      })
      const el = useEditor.getState().elements.find((e) => e.id === id)
      if (!el) return
      const start = { x: el.x, y: el.y, rotation: el.rotation, scaleX: el.scaleX, scaleY: el.scaleY }
      twist.current = { id, start, from: fingers, snapped: snapAngle(start.rotation), placement: null }
      return
    }
    const { snapped, ...placement } = twoFingerPlacement(g.start, g.from, fingers)
    if (snapped !== null && snapped !== g.snapped) navigator.vibrate?.(10)
    g.snapped = snapped
    g.placement = placement
    node.setAttrs(placement)
    node.getLayer()?.batchDraw()
  }

  const endPinch = () => {
    pinch.current = null
    const g = twist.current
    twist.current = null
    if (g?.placement) updateElement(g.id, g.placement)
  }

  const cancelTouch = () => {
    endDraw()
    pinch.current = null
    pendingTouchPress.current = null
    const g = twist.current
    twist.current = null
    if (!g) return
    const node = stageRef.current?.findOne('#' + g.id)
    node?.setAttrs(g.start)
    node?.getLayer()?.batchDraw()
  }

  // Click on empty space / background → clear selection.
  const handlePointerDown = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const target = e.target
    if (target === target.getStage() || target.name() === 'background') {
      select(null)
      onBackgroundPress()
      if (e.evt.shiftKey) {
        // Shift-click on canvas keeps multi-selection
      } else {
        clearMultiSelect()
      }
    }
  }

  const toBoard = (px: number, py: number) => ({
    x: (px - tf.x) / tf.scale,
    y: (py - tf.y) / tf.scale,
  })

  const startDraw = (px: number, py: number) => {
    const p = toBoard(px, py)
    drawing.current = true
    ptsRef.current = [p.x, p.y]
    setTick((t) => t + 1)
  }
  const moveDraw = (px: number, py: number) => {
    if (!drawing.current) return
    const p = toBoard(px, py)
    ptsRef.current = [...ptsRef.current, p.x, p.y]
    setTick((t) => t + 1)
  }
  const endDraw = () => {
    if (!drawing.current) return
    drawing.current = false
    const pts = ptsRef.current
    if (pts.length >= 4) addDrawing(pts, brushColor, brushSize)
    ptsRef.current = []
    setTick((t) => t + 1)
  }

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (drawMode) {
      const p = stageRef.current?.getPointerPosition()
      if (p) startDraw(p.x, p.y)
      return
    }
    handlePointerDown(e)
  }
  const onStageMouseMove = () => {
    if (!drawMode) return
    const p = stageRef.current?.getPointerPosition()
    if (p) moveDraw(p.x, p.y)
  }
  const onStageTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (drawMode && e.evt.touches.length === 1) {
      e.evt.preventDefault()
      const p = localPoint(e.evt.touches[0])
      startDraw(p.x, p.y)
      return
    }
    // Deselecting waits for the finger to lift: if a second one lands first,
    // this was the start of a pinch-and-twist on the selection, not a tap.
    pendingTouchPress.current = e.evt.touches.length === 1 ? e : null
    if (e.evt.touches.length === 2) handleTouchMove(e)
  }
  const onStageTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (drawMode && drawing.current && e.evt.touches.length === 1) {
      e.evt.preventDefault()
      const p = localPoint(e.evt.touches[0])
      moveDraw(p.x, p.y)
      return
    }
    handleTouchMove(e)
  }
  const onStageTouchEnd = (e: Konva.KonvaEventObject<TouchEvent>) => {
    endDraw()
    endPinch()
    if (e.evt.touches.length > 0) return
    const press = pendingTouchPress.current
    pendingTouchPress.current = null
    if (press) handlePointerDown(press)
  }

  return {
    drawMode,
    /** The in-progress stroke in board units, or null when not drawing. */
    liveStroke: drawing.current && ptsRef.current.length >= 2 ? ptsRef.current : null,
    stageHandlers: {
      onWheel: handleWheel,
      onMouseDown: onStageMouseDown,
      onMouseMove: onStageMouseMove,
      onMouseUp: endDraw,
      onTouchStart: onStageTouchStart,
      onTouchMove: onStageTouchMove,
      onTouchEnd: onStageTouchEnd,
      onTouchCancel: cancelTouch,
    },
  }
}
