import { useState, useMemo, useCallback, useRef } from 'react'
import type { GridLayout } from '../types'
import { PICKER_LAYOUTS } from '../lib/grids'
import { loadCustomLayouts } from '../lib/customLayoutStorage'
import { LayoutPreview } from './LayoutPreview'
import { useT } from '../i18n/useLang'
import { m, AnimatePresence } from './motion'
import { Wand2, SkipForward } from 'lucide-react'

const CATEGORIES = ['all', 'classic', 'editorial', 'social', 'creative', 'custom'] as const
export type GalleryCategory = (typeof CATEGORIES)[number]

const PHOTO_FILTERS = [
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
  { label: '9+', value: 9 },
] as const

const STORAGE_KEY = 'pic-collage-recent-layouts'

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.slice(0, 6)
    }
  } catch {
    /* ignore */
  }
  return []
}

function pushRecent(id: string) {
  try {
    const recent = readRecent()
    const next = [id, ...recent.filter((x) => x !== id)].slice(0, 6)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

function categoryLabel(t: (k: string) => string, cat: GalleryCategory) {
  switch (cat) {
    case 'all':
      return t('gallery.all')
    case 'classic':
      return t('gallery.classic')
    case 'editorial':
      return t('gallery.editorial')
    case 'social':
      return t('gallery.social')
    case 'creative':
      return t('gallery.creative')
    case 'custom':
      return t('gallery.custom')
  }
}

export function LayoutGallery({
  onSelectLayout,
  onCustomLayout,
  onSkip,
}: {
  onSelectLayout: (layoutId: string) => void
  onCustomLayout: () => void
  onSkip: () => void
}) {
  const t = useT()
  const [activeCategory, setActiveCategory] = useState<GalleryCategory>('all')
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [recentIds] = useState<string[]>(readRecent)
  const galleryRef = useRef<HTMLDivElement>(null)

  // Layouts the user drew live in localStorage, not in GRID_LAYOUTS — without
  // this the "Custom" tab was always empty and a saved layout could never be
  // picked again.
  const [savedLayouts] = useState<GridLayout[]>(() =>
    loadCustomLayouts()
      .slice()
      .reverse()
      .map((l) => ({
        id: l.id,
        label: l.name,
        count: l.cells.length,
        cells: l.cells,
        category: 'custom' as const,
        isCustom: true,
      })),
  )

  const allLayouts = useMemo(() => [...savedLayouts, ...PICKER_LAYOUTS], [savedLayouts])

  const filtered = useMemo(() => {
    let layouts = allLayouts.filter((l) => {
      if (activeCategory === 'all') return true
      if (activeCategory === 'custom') return l.isCustom
      return l.category === activeCategory && !l.isCustom
    })
    if (activeCount !== null) {
      layouts = layouts.filter((l) =>
        activeCount === 9 ? l.count >= 9 : l.count === activeCount,
      )
    }
    return layouts
  }, [allLayouts, activeCategory, activeCount])

  const recentLayouts = useMemo(() => {
    const map = new Map(allLayouts.map((l) => [l.id, l]))
    return recentIds.map((id) => map.get(id)).filter(Boolean) as GridLayout[]
  }, [allLayouts, recentIds])

  const handleSelect = useCallback(
    (id: string) => {
      pushRecent(id)
      onSelectLayout(id)
    },
    [onSelectLayout],
  )

  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl bg-surface-2/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm border border-border/30">
      <div className="text-center">
        <h2 className="text-base font-bold text-text">{t('gallery.title')}</h2>
        <p className="mt-1 text-xs text-muted">{t('gallery.subtitle')}</p>
      </div>

      <div className="scroll-x flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <m.button
            key={cat}
            whileTap={{ scale: 0.94 }}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              activeCategory === cat
                ? 'bg-grad-accent text-white shadow-[var(--shadow-accent)]'
                : 'bg-surface-2 text-text/80 hover:bg-surface-3'
            }`}
          >
            {categoryLabel(t, cat)}
          </m.button>
        ))}
      </div>

      <div className="scroll-x flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
        {PHOTO_FILTERS.map((f) => (
          <m.button
            key={f.label}
            whileTap={{ scale: 0.94 }}
            onClick={() =>
              setActiveCount((c) => (c === f.value ? null : f.value))
            }
            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              activeCount === f.value
                ? 'bg-accent/20 text-accent'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
            }`}
          >
            {f.label}
          </m.button>
        ))}
      </div>

      <div
        ref={galleryRef}
        className="grid grid-cols-3 gap-3 md:grid-cols-4 px-1"
      >
        <AnimatePresence mode="popLayout">
          {filtered.map((layout) => (
            <m.button
              key={layout.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              onClick={() => handleSelect(layout.id)}
              className="flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition active:scale-95 hover:bg-surface-2"
              aria-label={`${layout.label} photos`}
            >
              <LayoutPreview
                layout={layout}
                width={80}
                height={100}
                active={false}
              />
              <span className="text-[0.6rem] font-medium text-muted">
                {layout.count} {t('photos.add')?.split(' ')?.slice(-1)?.[0] ?? ''}
              </span>
            </m.button>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">
          {t('empty.subtitle')}
        </p>
      )}

      {recentLayouts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
            {t('gallery.recent')}
          </p>
          <div className="scroll-x flex gap-2.5 overflow-x-auto px-1 pb-1 no-scrollbar">
            {recentLayouts.map((layout) => (
              <button
                key={layout.id}
                onClick={() => handleSelect(layout.id)}
                className="flex shrink-0 flex-col items-center gap-1 rounded-xl p-1 transition active:scale-95 hover:bg-surface-2"
                aria-label={`${layout.label} photos`}
              >
                <LayoutPreview
                  layout={layout}
                  width={64}
                  height={80}
                  active={false}
                />
                <span className="text-[0.6rem] font-medium text-muted">
                  {layout.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <m.button
          whileTap={{ scale: 0.96 }}
          onClick={onCustomLayout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 py-2.5 text-sm font-semibold text-text transition hover:bg-surface-3"
        >
          <Wand2 size={16} strokeWidth={2.5} />
          {t('gallery.custom')}
        </m.button>
        <m.button
          whileTap={{ scale: 0.96 }}
          onClick={onSkip}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-2"
        >
          <SkipForward size={16} strokeWidth={2.5} />
          {t('gallery.skip')}
        </m.button>
      </div>
    </div>
  )
}
