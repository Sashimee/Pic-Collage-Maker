import { useEffect, useRef } from 'react'
import { m, AnimatePresence } from './motion'
import { ChevronDown } from 'lucide-react'
import { useScrollOverflow } from '../hooks/useScrollOverflow'
import type { ReactNode } from 'react'

interface ActionSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function ActionSheet({ open, onClose, title, children }: ActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  // `open` is a dep because the scroller only exists while the sheet is
  // mounted — the first measurement has to wait for that.
  const {
    ref: bodyRef,
    canScrollStart: canScrollUp,
    canScrollEnd: canScrollDown,
  } = useScrollOverflow<HTMLDivElement>('y', [open])

  // Close on escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end">
            <m.div
              ref={sheetRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full rounded-t-2xl border-t border-border bg-surface shadow-[0_-8px_32px_rgba(0,0,0,0.25)]"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1" onClick={onClose} aria-hidden="true">
                <div className="h-1.5 w-10 rounded-full bg-muted/40" />
              </div>

              {title && (
                <h3 className="px-4 pb-2 pt-1 text-center text-sm font-semibold text-muted">
                  {title}
                </h3>
              )}

              {/* The fades must be siblings of the scroller, not children of
                  it: an absolutely positioned child of an overflow container is
                  laid out against the *content* box and scrolls away with it. */}
              <div className="relative">
                <div ref={bodyRef} className="max-h-[80vh] overflow-y-auto px-2 pb-4">
                  {children}
                </div>
                {canScrollUp && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-surface to-transparent" />
                )}
                {canScrollDown && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-9 items-end justify-center bg-gradient-to-t from-surface to-transparent">
                    {!canScrollUp && (
                      <ChevronDown
                        size={16}
                        className="mb-0.5 animate-bounce text-muted"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )}
              </div>
            </m.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function ActionItem({
  onClick,
  icon,
  label,
  danger,
  disabled,
  active,
}: {
  onClick?: () => void
  icon: ReactNode
  label: string
  danger?: boolean
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition active:scale-[0.98] ${
        disabled
          ? 'cursor-not-allowed opacity-40'
          : danger
            ? 'text-rose-500 hover:bg-rose-500/10'
            : active
              ? 'bg-accent/15 text-accent'
              : 'text-text hover:bg-surface-3'
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted ${active ? 'bg-accent/20' : 'bg-surface-3'}`}>
        {icon}
      </span>
      {label}
    </button>
  )
}

export function ActionDivider() {
  return <div className="mx-3 my-1 h-px bg-border" />
}

export function ActionCancel({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-surface-2 text-sm font-semibold text-text transition hover:bg-surface-3 active:scale-[0.98]"
    >
      {label}
    </button>
  )
}
