import { useState, type ReactNode } from 'react'
import {
  Copy,
  SendToBack,
  BringToFront,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Crop,
  Group,
  X,
  Wand2,
  Scissors,
  Sparkles,
  Zap,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceBetween,
  AlignVerticalSpaceBetween,
  AlignVerticalJustifyCenter,
  Paintbrush,
  PaintRoller,
} from 'lucide-react'
import { useEditor } from '../store/editorStore'
import type { BaseElement } from '../types'
import { useT } from '../i18n/useLang'
import { m, AnimatePresence, SPRING } from './motion'
import { useToasts } from './ToastContainer'
import { alignOffsets, unionBox, type AlignOp, type Box } from '../lib/align'

const ALIGN_ACTIONS: { op: AlignOp; icon: ReactNode; label: string }[] = [
  { op: 'left', icon: <AlignStartVertical size={18} />, label: 'align.left' },
  { op: 'centerX', icon: <AlignCenterVertical size={18} />, label: 'align.centerX' },
  { op: 'right', icon: <AlignEndVertical size={18} />, label: 'align.right' },
  { op: 'top', icon: <AlignStartHorizontal size={18} />, label: 'align.top' },
  { op: 'centerY', icon: <AlignCenterHorizontal size={18} />, label: 'align.centerY' },
  { op: 'bottom', icon: <AlignEndHorizontal size={18} />, label: 'align.bottom' },
  {
    op: 'distributeX',
    icon: <AlignHorizontalSpaceBetween size={18} />,
    label: 'align.distributeX',
  },
  { op: 'distributeY', icon: <AlignVerticalSpaceBetween size={18} />, label: 'align.distributeY' },
]

// Module-level so it keeps its DOM node, and with it keyboard focus, across
// re-renders: the align row is pressed several times in a row.
function Btn({
  onClick,
  children,
  label,
  danger,
  expanded,
  controls,
}: {
  onClick: () => void
  children: ReactNode
  label?: string
  danger?: boolean
  expanded?: boolean
  controls?: string
}) {
  return (
    <m.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      title={label}
      className={`flex h-12 w-12 sm:h-11 sm:w-11 items-center justify-center rounded-full shadow-lg backdrop-blur transition ${
        danger
          ? 'bg-danger/90 text-white'
          : expanded
            ? 'bg-accent text-accent-fg'
            : 'bg-surface-2/90 text-text hover:bg-surface-3'
      }`}
    >
      {children}
    </m.button>
  )
}

interface SelectionBarProps {
  /** Drawn bounds of elements in board units, from the live canvas. */
  measure: (ids: string[]) => Record<string, Box>
}

// Floating contextual actions for the currently selected element.
export function SelectionBar({ measure }: SelectionBarProps) {
  const t = useT()
  const toast = useToasts()
  const selectedId = useEditor((s) => s.selectedId)
  const multiSelected = useEditor((s) => s.multiSelected)
  const mode = useEditor((s) => s.mode)
  const selected = useEditor((s) => s.selected)
  const remove = useEditor((s) => s.removeElement)
  const duplicate = useEditor((s) => s.duplicateElement)
  const forward = useEditor((s) => s.bringForward)
  const backward = useEditor((s) => s.sendBackward)
  const updateElement = useEditor((s) => s.updateElement)
  const setCropping = useEditor((s) => s.setCropping)
  const groupElements = useEditor((s) => s.groupElements)
  const clearMultiSelect = useEditor((s) => s.clearMultiSelect)
  const updateElements = useEditor((s) => s.updateElements)
  const copyStyle = useEditor((s) => s.copyStyle)
  const pasteStyle = useEditor((s) => s.pasteStyle)
  const hasCopiedStyle = useEditor((s) => s.copiedStyle !== null)
  const elements = useEditor((s) => s.elements)
  const boardWidth = useEditor((s) => s.boardWidth)
  const boardHeight = useEditor((s) => s.boardHeight)
  const [aligning, setAligning] = useState(false)
  const [alignToBoard, setAlignToBoard] = useState(false)
  const [lastSelectedId, setLastSelectedId] = useState(selectedId)
  if (selectedId !== lastSelectedId) {
    setLastSelectedId(selectedId)
    if (!selectedId) {
      setAligning(false)
      setAlignToBoard(false)
    }
  }

  const el = selected()
  const isGridPhoto = mode === 'grid' && el?.type === 'photo'
  const isFreePhoto = mode === 'free' && el?.type === 'photo'
  const hasMulti = multiSelected.length > 1
  const alignIds = (hasMulti ? multiSelected : selectedId ? [selectedId] : []).filter((id) => {
    const e = elements.find((x) => x.id === id)
    return e && !e.locked && !e.hidden && !(mode === 'grid' && e.type === 'photo')
  })

  const align = (op: AlignOp) => {
    const boxes = measure(alignIds)
    const board = { x: 0, y: 0, width: boardWidth, height: boardHeight }
    const ref = alignIds.length === 1 || alignToBoard ? board : unionBox(Object.values(boxes))
    if (!ref) return
    const offsets = alignOffsets(boxes, op, ref)
    const patches = Object.fromEntries(
      elements.flatMap((e) => {
        const o = offsets[e.id]
        return o && (o.dx || o.dy) ? [[e.id, { x: e.x + o.dx, y: e.y + o.dy }]] : []
      }),
    )
    if (Object.keys(patches).length) updateElements(patches)
  }

  const stepZoom = (delta: number) => {
    if (el?.type !== 'photo') return
    const next = Math.max(1, Math.min(4, (el.cellZoom ?? 1) + delta))
    updateElement(el.id, { cellZoom: next })
  }
  const resetCell = () =>
    el?.type === 'photo' &&
    updateElement(el.id, { cellZoom: 1, cellPan: { x: 0, y: 0 } })

  const handleSmartCrop = async () => {
    if (el?.type !== 'photo' || !selectedId) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = el.src
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
    })
    try {
      const { detectFaces, computeSmartCrop } = await import('../ai/faceDetection')
      const faces = await detectFaces(el.src)
      const crop = computeSmartCrop(
        faces,
        img.naturalWidth,
        img.naturalHeight,
        el.width / el.height,
      )
      updateElement(selectedId, { crop })
      if (faces.length === 0) {
        toast.info(t('sel.smartCropFail'))
      }
    } catch {
      toast.error(t('toast.smartCropFailed'))
    }
  }

  /** Stays up while the tool works; Cancel throws the result away rather than applying it. */
  const runTool = async (
    keys: { busy: string; done: string; failed: string },
    run: (src: string) => Promise<string>,
  ) => {
    if (el?.type !== 'photo' || !selectedId) return
    const id = selectedId
    let cancelled = false
    const progress = toast.progress(t(keys.busy), {
      label: t('menu.cancel'),
      onClick: () => {
        cancelled = true
        progress.done()
      },
    })
    try {
      const result = await run(el.src)
      if (cancelled) return
      updateElement(id, { src: result })
      toast.success(t(keys.done))
    } catch {
      if (!cancelled) toast.error(t(keys.failed))
    } finally {
      progress.done()
    }
  }

  const handleRemoveBg = () =>
    runTool(
      { busy: 'toast.removingBg', done: 'toast.bgRemoved', failed: 'toast.bgRemovalFailed' },
      async (src) => (await import('../ai/tools')).removeBackground(src),
    )

  const handleRetouch = () =>
    runTool(
      { busy: 'toast.retouching', done: 'toast.retouched', failed: 'toast.retouchFailed' },
      async (src) =>
        (await import('../ai/tools')).portraitRetouch(src, {
          skinSmooth: 0.3,
          teethWhite: 0.2,
          eyeBrighten: 0.4,
        }),
    )

  const handleEnhance = () =>
    runTool(
      { busy: 'toast.enhancing', done: 'toast.enhanced', failed: 'toast.enhanceFailed' },
      async (src) => (await import('../ai/tools')).autoEnhance(src),
    )

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-2 z-20">
      <AnimatePresence>
        {selectedId && (
          <>
            {/* Subtle backdrop so bar stands out from canvas */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/20 to-transparent sm:hidden"
            />

            {/* Opacity + Blend controls */}
            {mode === 'free' && (
              <m.div
                key="blend"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-full bg-surface/80 px-3 py-1.5 shadow-xl ring-1 ring-border backdrop-blur"
              >
                <label className="text-xs text-muted">{t('common.opacity')}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={el?.opacity ?? 1}
                  onChange={(e) =>
                    selectedId &&
                    updateElement(selectedId, { opacity: parseFloat(e.target.value) })
                  }
                  className="w-24 accent-accent"
                />
                <select
                  value={el?.blendMode ?? 'normal'}
                  onChange={(e) =>
                    selectedId &&
                    updateElement(selectedId, { blendMode: e.target.value as BaseElement['blendMode'] })
                  }
                  className="min-h-[44px] rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text outline-none"
                >
                  <option value="normal">{t('blend.normal')}</option>
                  <option value="multiply">{t('blend.multiply')}</option>
                  <option value="screen">{t('blend.screen')}</option>
                  <option value="overlay">{t('blend.overlay')}</option>
                  <option value="darken">{t('blend.darken')}</option>
                  <option value="lighten">{t('blend.lighten')}</option>
                </select>
              </m.div>
            )}

            {/* Multi-select indicator + group controls */}
            {hasMulti && (
              <m.div
                key="multisel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-accent/90 px-3 py-1.5 shadow-xl ring-1 ring-accent backdrop-blur"
              >
                <span className="text-xs font-medium text-white">
                  {multiSelected.length} {t('sel.selected')}
                </span>
                <button
                  onClick={() => groupElements(multiSelected)}
                  className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-xs text-white transition hover:bg-white/30"
                >
                  <Group size={14} /> {t('sel.group')}
                </button>
                <button
                  onClick={clearMultiSelect}
                  className="rounded-full p-1 text-white/70 transition hover:bg-white/20 hover:text-white"
                >
                  <X size={14} />
                </button>
              </m.div>
            )}

            <m.div
              key="selbar"
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.9 }}
              transition={SPRING.pop}
              className="order-2 pointer-events-auto flex max-w-full flex-wrap justify-center gap-2 rounded-full bg-surface/80 p-1.5 shadow-xl ring-1 ring-border backdrop-blur sm:flex-nowrap"
            >
              {mode === 'free' && (
                <>
                  <Btn onClick={() => duplicate(selectedId)} label={t('sel.duplicate')}>
                    <Copy size={18} />
                  </Btn>
                  <Btn onClick={() => backward(selectedId)} label={t('sel.backward')}>
                    <SendToBack size={18} />
                  </Btn>
                  <Btn onClick={() => forward(selectedId)} label={t('sel.forward')}>
                    <BringToFront size={18} />
                  </Btn>
                </>
              )}
              <Btn
                onClick={() => {
                  copyStyle(selectedId)
                  toast.success(t('style.copied'))
                }}
                label={t('style.copy')}
              >
                <Paintbrush size={18} />
              </Btn>
              {hasCopiedStyle && (
                <Btn
                  onClick={() => {
                    pasteStyle(hasMulti ? multiSelected : [selectedId])
                    toast.success(t('style.pasted'))
                  }}
                  label={t('style.paste')}
                >
                  <PaintRoller size={18} />
                </Btn>
              )}
              {alignIds.length > 0 && (
                <Btn
                  onClick={() => setAligning((v) => !v)}
                  label={t('sel.align')}
                  expanded={aligning}
                  controls="align-row"
                >
                  <AlignVerticalJustifyCenter size={18} />
                </Btn>
              )}
              {(isFreePhoto || isGridPhoto) && (
                <Btn
                  onClick={() => setCropping(selectedId)}
                  label={t(isGridPhoto ? 'filter.crop' : 'sel.cropShape')}
                >
                  <Crop size={18} />
                </Btn>
              )}
              {(isFreePhoto || isGridPhoto) && (
                <Btn onClick={handleSmartCrop} label={t('sel.smartCrop')}>
                  <Wand2 size={18} />
                </Btn>
              )}
              {(isFreePhoto || isGridPhoto) && (
                <>
                  <Btn onClick={handleRemoveBg} label={t('sel.removeBg')}>
                    <Scissors size={18} />
                  </Btn>
                  <Btn onClick={handleRetouch} label={t('sel.retouch')}>
                    <Sparkles size={18} />
                  </Btn>
                  <Btn onClick={handleEnhance} label={t('sel.enhance')}>
                    <Zap size={18} />
                  </Btn>
                </>
              )}
              {isGridPhoto && (
                <>
                  <Btn onClick={() => stepZoom(-0.2)} label={t('cell.zoomOut')}>
                    <ZoomOut size={18} />
                  </Btn>
                  <Btn onClick={() => stepZoom(0.2)} label={t('cell.zoomIn')}>
                    <ZoomIn size={18} />
                  </Btn>
                  <Btn onClick={resetCell} label={t('cell.reset')}>
                    <RotateCcw size={18} />
                  </Btn>
                </>
              )}
              <Btn onClick={() => remove(selectedId)} label={t('sel.delete')} danger>
                <Trash2 size={18} />
              </Btn>
            </m.div>

            {aligning && alignIds.length > 0 && (
              <m.div
                key="align"
                id="align-row"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                role="group"
                aria-label={t('sel.align')}
                className="order-1 pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-3xl bg-surface/80 p-1.5 shadow-xl ring-1 ring-border backdrop-blur"
              >
                {ALIGN_ACTIONS.filter(
                  (a) => alignIds.length >= 3 || !a.op.startsWith('distribute'),
                ).map((a) => (
                  <Btn key={a.op} onClick={() => align(a.op)} label={t(a.label)}>
                    {a.icon}
                  </Btn>
                ))}
                {alignIds.length > 1 && (
                  <button
                    onClick={() => setAlignToBoard((v) => !v)}
                    aria-pressed={alignToBoard}
                    className={`min-h-[44px] rounded-full px-3 text-xs font-medium transition ${
                      alignToBoard
                        ? 'bg-accent font-semibold text-accent-fg'
                        : 'bg-surface-2/90 text-text ring-1 ring-border hover:bg-surface-3'
                    }`}
                  >
                    {t('align.toBoard')}
                  </button>
                )}
              </m.div>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
