import type { ReactNode } from 'react'
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
} from 'lucide-react'
import { useEditor } from '../store/editorStore'
import type { BaseElement } from '../types'
import { useT } from '../i18n/useLang'
import { m, AnimatePresence } from './motion'
import { useToasts } from './ToastContainer'

// Floating contextual actions for the currently selected element.
export function SelectionBar() {
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

  const el = selected()
  const isGridPhoto = mode === 'grid' && el?.type === 'photo'
  const isFreePhoto = mode === 'free' && el?.type === 'photo'
  const hasMulti = multiSelected.length > 1

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

  const handleRemoveBg = async () => {
    if (el?.type !== 'photo' || !selectedId) return
    toast.info(t('toast.removingBg'))
    try {
      const { removeBackground } = await import('../ai/bgRemoval')
      const result = await removeBackground(el.src)
      updateElement(selectedId, { src: result })
      toast.success(t('toast.bgRemoved'))
    } catch {
      toast.error(t('toast.bgRemovalFailed'))
    }
  }

  const handleRetouch = async () => {
    if (el?.type !== 'photo' || !selectedId) return
    toast.info(t('toast.retouching'))
    try {
      const { portraitRetouch } = await import('../ai/portraitRetouch')
      const result = await portraitRetouch(el.src, { skinSmooth: 0.3, teethWhite: 0.2, eyeBrighten: 0.4 })
      updateElement(selectedId, { src: result })
      toast.success(t('toast.retouched'))
    } catch {
      toast.error(t('toast.retouchFailed'))
    }
  }

  const handleEnhance = async () => {
    if (el?.type !== 'photo' || !selectedId) return
    toast.info(t('toast.enhancing'))
    try {
      const { autoEnhance } = await import('../ai/autoEnhance')
      const result = await autoEnhance(el.src)
      updateElement(selectedId, { src: result })
      toast.success(t('toast.enhanced'))
    } catch {
      toast.error(t('toast.enhanceFailed'))
    }
  }

  const Btn = ({
    onClick,
    children,
    label,
    danger,
  }: {
    onClick: () => void
    children: ReactNode
    label?: string
    danger?: boolean
  }) => (
    <m.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 sm:h-11 sm:w-11 items-center justify-center rounded-full shadow-lg backdrop-blur transition ${
        danger
          ? 'bg-danger/90 text-white'
          : 'bg-surface-2/90 text-text hover:bg-surface-3'
      }`}
    >
      {children}
    </m.button>
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
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              className="pointer-events-auto flex max-w-full flex-wrap justify-center gap-2 rounded-full bg-surface/80 p-1.5 shadow-xl ring-1 ring-border backdrop-blur sm:flex-nowrap"
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
              {isFreePhoto && (
                <Btn onClick={() => setCropping(selectedId)} label={t('sel.cropShape')}>
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
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
