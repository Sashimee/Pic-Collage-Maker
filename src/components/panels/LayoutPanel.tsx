import { useState } from 'react'
import { useEditor } from '../../store/editorStore'
import { GRID_LAYOUTS } from '../../lib/grids'
import { ColorField, Section, Slider } from '../ui'
import { LayoutPreview } from '../LayoutPreview'
import { useT } from '../../i18n/useLang'
import { PHOTO_SHAPES } from '../../lib/shapes'
import { EXPORT_PRESETS } from '../../lib/exportPresets'

const ASPECTS = [
  { key: 'square', w: 1080, h: 1080 },
  { key: 'portrait', w: 1080, h: 1350 },
  { key: 'story', w: 1080, h: 1920 },
  { key: 'landscape', w: 1350, h: 1080 },
  { key: 'pin', w: 1080, h: 1620 },
  { key: 'wide', w: 1080, h: 566 },
]

const LAYOUT_CATEGORIES: { id: string; labelKey: string }[] = [
  { id: 'all', labelKey: 'layout.catAll' },
  { id: 'classic', labelKey: 'layout.catClassic' },
  { id: 'editorial', labelKey: 'layout.catEditorial' },
  { id: 'social', labelKey: 'layout.catSocial' },
  { id: 'creative', labelKey: 'layout.catCreative' },
]

const PRESET_CATEGORIES: Record<string, string> = {
  social: 'Social Media',
  print: 'Print',
  screen: 'Screen',
}

function PresetThumb({ w, h, active }: { w: number; h: number; active: boolean }) {
  const box = 36
  const scale = box / Math.max(w, h)
  return (
    <span
      className={`flex h-[42px] w-[42px] items-center justify-center rounded-lg ${
        active ? 'bg-accent/20' : 'bg-surface-3'
      }`}
    >
      <span
        style={{ width: w * scale, height: h * scale }}
        className={`rounded-[3px] ${active ? 'bg-accent' : 'bg-muted/60'}`}
      />
    </span>
  )
}

function AspectThumb({ w, h, active }: { w: number; h: number; active: boolean }) {
  const box = 30
  const scale = box / Math.max(w, h)
  return (
    <span
      className={`flex h-[38px] w-[38px] items-center justify-center rounded-md ${
        active ? 'bg-accent/20' : 'bg-surface-3'
      }`}
    >
      <span
        style={{ width: w * scale, height: h * scale }}
        className={`rounded-[3px] ${active ? 'bg-accent' : 'bg-muted/60'}`}
      />
    </span>
  )
}

function ShapePicker() {
  const t = useT()
  const selectedId = useEditor((s) => s.selectedId)
  const elements = useEditor((s) => s.elements)
  const updateElement = useEditor((s) => s.updateElement)
  const applyShapeToAll = useEditor((s) => s.applyShapeToAll)

  const selected = elements.find((e) => e.id === selectedId)
  const isPhoto = selected?.type === 'photo'
  const currentShape = isPhoto ? selected.shape ?? 'rect' : 'rect'
  const hasPhotos = elements.some((e) => e.type === 'photo')

  if (!isPhoto && !hasPhotos) return null

  return (
    <Section title={t('shape.title')}>
      <div className="flex flex-wrap gap-1.5">
        {PHOTO_SHAPES.map((s) => (
          <button
            key={s.id}
            title={t('shape.' + s.id)}
            onClick={() => {
              if (isPhoto && selectedId) {
                updateElement(selectedId, { shape: s.id })
              }
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition active:scale-90 ${
              currentShape === s.id
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-text/80 hover:bg-surface-3'
            }`}
            aria-label={t('shape.' + s.id)}
          >
            {s.glyph}
          </button>
        ))}
      </div>
      {hasPhotos && (
        <button
          onClick={() => applyShapeToAll(currentShape)}
          className="mt-2 w-full rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-text transition hover:bg-surface-3 active:scale-95"
          title={t('shape.applyToAll')}
        >
          {t('shape.applyToAll')}
        </button>
      )}
    </Section>
  )
}

export function LayoutPanel() {
  const t = useT()
  const setBoardSize = useEditor((s) => s.setBoardSize)
  const setGrid = useEditor((s) => s.setGrid)
  const boardWidth = useEditor((s) => s.boardWidth)
  const boardHeight = useEditor((s) => s.boardHeight)
  const gridId = useEditor((s) => s.gridId)
  const gridGap = useEditor((s) => s.gridGap)
  const gridRadius = useEditor((s) => s.gridRadius)
  const setGridGap = useEditor((s) => s.setGridGap)
  const setGridRadius = useEditor((s) => s.setGridRadius)

  const [catFilter, setCatFilter] = useState('all')

  const isPreset = ASPECTS.some((a) => a.w === boardWidth && a.h === boardHeight)

  const filteredLayouts =
    catFilter === 'all'
      ? GRID_LAYOUTS
      : GRID_LAYOUTS.filter((g) => g.category === catFilter || (!g.category && catFilter === 'classic'))

  return (
    <div className="flex flex-col gap-4">
      <Section title={t('layout.format')}>
        <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
          {ASPECTS.map((a) => {
            const active = boardWidth === a.w && boardHeight === a.h
            return (
              <button
                key={a.key}
                onClick={() => setBoardSize(a.w, a.h)}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-[0.7rem] font-medium transition active:scale-95 ${
                  active ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2'
                }`}
              >
                <AspectThumb w={a.w} h={a.h} active={active} />
                {t('aspect.' + a.key)}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{t('aspect.custom')}</span>
          <input
            type="number"
            min={200}
            max={4096}
            value={boardWidth}
            onChange={(e) =>
              setBoardSize(
                Math.max(200, Math.min(4096, Number(e.target.value) || boardWidth)),
                boardHeight,
              )
            }
            className={`w-20 rounded-lg border bg-surface-2 px-2 py-2 text-sm text-text ${
              isPreset ? 'border-border' : 'border-accent'
            }`}
          />
          <span className="text-muted">×</span>
          <input
            type="number"
            min={200}
            max={4096}
            value={boardHeight}
            onChange={(e) =>
              setBoardSize(
                boardWidth,
                Math.max(200, Math.min(4096, Number(e.target.value) || boardHeight)),
              )
            }
            className={`w-20 rounded-lg border bg-surface-2 px-2 py-2 text-sm text-text ${
              isPreset ? 'border-border' : 'border-accent'
            }`}
          />
        </div>
      </Section>

      <Section title={t('layout.grids')}>
        {/* Category filter tabs */}
        <div className="scroll-x flex gap-1 overflow-x-auto pb-1">
          {LAYOUT_CATEGORIES.map((c) => {
            const active = catFilter === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCatFilter(c.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[0.7rem] font-medium transition active:scale-95 ${
                  active
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-muted hover:bg-surface-3'
                }`}
              >
                {t(c.labelKey)}
              </button>
            )
          })}
        </div>
        <div className="scroll-x flex gap-2.5 overflow-x-auto pb-1">
          <button
            onClick={() => setGrid(null)}
            className="shrink-0"
            aria-label={t('layout.free')}
          >
            <LayoutPreview layout={null} width={72} height={90} active={gridId === null} />
          </button>
          {filteredLayouts.map((g) => (
            <button
              key={g.id}
              onClick={() => setGrid(g.id)}
              className="shrink-0"
              aria-label={`${g.count}`}
            >
              <LayoutPreview
                layout={g}
                width={72}
                height={90}
                active={gridId === g.id}
              />
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('export.presets')}>
        <div className="flex flex-col gap-3">
          {(['social', 'print', 'screen'] as const).map((cat) => {
            const catPresets = EXPORT_PRESETS.filter((p) => p.category === cat)
            if (!catPresets.length) return null
            return (
              <div key={cat}>
                <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
                  {PRESET_CATEGORIES[cat]}
                </p>
                <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
                  {catPresets.map((p) => {
                    const active = boardWidth === p.width && boardHeight === p.height
                    return (
                      <button
                        key={p.id}
                        onClick={() => setBoardSize(p.width, p.height)}
                        className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[0.65rem] font-medium transition active:scale-95 ${
                          active ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2'
                        }`}
                        title={`${p.width} × ${p.height}`}
                      >
                        <PresetThumb w={p.width} h={p.height} active={active} />
                        {p.id}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {gridId && (
        <Section title={t('layout.gridStyle')}>
          <Slider label={t('grid.gap')} min={0} max={80} value={gridGap} onChange={setGridGap} />
          <Slider
            label={t('grid.radius')}
            min={0}
            max={120}
            value={gridRadius}
            onChange={setGridRadius}
          />
          <p className="text-xs text-muted">{t('grid.hint')}</p>
        </Section>
      )}

      <ShapePicker />

      <Section title={t('shape.title')}>
        <div className="flex flex-wrap gap-2">
          {[
            { type: 'rect' as const, label: 'Rectangle', icon: '▭' },
            { type: 'circle' as const, label: 'Circle', icon: '●' },
            { type: 'triangle' as const, label: 'Triangle', icon: '▲' },
            { type: 'star' as const, label: 'Star', icon: '★' },
            { type: 'arrow' as const, label: 'Arrow', icon: '→' },
          ].map((s) => (
            <button
              key={s.type}
              onClick={() => useEditor.getState().addShape(s.type)}
              className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-2 text-xl transition hover:bg-surface-3 active:scale-95"
              title={s.label}
              aria-label={s.label}
            >
              {s.icon}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <ColorField
            label={t('shape.defaultFill')}
            value="#6366f1"
            onChange={() => { /* shapes created after this will use this color — future enhancement */ }}
          />
        </div>
      </Section>
    </div>
  )
}
