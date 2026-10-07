import { useCallback, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { m } from './motion'
import { useEditor } from '../store/editorStore'
import type { LoadedDocument } from '../store/editorStore'
import { defaultProjectName, useProjects } from '../store/projectsStore'
import { useScrollOverflow } from '../hooks/useScrollOverflow'
import { usePointerReorder } from '../hooks/usePointerReorder'
import { usePageThumbs } from '../hooks/usePageThumbs'
import { PageThumb } from './PageThumb'
import { useT } from '../i18n/useLang'

const TILE_W = 48
const TILE_H = 60
const GAP = 8
/** Fallback pitch; the real one is measured from the tiles (see `pitch`). */
const NOMINAL_PITCH = TILE_W + GAP + 6

/**
 * The rail of pages under the canvas.
 *
 * Mounted as a flow sibling of the canvas box rather than an overlay on it: the
 * host shrinks, EditorCanvas's ResizeObserver fires and the board re-fits by
 * itself. Overlaying would need a pixel inset EditorCanvas does not have
 * (`bottomInset` is a fraction, floored at the 60px chrome inset) and would
 * land on top of ZoomControls and SelectionBar, neither of which reads one.
 */
export function PageStrip() {
  const t = useT()
  const pages = useProjects((s) => s.pages)
  const activePage = useProjects((s) => s.activePage)
  const [busy, setBusy] = useState(false)

  // The active tile is drawn from the *live* editor, not from `pages`: the
  // store's copy of the page being edited lags until the next save, so a tile
  // read from it would ignore everything you just did.
  const boardWidth = useEditor((s) => s.boardWidth)
  const boardHeight = useEditor((s) => s.boardHeight)
  const background = useEditor((s) => s.background)
  const mode = useEditor((s) => s.mode)
  const gridId = useEditor((s) => s.gridId)
  const gridGap = useEditor((s) => s.gridGap)
  const gridRadius = useEditor((s) => s.gridRadius)
  const gridMargin = useEditor((s) => s.gridMargin)
  const frame = useEditor((s) => s.frame)
  const elements = useEditor((s) => s.elements)

  const live: LoadedDocument = useMemo(
    () => ({
      boardWidth,
      boardHeight,
      background,
      mode,
      gridId,
      gridGap,
      gridRadius,
      gridMargin,
      frame,
      elements,
    }),
    [boardWidth, boardHeight, background, mode, gridId, gridGap, gridRadius, gridMargin, frame, elements],
  )

  // With no project yet there is still exactly one page — the one on screen.
  // Showing it (and the "+" beside it) is what makes the feature reachable at
  // all; adding the second page is what creates the project.
  const tiles = useMemo(
    () => (pages.length ? pages.map((p, i) => (i === activePage ? live : p)) : [live]),
    [pages, activePage, live],
  )

  const srcFor = usePageThumbs(tiles)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { canScrollStart, canScrollEnd, ref: overflowRef } =
    useScrollOverflow<HTMLDivElement>('x', [tiles.length])

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el
      overflowRef.current = el
    },
    [overflowRef],
  )

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    // setActivePage awaits rehydratePhotos from IndexedDB, so it is not
    // instantaneous — without this a double-tap can interleave two page swaps.
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }, [])

  /**
   * Distance between two tiles, measured rather than derived: the tile's
   * padding and border are Tailwind classes, so any constant here is one
   * restyle away from being wrong — and a wrong pitch means drops land on the
   * wrong page, silently.
   */
  const pitch = useCallback(() => {
    const el = scrollRef.current
    const a = el?.querySelector<HTMLElement>('[data-page-tile="0"]')
    const b = el?.querySelector<HTMLElement>('[data-page-tile="1"]')
    if (!a || !b) return NOMINAL_PITCH
    return b.getBoundingClientRect().left - a.getBoundingClientRect().left || NOMINAL_PITCH
  }, [])

  const reorder = usePointerReorder({
    axis: 'x',
    itemSize: pitch,
    count: tiles.length,
    scrollerRef: scrollRef,
    // The whole tile is the drag target *and* the tap target, so a tap has to
    // be able to stay a tap.
    threshold: 6,
    onDrop: (from, to) => void run(() => useProjects.getState().reorderPages(from, to)),
  })

  const moveByKey = (from: number, to: number) => {
    if (to < 0 || to >= tiles.length || busy) return
    void run(async () => {
      await useProjects.getState().reorderPages(from, to)
      requestAnimationFrame(() => {
        scrollRef.current?.querySelector<HTMLElement>(`[data-page-tile="${to}"]`)?.focus()
      })
    })
  }

  const goTo = (index: number) => {
    if (reorder.moved.current || busy || index === activePage) return
    void run(() => useProjects.getState().setActivePage(index))
  }

  const addPage = () =>
    void run(async () => {
      const projects = useProjects.getState()
      // addPage is a no-op without a project, so make one first — the same
      // thing sharing does in App.tsx via ensureProjectSaved().
      if (!projects.activeProjectId) await projects.createProject(defaultProjectName())
      await useProjects.getState().addPage()
    })

  const duplicatePage = () =>
    void run(async () => {
      const projects = useProjects.getState()
      if (!projects.activeProjectId) await projects.createProject(defaultProjectName())
      await useProjects.getState().duplicatePage()
    })

  const deletePage = () => {
    if (tiles.length <= 1) return
    if (!window.confirm(t('page.deleteConfirm'))) return
    void run(() => useProjects.getState().deletePage(activePage))
  }

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.6
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <div
      className="relative z-10 flex items-center border-t border-border bg-surface"
      data-page-strip
    >
      {canScrollStart && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-6 bg-gradient-to-r from-surface to-transparent" />
      )}
      {canScrollEnd && (
        <div className="pointer-events-none absolute inset-y-0 right-24 z-20 w-6 bg-gradient-to-l from-surface to-transparent" />
      )}
      <m.button
        initial={{ opacity: 0 }}
        animate={{ opacity: canScrollStart ? 1 : 0 }}
        className={`absolute left-1 top-1/2 z-30 -translate-y-1/2 rounded-full bg-surface-2 p-1 shadow-md ${canScrollStart ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onClick={() => scroll('left')}
        aria-label={t('aria.scrollLeft')}
        aria-hidden={!canScrollStart}
        tabIndex={canScrollStart ? 0 : -1}
      >
        <ChevronLeft size={16} />
      </m.button>
      <m.button
        initial={{ opacity: 0 }}
        animate={{ opacity: canScrollEnd ? 1 : 0 }}
        className={`absolute right-24 top-1/2 z-30 -translate-y-1/2 rounded-full bg-surface-2 p-1 shadow-md ${canScrollEnd ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onClick={() => scroll('right')}
        aria-label={t('aria.scrollRight')}
        aria-hidden={!canScrollEnd}
        tabIndex={canScrollEnd ? 0 : -1}
      >
        <ChevronRight size={16} />
      </m.button>

      <div
        ref={setRefs}
        className="scroll-x relative flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-2 py-2 no-scrollbar"
        role="group"
        aria-label={t('page.title')}
      >
        {reorder.dropIndex !== null && (
          <div
            className="pointer-events-none absolute inset-y-2 z-10 w-0.5 rounded-full bg-accent"
            style={{ left: 8 + reorder.dropIndex * pitch() - 1 }}
            aria-hidden="true"
          />
        )}
        {tiles.map((page, i) => (
          <button
            key={i}
            data-page-tile={i}
            aria-current={i === activePage ? 'true' : undefined}
            aria-label={`${t('page.label')} ${i + 1}`}
            // touch-none: without it the browser claims the gesture for
            // scrolling and the pointermove stream stops after a few px.
            className={`relative shrink-0 touch-none select-none rounded-lg border p-0.5 transition ${
              i === activePage
                ? 'border-accent bg-accent/10'
                : 'border-border bg-surface-2 hover:bg-surface-3'
            } ${reorder.dragIndex === i ? 'opacity-40' : ''}`}
            onPointerDown={(e) => reorder.start(e, i)}
            onClick={() => goTo(i)}
            onKeyDown={(e) => {
              // The keyboard equivalent of the drag, and the only route for
              // anyone who can't drag at all. Focus follows the page, so
              // repeated presses carry the same one along the rail.
              const dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
              if (!dir) return
              e.preventDefault()
              moveByKey(i, i + dir)
            }}
          >
            <PageThumb page={page} width={TILE_W} height={TILE_H} srcFor={srcFor} />
            <span className="absolute bottom-0.5 right-1 rounded bg-surface/80 px-1 text-[0.6rem] font-medium tabular-nums text-text/80">
              {i + 1}
            </span>
          </button>
        ))}

        <button
          onClick={addPage}
          disabled={busy}
          className="flex h-[60px] w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-accent transition hover:bg-surface-2 disabled:opacity-50"
          aria-label={t('page.add')}
          title={t('page.add')}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-border px-1.5">
        <button
          onClick={duplicatePage}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-50"
          aria-label={t('page.duplicate')}
          title={t('page.duplicate')}
        >
          <Copy size={15} />
        </button>
        <button
          onClick={deletePage}
          disabled={busy || tiles.length <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-30"
          aria-label={t('page.delete')}
          title={t('page.delete')}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
