import { useRef, useState, useCallback, useEffect } from 'react'
import type { GridLayout } from '../types'
import { useT } from '../i18n/useLang'
import { m, AnimatePresence, SPRING } from './motion'
import { Plus, Images, SkipForward, Check, X } from 'lucide-react'
import { useIsDesktop } from '../hooks/useMediaQuery'

export function PhotoAssignmentSheet({
  layout,
  open,
  onClose,
  onAssign,
  onSkip,
  onDone,
}: {
  layout: GridLayout
  open: boolean
  onClose: () => void
  onAssign: (files: File[]) => void
  onSkip: () => void
  onDone?: () => void
}) {
  const t = useT()
  const [previews, setPreviews] = useState<(string | null)[]>(
    () => new Array(layout.cells.length).fill(null),
  )
  const multiInputRef = useRef<HTMLInputElement>(null)
  const isDesktop = useIsDesktop()

  // Reset previews when layout changes or sheet opens
  useEffect(() => {
    setPreviews(new Array(layout.cells.length).fill(null))
  }, [open, layout.id, layout.cells.length])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0]
        const reader = new FileReader()
        reader.onload = () => {
          setPreviews((prev) => {
            const next = [...prev]
            next[index] = reader.result as string
            return next
          })
          onAssign([file])
        }
        reader.readAsDataURL(file)
      }
      e.currentTarget.value = ''
    },
    [onAssign],
  )

  const handleMultiChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files)
        const readers = files.map(
          (file) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(file)
            }),
        )
        Promise.all(readers).then((urls) => {
          setPreviews((prev) => {
            const next = [...prev]
            urls.forEach((url, i) => {
              const slot = next.findIndex((p) => p === null)
              if (slot !== -1) next[slot] = url
              else if (i < next.length) next[i] = url
            })
            return next
          })
          onAssign(files)
        })
      }
      e.currentTarget.value = ''
    },
    [onAssign],
  )

  const handleSlotClick = (index: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => handleFileChange(e as unknown as React.ChangeEvent<HTMLInputElement>, index)
    input.click()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <m.div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <m.div
            className={`fixed z-[70] flex flex-col bg-surface shadow-card max-h-[90vh] ${
              isDesktop
                ? 'right-0 top-0 h-full w-80 border-l border-border'
                : 'bottom-0 left-0 right-0 rounded-t-3xl border-t border-border'
            }`}
            initial={
              isDesktop
                ? { x: '100%', y: 0, opacity: 0.8 }
                : { x: 0, y: '100%', opacity: 0.8 }
            }
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={
              isDesktop
                ? { x: '100%', y: 0, opacity: 0.8 }
                : { x: 0, y: '100%', opacity: 0.8 }
            }
            transition={SPRING.sheet}
            drag={isDesktop ? undefined : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.4 }}
            onDragEnd={(_e, info) => {
              if (!isDesktop && (info.offset.y > 80 || info.velocity.y > 500)) {
                onClose()
              }
            }}
          >
            {/* Handle (mobile only) */}
            {!isDesktop && (
              <div className="flex cursor-grab touch-none flex-col items-center pt-2.5 active:cursor-grabbing">
                <span className="h-1.5 w-11 rounded-full bg-surface-3" />
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <div>
                <h2 className="text-sm font-semibold text-text">
                  {t('assignment.title')}
                </h2>
                <p className="text-xs text-muted">
                  {t('assignment.subtitle')}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-text"
                aria-label={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            {/* Slot grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-2">
              <div className="grid grid-cols-3 gap-2.5">
                {layout.cells.map((_, i) => (
                  <m.button
                    key={i}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleSlotClick(i)}
                    className={`relative flex aspect-[3/4] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${
                      previews[i]
                        ? 'border-transparent'
                        : 'border-surface-3 hover:border-accent/50'
                    }`}
                  >
                    {previews[i] ? (
                      <img
                        src={previews[i]!}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        <Plus
                          size={24}
                          strokeWidth={2.5}
                          className="text-muted"
                        />
                        <span className="mt-1 text-[0.6rem] font-medium text-muted">
                          Slot {i + 1}
                        </span>
                      </>
                    )}
                  </m.button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
              <input
                ref={multiInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={handleMultiChange}
              />
              <m.button
                whileTap={{ scale: 0.96 }}
                onClick={() => multiInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 py-2.5 text-sm font-semibold text-text transition hover:bg-surface-3"
              >
                <Images size={16} strokeWidth={2.5} />
                {t('assignment.autoFill')}
              </m.button>
              <div className="flex gap-2">
                <m.button
                  whileTap={{ scale: 0.96 }}
                  onClick={onSkip}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-2"
                >
                  <SkipForward size={16} strokeWidth={2.5} />
                  {t('assignment.skip')}
                </m.button>
                <m.button
                  whileTap={{ scale: 0.96 }}
                  onClick={onDone || onClose}
                  className="bg-grad-accent flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-accent transition hover:brightness-110"
                >
                  <Check size={16} strokeWidth={2.5} />
                  {t('assignment.done')}
                </m.button>
              </div>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
