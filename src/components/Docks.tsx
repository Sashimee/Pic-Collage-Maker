import { useT } from '../i18n/useLang'
import { m, AnimatePresence } from './motion'
import { BottomSheet } from './BottomSheet'
import type { PanelsApi } from './panels.config'
import { useWorkspace } from '../store/workspaceStore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useScrollOverflow } from '../hooks/useScrollOverflow'
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

// ---- Mobile: draggable sheet (overlays canvas) + bottom tab bar ----------

export function MobileSheet({ panels }: { panels: PanelsApi }) {
  const t = useT()
  const { close, current } = panels
  return (
    <BottomSheet
      open={!!current}
      title={current ? t(current.labelKey) : ''}
      onClose={close}
    >
      {current?.panel}
    </BottomSheet>
  )
}

export function MobileTabBar({ panels }: { panels: PanelsApi }) {
  const t = useT()
  const { tabs, active, select } = panels
  const { ref: navRef, canScrollStart: canScrollLeft, canScrollEnd: canScrollRight } = useScrollOverflow<HTMLDivElement>('x')

  const scroll = (dir: 'left' | 'right') => {
    const el = navRef.current
    if (!el) return
    const amount = el.clientWidth * 0.6
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <div className="relative z-10 border-t border-border bg-surface">
      {/* Fade left */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-6 bg-gradient-to-r from-surface to-transparent" />
      )}
      {/* Fade right */}
      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-6 bg-gradient-to-l from-surface to-transparent" />
      )}
      {/* Left arrow */}
      <m.button
        initial={{ opacity: 0 }}
        animate={{ opacity: canScrollLeft ? 1 : 0 }}
        className={`absolute left-1 top-1/2 z-30 -translate-y-1/2 rounded-full bg-surface-2 p-1 shadow-md ${canScrollLeft ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onClick={() => scroll('left')}
        aria-label={t('aria.scrollLeft')}
        aria-hidden={!canScrollLeft}
        tabIndex={canScrollLeft ? 0 : -1}
      >
        <ChevronLeft size={16} />
      </m.button>
      {/* Right arrow */}
      <m.button
        initial={{ opacity: 0 }}
        animate={{ opacity: canScrollRight ? 1 : 0 }}
        className={`absolute right-1 top-1/2 z-30 -translate-y-1/2 rounded-full bg-surface-2 p-1 shadow-md ${canScrollRight ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onClick={() => scroll('right')}
        aria-label={t('aria.scrollRight')}
        aria-hidden={!canScrollRight}
        tabIndex={canScrollRight ? 0 : -1}
      >
        <ChevronRight size={16} />
      </m.button>
      <nav
        ref={navRef}
        className="scroll-x flex items-stretch gap-1 overflow-x-auto px-2 py-1.5 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] no-scrollbar"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => select(tab.id)}
              aria-label={t(tab.labelKey)}
              aria-pressed={isActive}
              className={`relative flex min-w-[4rem] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[0.7rem] font-medium transition active:scale-95 ${
                isActive ? 'text-accent' : 'text-muted hover:text-text'
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                  isActive
                    ? 'bg-grad-accent text-white shadow-[var(--shadow-accent)]'
                    : ''
                }`}
              >
                <tab.Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              {t(tab.labelKey)}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ---- Desktop: vertical tool rail + docked side panel ---------------------

export function ToolRail({ panels }: { panels: PanelsApi }) {
  const t = useT()
  const { tabs, active, select } = panels
  const { ref: navRef, canScrollStart: canScrollUp, canScrollEnd: canScrollDown } = useScrollOverflow<HTMLElement>('y')

  const scroll = (dir: 'up' | 'down') => {
    const el = navRef.current
    if (!el) return
    const amount = el.clientHeight * 0.6
    el.scrollBy({ top: dir === 'up' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <div className="relative flex w-[5.5rem] shrink-0 flex-col border-r border-border bg-surface">
      {/* Fade top */}
      {canScrollUp && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-6 bg-gradient-to-b from-surface to-transparent" />
      )}
      {/* Fade bottom */}
      {canScrollDown && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-6 bg-gradient-to-t from-surface to-transparent" />
      )}
      {/* Up arrow */}
      <m.button
        initial={{ opacity: 0 }}
        animate={{ opacity: canScrollUp ? 1 : 0 }}
        className={`absolute inset-x-0 top-1 z-30 mx-auto w-8 rounded-full bg-surface-2 py-0.5 shadow-md ${canScrollUp ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onClick={() => scroll('up')}
        aria-label={t('aria.scrollUp')}
        aria-hidden={!canScrollUp}
        tabIndex={canScrollUp ? 0 : -1}
      >
        <ChevronUp size={16} className="mx-auto" />
      </m.button>
      {/* Down arrow */}
      <m.button
        initial={{ opacity: 0 }}
        animate={{ opacity: canScrollDown ? 1 : 0 }}
        className={`absolute inset-x-0 bottom-1 z-30 mx-auto w-8 rounded-full bg-surface-2 py-0.5 shadow-md ${canScrollDown ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onClick={() => scroll('down')}
        aria-label={t('aria.scrollDown')}
        aria-hidden={!canScrollDown}
        tabIndex={canScrollDown ? 0 : -1}
      >
        <ChevronDown size={16} className="mx-auto" />
      </m.button>
      <nav
        ref={navRef}
        className="flex flex-col gap-1 overflow-y-auto px-2 py-3 no-scrollbar"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => select(tab.id)}
              aria-label={t(tab.labelKey)}
              aria-pressed={isActive}
              className={`relative flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[0.7rem] font-medium transition active:scale-95 ${
                isActive
                  ? 'text-accent'
                  : 'text-muted hover:bg-surface-2 hover:text-text'
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  isActive
                    ? 'bg-grad-accent text-white shadow-[var(--shadow-accent)]'
                    : ''
                }`}
              >
                <tab.Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              {t(tab.labelKey)}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export function SidePanel({ panels, width }: { panels: PanelsApi; width?: number }) {
  const t = useT()
  const { current } = panels
  const setPanelWidth = useWorkspace((s) => s.setPanelWidth)
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = width ?? 336
    },
    [width],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return
      const delta = startXRef.current - e.clientX
      const nextWidth = Math.max(200, Math.min(600, startWidthRef.current + delta))
      setPanelWidth('side', nextWidth)
    },
    [isResizing, setPanelWidth],
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  return (
    <aside
      className="relative flex shrink-0 flex-col border-l border-border bg-surface"
      style={{ width: width ?? 336 }}
    >
      <AnimatePresence mode="wait">
        {current ? (
          <m.div
            key={current.id}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            <header className="shrink-0 border-b border-border px-5 py-3.5">
              <h2 className="text-grad-accent text-sm font-bold">
                {t(current.labelKey)}
              </h2>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {current.panel}
            </div>
          </m.div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted">
            {t('panel.pickTool')}
          </div>
        )}
      </AnimatePresence>
      <div
        aria-hidden="true"
        onMouseDown={handleMouseDown}
        className={`absolute left-0 top-0 h-full w-1.5 cursor-ew-resize transition ${
          isResizing ? 'bg-accent/60' : 'bg-transparent hover:bg-accent/30'
        }`}
        style={{ transform: 'translateX(-50%)' }}
      />
    </aside>
  )
}
