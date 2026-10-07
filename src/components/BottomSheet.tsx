import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useT } from '../i18n/useLang'
import { m, AnimatePresence, useDragControls, SPRING } from './motion'

// Mobile editing surface: a draggable bottom sheet with two snap points
// (half / full) plus flick-down-to-dismiss. Drag is initiated from the grab
// handle only (dragListener disabled) so the panel body scrolls normally.
export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const controls = useDragControls()

  const handleDragEnd = (
    _e: unknown,
    info: { offset: { y: number }; velocity: { y: number } },
  ) => {
    const flungDown = info.offset.y > 90 || info.velocity.y > 600
    const flungUp = info.offset.y < -70 || info.velocity.y < -600
    if (flungDown) {
      if (expanded) setExpanded(false)
      else onClose()
    } else if (flungUp) {
      setExpanded(true)
    }
  }

  return (
    <AnimatePresence onExitComplete={() => setExpanded(false)}>
      {open && (
        // No backdrop scrim: the canvas stays interactive so you can select a
        // photo/cell while a panel is open (e.g. to apply filters). Dismiss via
        // the drag handle, the close button, or re-tapping the active tab.
        <m.div
          className="absolute inset-x-0 bottom-0 z-30 flex max-h-full flex-col overflow-hidden rounded-t-3xl border-t border-border bg-surface shadow-sheet"
            style={{ height: expanded ? '86%' : '46%' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING.sheet}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5 active:cursor-grabbing"
              onPointerDown={(e) => controls.start(e)}
            >
              <span className="h-1.5 w-11 rounded-full bg-surface-3" />
              <div className="mt-1.5 flex w-full items-center justify-between px-5 pb-2">
                <h2 className="text-sm font-semibold text-text">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label={t('common.close')}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-text"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-1">
              {children}
            </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
