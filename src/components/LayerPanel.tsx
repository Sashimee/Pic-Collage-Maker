import { useState, useRef, useCallback, useMemo } from 'react'
import { Eye, EyeOff, Lock, LockOpen, GripVertical } from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { usePointerReorder } from '../hooks/usePointerReorder'
import { useT } from '../i18n/useLang'
import type { CanvasElement } from '../types'

const ROW_HEIGHT = 44
const OVERSCAN = 2
const VIEWPORT_ROWS = 20

function typeIcon(el: CanvasElement): string {
  switch (el.type) {
    case 'photo':
      return '🖼️'
    case 'text':
      return '✏️'
    case 'sticker':
      return el.emoji ?? '🎴'
    case 'drawing':
      return '🎨'
    case 'shape':
      return '🔷'
    case 'group':
      return '📁'
    default:
      return '📄'
  }
}

function previewText(el: CanvasElement): string {
  switch (el.type) {
    case 'photo':
      return 'Photo'
    case 'text': {
      return (el.text ?? '').slice(0, 28) || 'Text'
    }
    case 'sticker':
      return 'Sticker'
    case 'drawing':
      return 'Drawing'
    case 'shape': {
      const st = el.shapeType ?? ''
      return st.charAt(0).toUpperCase() + st.slice(1) || 'Shape'
    }
    case 'group':
      return 'Group'
    default:
      return 'Layer'
  }
}

export default function LayerPanel() {
  const t = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const elements = useEditor((s) => s.elements)
  const selectedId = useEditor((s) => s.selectedId)
  const select = useEditor((s) => s.select)
  const setElementHidden = useEditor((s) => s.setElementHidden)
  const setElementLocked = useEditor((s) => s.setElementLocked)
  const bringForward = useEditor((s) => s.bringForward)
  const sendBackward = useEditor((s) => s.sendBackward)

  // Bottom-to-top display order
  const displayElements = useMemo(() => [...elements].reverse(), [elements])
  const totalHeight = displayElements.length * ROW_HEIGHT

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(
    displayElements.length - 1,
    Math.floor((scrollTop + VIEWPORT_ROWS * ROW_HEIGHT) / ROW_HEIGHT) + OVERSCAN,
  )

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
    }
  }, [])

  const moveTo = useCallback(
    (id: string, toIndex: number) => {
      const fromIndex = displayElements.findIndex((el) => el.id === id)
      const clamped = Math.max(0, Math.min(displayElements.length - 1, toIndex))
      if (fromIndex === -1 || fromIndex === clamped) return

      // The list is rendered top-layer-first (displayElements is reversed), so
      // moving *down* the list means moving *back* in z-order. The previous
      // code had these the other way round, which sent layers the wrong way
      // even on desktop where the drag itself worked.
      const steps = Math.abs(clamped - fromIndex)
      const action = clamped > fromIndex ? sendBackward : bringForward
      for (let i = 0; i < steps; i++) action(id)
    },
    [displayElements, bringForward, sendBackward],
  )

  const { dragIndex, dropIndex, start: startDrag } = usePointerReorder({
    axis: 'y',
    itemSize: ROW_HEIGHT,
    count: displayElements.length,
    scrollerRef: scrollRef,
    onDrop: (from, to) => moveTo(displayElements[from].id, to),
  })

  /**
   * Move the focus with the row. Without this the focused grip belongs to a
   * different layer after one press, so holding ArrowDown walks the list
   * instead of carrying one layer down it.
   */
  const moveByKey = useCallback(
    (index: number, to: number) => {
      const el = displayElements[index]
      if (!el) return
      moveTo(el.id, to)
      const clamped = Math.max(0, Math.min(displayElements.length - 1, to))
      requestAnimationFrame(() => {
        scrollRef.current
          ?.querySelector<HTMLElement>(`[data-drag-handle="${clamped}"]`)
          ?.focus()
      })
    },
    [displayElements, moveTo],
  )

  // Keep dragged element rendered even if it scrolls outside viewport
  const visibleIndices = useMemo(() => {
    const set = new Set<number>()
    for (let i = startIndex; i <= endIndex; i++) set.add(i)
    if (dragIndex !== null) set.add(dragIndex)
    return Array.from(set).sort((a, b) => a - b)
  }, [startIndex, endIndex, dragIndex])

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
          {t('layer.title')}
        </h3>
        <span className="text-[0.65rem] text-muted">{displayElements.length}</span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto no-scrollbar"
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {dropIndex !== null && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-10 h-0.5 rounded-full bg-accent"
              style={{ top: dropIndex * ROW_HEIGHT - 1 }}
              aria-hidden="true"
            />
          )}
          {visibleIndices.map((index) => {
            const el = displayElements[index]
            const top = index * ROW_HEIGHT
            const isSelected = selectedId === el.id
            const hidden = el.hidden ?? false
            const locked = el.locked ?? false
            const isDragging = dragIndex === index

            return (
              <div
                key={el.id}
                className={`absolute left-0 right-0 flex items-center gap-2 rounded-lg border px-2 transition ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-transparent bg-surface-2 hover:bg-surface-3'
                } ${hidden ? 'opacity-50' : 'opacity-100'} ${
                  isDragging ? 'opacity-40' : ''
                }`}
                style={{ top, height: ROW_HEIGHT }}
              >
                {/* touch-none: without it the browser claims the gesture for
                    scrolling and the pointermove stream stops after a few px. */}
                <div
                  data-drag-handle={index}
                  onPointerDown={(e) => startDrag(e, index)}
                  onClick={(e) => e.stopPropagation()}
                  role="button"
                  tabIndex={0}
                  aria-label={t('layer.reorder')}
                  onKeyDown={(e) => {
                    // Keyboard equivalent, and the only route for anyone who
                    // can't drag at all.
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      moveByKey(index, index - 1)
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      moveByKey(index, index + 1)
                    }
                  }}
                  className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
                >
                  <GripVertical size={16} />
                </div>

                <button
                  onClick={() => select(el.id)}
                  aria-pressed={isSelected}
                  className="flex h-full min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="text-base shrink-0 select-none">{typeIcon(el)}</span>
                  <span className="flex-1 truncate text-sm text-text/80 select-none">
                    {previewText(el)}
                  </span>
                </button>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setElementHidden(el.id, !hidden)
                    }}
                    title={hidden ? t('layer.show') : t('layer.hide')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-text/60 transition hover:bg-surface-3 hover:text-text"
                  >
                    {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setElementLocked(el.id, !locked)
                    }}
                    title={locked ? t('layer.unlock') : t('layer.lock')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-text/60 transition hover:bg-surface-3 hover:text-text"
                  >
                    {locked ? <Lock size={14} /> : <LockOpen size={14} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
