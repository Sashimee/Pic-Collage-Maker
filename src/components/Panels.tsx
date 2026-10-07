import { useState, useEffect, useCallback } from 'react'
import { ImagePlus, Camera } from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { FontUploader } from './FontUploader'
import { loadCustomFonts } from '../lib/fonts'
import { analyzePhoto, getSuggestions } from '../ai/textSuggestions'
import { GRID_LAYOUTS } from '../lib/grids'
import { PATTERN_GLYPH, PATTERN_IDS } from '../lib/patterns'
import { importFiles } from '../lib/importFiles'
import type { FrameStyle, PhotoElement, TextElement, TextSpan } from '../types'
import { Chip, ColorField, PrimaryButton, Section, Slider } from './ui'
import { LayoutPreview } from './LayoutPreview'
import { useT } from '../i18n/useLang'
import { EMOJI_CATEGORIES } from '../lib/emojis'
import { PHOTO_SHAPES } from '../lib/shapes'
import { EXPORT_PRESETS } from '../lib/exportPresets'
import { putPhoto } from '../lib/persistence'
import { backgroundKey } from '../lib/photoRehydrate'

// ---- Photos --------------------------------------------------------------

const PANEL_GALLERY_ID = 'panel-gallery-input'
const PANEL_CAMERA_ID = 'panel-camera-input'

export function PhotosPanel() {
  const t = useT()
  const addPhoto = useEditor((s) => s.addPhoto)

  const handleGalleryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Capture before awaiting — `currentTarget` is nulled once the handler
    // returns, so reading it after the await can throw.
    const input = e.target
    if (input.files && input.files.length > 0) {
      try {
        await importFiles(input.files, addPhoto)
      } catch {
        window.alert(t('error.loadImage'))
      }
    }
    input.value = ''
  }

  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    if (input.files && input.files.length > 0) {
      try {
        await importFiles(input.files, addPhoto)
      } catch {
        window.alert(t('error.loadCamera'))
      }
    }
    input.value = ''
  }

  return (
    <div className="flex gap-3">
      <input
        id={PANEL_GALLERY_ID}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleGalleryChange}
      />
      <input
        id={PANEL_CAMERA_ID}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleCameraChange}
      />
      <PrimaryButton as="label" htmlFor={PANEL_GALLERY_ID}>
        <span className="flex items-center gap-2">
          <ImagePlus size={16} strokeWidth={2.5} />
          {t('photos.add')}
        </span>
      </PrimaryButton>
      <PrimaryButton as="label" htmlFor={PANEL_CAMERA_ID}>
        <span className="flex items-center gap-2">
          <Camera size={16} strokeWidth={2.5} />
          {t('photos.camera')}
        </span>
      </PrimaryButton>
    </div>
  )
}

// ---- Layout (canvas size + grids) ---------------------------------------

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

// ---- Shape Picker --------------------------------------------------------

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

// ---- Text ----------------------------------------------------------------

const FONTS = [
  'Poppins',
  'system-ui',
  'Georgia',
  'Times New Roman',
  'Palatino',
  'Trebuchet MS',
  'Verdana',
  'Impact',
  'Courier New',
  'Comic Sans MS',
  'Brush Script MT',
]

const DEFAULT_CHIP = { color: '#fde68a', padding: 18, radius: 14 }

const inputClass =
  'min-h-[44px] rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text'

function buildSpansFromText(text: string, fontSize: number, fill: string, fontStyle: string): TextSpan[] {
  const style = fontStyle.includes('bold') ? 'bold' : ''
  const italic = fontStyle.includes('italic')
  return [
    {
      text,
      fontSize,
      fill,
      bold: style === 'bold',
      italic,
      underline: false,
    },
  ]
}

function flattenSpans(spans: TextSpan[]): { text: string; fontStyle: string } {
  const text = spans.map((s) => s.text).join('')
  const anyBold = spans.some((s) => s.bold)
  const anyItalic = spans.some((s) => s.italic)
  const style = [anyBold ? 'bold' : '', anyItalic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal'
  return { text, fontStyle: style }
}

export function TextPanel() {
  const t = useT()
  const addText = useEditor((s) => s.addText)
  const selectedId = useEditor((s) => s.selectedId)
  const el = useEditor((s) => s.elements.find((e) => e.id === s.selectedId))
  const update = useEditor((s) => s.updateElement)
  const text = el?.type === 'text' ? (el as TextElement) : null

  // Uploaded fonts are registered as FontFaces at startup; surface their
  // families in the picker so they're actually selectable.
  const [customFonts, setCustomFonts] = useState<string[]>([])
  const reloadFonts = useCallback(() => {
    loadCustomFonts().then((f) => setCustomFonts(f.map((x) => x.family)))
  }, [])
  useEffect(() => reloadFonts(), [reloadFonts])
  const fontOptions = [...FONTS, ...customFonts.filter((f) => !FONTS.includes(f))]

  // AI caption suggestions from the selected photo (or the first photo).
  const elements = useEditor((s) => s.elements)
  const [captions, setCaptions] = useState<string[]>([])
  const [captionsBusy, setCaptionsBusy] = useState(false)
  const captionPhoto =
    (el?.type === 'photo' ? (el as PhotoElement) : null) ??
    elements.find((e): e is PhotoElement => e.type === 'photo') ??
    null

  const suggestCaptions = async () => {
    if (!captionPhoto) return
    setCaptionsBusy(true)
    try {
      setCaptions(getSuggestions(await analyzePhoto(captionPhoto.src)))
    } catch {
      setCaptions([])
    } finally {
      setCaptionsBusy(false)
    }
  }

  const addCaption = (caption: string) => {
    addText()
    const id = useEditor.getState().selectedId
    if (id) update(id, { text: caption })
  }

  return (
    <div className="flex flex-col gap-4">
      <PrimaryButton onClick={addText}>{t('text.add')}</PrimaryButton>

      {captionPhoto && (
        <Section title={t('caption.title')}>
          <button
            onClick={suggestCaptions}
            disabled={captionsBusy}
            className="w-full rounded-lg bg-accent/10 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
          >
            {captionsBusy ? t('caption.analyzing') : `✨ ${t('caption.suggest')}`}
          </button>
          {captions.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {captions.map((c, i) => (
                <button
                  key={i}
                  onClick={() => addCaption(c)}
                  className="rounded-lg bg-surface-2 px-3 py-2 text-left text-sm text-text transition hover:bg-surface-3 active:scale-[0.98]"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section title={t('font.section')}>
        <FontUploader onFontsChange={reloadFonts} />
      </Section>
      {text && selectedId ? (
        <>
          <Section title={t('text.content')}>
            <input
              value={text.text}
              onChange={(e) => update(selectedId, { text: e.target.value })}
              className={inputClass}
              placeholder={t('text.placeholder')}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={text.fontFamily.split(',')[0]}
                onChange={(e) =>
                  update(selectedId, {
                    fontFamily: `${e.target.value}, system-ui, sans-serif`,
                  })
                }
                className="min-h-[44px] rounded-lg border border-border bg-surface-2 px-2 py-2.5 text-sm text-text"
              >
                {fontOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  update(selectedId, {
                    fontStyle: text.fontStyle.includes('bold')
                      ? text.fontStyle.replace('bold', '').trim() || 'normal'
                      : text.fontStyle === 'normal'
                        ? 'bold'
                        : `${text.fontStyle} bold`.trim(),
                  })
                }
                className={`min-h-[44px] rounded-lg px-3 py-2.5 text-sm font-bold transition active:scale-95 ${
                  text.fontStyle.includes('bold')
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                }`}
              >
                B
              </button>
              <button
                onClick={() =>
                  update(selectedId, {
                    fontStyle: text.fontStyle.includes('italic')
                      ? text.fontStyle.replace('italic', '').trim() || 'normal'
                      : text.fontStyle === 'normal'
                        ? 'italic'
                        : `${text.fontStyle} italic`.trim(),
                  })
                }
                className={`min-h-[44px] rounded-lg px-3 py-2.5 text-sm italic transition active:scale-95 ${
                  text.fontStyle.includes('italic')
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                }`}
              >
                I
              </button>
              <button
                onClick={() => {
                  // Underline is stored via spans; if no spans, create one
                  if (!text.spans || text.spans.length === 0) {
                    const spans = buildSpansFromText(text.text, text.fontSize, text.fill, text.fontStyle)
                    spans[0].underline = !spans[0].underline
                    update(selectedId, { spans })
                  } else {
                    update(selectedId, {
                      spans: text.spans.map((s) => ({ ...s, underline: !s.underline })),
                    })
                  }
                }}
                className={`min-h-[44px] rounded-lg px-3 py-2.5 text-sm underline transition active:scale-95 ${
                  text.spans?.some((s) => s.underline)
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                }`}
              >
                U
              </button>
              <ColorField
                label={t('common.color')}
                value={text.fill}
                onChange={(v) => update(selectedId, { fill: v })}
              />
            </div>
            <Slider
              label={t('common.size')}
              min={16}
              max={240}
              value={text.fontSize}
              onChange={(v) => update(selectedId, { fontSize: v })}
            />
            {/* Span mode */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  if (text.spans && text.spans.length > 0) {
                    // Flatten spans back to plain text
                    const { text: plainText, fontStyle: plainStyle } = flattenSpans(text.spans)
                    update(selectedId, { spans: undefined, text: plainText, fontStyle: plainStyle })
                  } else {
                    // Convert plain text to single span
                    const spans = buildSpansFromText(text.text, text.fontSize, text.fill, text.fontStyle)
                    update(selectedId, { spans })
                  }
                }}
                className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
                  text.spans && text.spans.length > 0
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                }`}
              >
                Span Mode
              </button>
            </div>
            {/* If span mode is active, show per-span editor (simplified: single span) */}
            {text.spans && text.spans.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-2">
                <span className="text-xs text-muted">Span text</span>
                {text.spans.map((span, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      value={span.text}
                      onChange={(e) => {
                        const next = [...text.spans!]
                        next[i] = { ...next[i], text: e.target.value }
                        update(selectedId, { spans: next })
                      }}
                      className="min-h-[36px] flex-1 rounded border border-border bg-surface-3 px-2 py-1 text-sm text-text"
                    />
                    <button
                      onClick={() => {
                        const next = [...text.spans!]
                        next[i] = { ...next[i], bold: !next[i].bold }
                        update(selectedId, { spans: next })
                      }}
                      className={`min-h-[36px] rounded px-2 text-sm font-bold transition ${
                        span.bold ? 'bg-accent text-accent-fg' : 'bg-surface-3 text-text/80'
                      }`}
                    >
                      B
                    </button>
                    <button
                      onClick={() => {
                        const next = [...text.spans!]
                        next[i] = { ...next[i], italic: !next[i].italic }
                        update(selectedId, { spans: next })
                      }}
                      className={`min-h-[36px] rounded px-2 text-sm italic transition ${
                        span.italic ? 'bg-accent text-accent-fg' : 'bg-surface-3 text-text/80'
                      }`}
                    >
                      I
                    </button>
                    <ColorField
                      label=""
                      value={span.fill ?? text.fill}
                      onChange={(v) => {
                        const next = [...text.spans!]
                        next[i] = { ...next[i], fill: v }
                        update(selectedId, { spans: next })
                      }}
                    />
                    <button
                      onClick={() => {
                        const next = [...text.spans!]
                        next.splice(i, 1)
                        update(selectedId, { spans: next.length ? next : undefined })
                      }}
                      className="min-h-[36px] rounded px-2 text-sm text-red-400 transition hover:bg-red-400/10"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    update(selectedId, {
                      spans: [
                        ...(text.spans ?? []),
                        { text: 'new', fill: text.fill, fontSize: text.fontSize },
                      ],
                    })
                  }}
                  className="min-h-[36px] rounded bg-surface-3 px-3 text-sm text-text transition hover:bg-surface-2"
                >
                  + Add span
                </button>
              </div>
            )}
          </Section>

          <Section title={t('text.effects')}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  update(selectedId, {
                    shadowBlur: text.shadowBlur ? 0 : 14,
                    shadowColor: text.shadowColor ?? '#000000',
                  })
                }
                className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
                  text.shadowBlur
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                }`}
              >
                {t('text.shadow')}
              </button>
              <button
                onClick={() =>
                  update(selectedId, { chip: text.chip ? undefined : { ...DEFAULT_CHIP } })
                }
                className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
                  text.chip
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                }`}
              >
                {t('text.chip')}
              </button>
              {text.chip && (
                <ColorField
                  label={t('common.color')}
                  value={text.chip.color}
                  onChange={(v) => update(selectedId, { chip: { ...text.chip!, color: v } })}
                />
              )}
            </div>
            <Slider
              label={t('text.outline')}
              min={0}
              max={20}
              value={text.strokeWidth ?? 0}
              onChange={(v) =>
                update(selectedId, { strokeWidth: v, stroke: text.stroke ?? '#000000' })
              }
            />
            {(text.strokeWidth ?? 0) > 0 && (
              <ColorField
                label={t('text.outlineColor')}
                value={text.stroke ?? '#000000'}
                onChange={(v) => update(selectedId, { stroke: v })}
              />
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  update(selectedId, {
                    effects: {
                      ...text.effects,
                      glow: text.effects?.glow
                        ? undefined
                        : { color: '#ffffff', blur: 12 },
                    },
                  })
                }
                className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
                  text.effects?.glow
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                }`}
              >
                Glow
              </button>
              <button
                onClick={() =>
                  update(selectedId, {
                    effects: {
                      ...text.effects,
                      extrude: text.effects?.extrude
                        ? undefined
                        : { depth: 4, color: '#000000' },
                    },
                  })
                }
                className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
                  text.effects?.extrude
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                }`}
              >
                Extrude
              </button>
              <button
                onClick={() =>
                  update(selectedId, {
                    effects: {
                      ...text.effects,
                      gradient: text.effects?.gradient
                        ? undefined
                        : {
                            stops: [
                              { offset: 0, color: '#ec4899' },
                              { offset: 1, color: '#6366f1' },
                            ],
                          },
                    },
                  })
                }
                className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
                  text.effects?.gradient
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                }`}
              >
                Gradient
              </button>
            </div>

            <Slider
              label={t('text.curve')}
              min={0}
              max={80}
              value={text.curve ?? 0}
              onChange={(v) => update(selectedId, { curve: v })}
            />
          </Section>
        </>
      ) : (
        <EmptyHint icon="✏️" text={t('text.selectHint')} />
      )}
    </div>
  )
}

// ---- Draw ----------------------------------------------------------------

const DRAW_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#6366f1', '#ec4899', '#111827', '#ffffff']

export function DrawPanel() {
  const t = useT()
  const brushColor = useEditor((s) => s.brushColor)
  const brushSize = useEditor((s) => s.brushSize)
  const setBrush = useEditor((s) => s.setBrush)

  return (
    <Section>
      <p className="text-xs text-muted">{t('draw.hint')}</p>
      <div className="flex flex-wrap gap-2">
        {DRAW_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setBrush({ color: c })}
            style={{ background: c }}
            className={`h-11 w-11 rounded-full border transition active:scale-90 ${
              brushColor === c ? 'border-accent ring-2 ring-accent' : 'border-border'
            }`}
          />
        ))}
      </div>
      <ColorField
        label={t('common.color')}
        value={brushColor}
        onChange={(v) => setBrush({ color: v })}
      />
      <Slider
        label={t('draw.size')}
        min={1}
        max={60}
        value={brushSize}
        onChange={(v) => setBrush({ size: v })}
      />
    </Section>
  )
}

// ---- Stickers ------------------------------------------------------------

export function StickerPanel() {
  const addSticker = useEditor((s) => s.addSticker)
  const [catIndex, setCatIndex] = useState(0)
  const cat = EMOJI_CATEGORIES[catIndex]

  return (
    <div className="flex flex-col gap-2">
      <div className="scroll-x flex gap-1 overflow-x-auto pb-1">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.icon}
            onClick={() => setCatIndex(i)}
            title={c.label}
            className={`flex-shrink-0 rounded-lg px-2 py-2.5 text-xl transition active:scale-95 ${
              i === catIndex ? 'bg-surface-3 ring-1 ring-accent' : 'hover:bg-surface-2'
            }`}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
        {cat.emoji.map((e) => (
          <button
            key={e}
            onClick={() => addSticker(e)}
            className="rounded-lg py-2 text-2xl transition hover:bg-surface-2 active:scale-90"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---- Background ----------------------------------------------------------

const PALETTE = ['#ffffff', '#000000', '#f43f5e', '#6366f1', '#22c55e', '#eab308', '#0ea5e9', '#f97316']

const GRADIENT_PRESETS = [
  { label: 'Sunset', from: '#f43f5e', to: '#f97316', angle: 45 },
  { label: 'Ocean', from: '#0ea5e9', to: '#22c55e', angle: 45 },
  { label: 'Berry', from: '#6366f1', to: '#f43f5e', angle: 135 },
  { label: 'Lemon', from: '#eab308', to: '#f97316', angle: 45 },
  { label: 'Midnight', from: '#1e293b', to: '#6366f1', angle: 135 },
  { label: 'Cotton', from: '#e2e8f0', to: '#f8fafc', angle: 45 },
  { label: 'Neon', from: '#ec4899', to: '#8b5cf6', angle: 135 },
  { label: 'Forest', from: '#166534', to: '#22c55e', angle: 45 },
]

const FRAME_STYLES: FrameStyle[] = ['none', 'solid', 'rounded', 'polaroid']

export function BackgroundPanel() {
  const t = useT()
  const bg = useEditor((s) => s.background)
  const setBg = useEditor((s) => s.setBackground)
  const frame = useEditor((s) => s.frame)
  const setFrame = useEditor((s) => s.setFrame)

  return (
    <div className="flex flex-col gap-4">
      <Section title={t('bg.fill')}>
        <div className="flex gap-2">
          <Chip active={bg.type === 'solid'} onClick={() => setBg({ type: 'solid' })}>
            {t('bg.solid')}
          </Chip>
          <Chip active={bg.type === 'gradient'} onClick={() => setBg({ type: 'gradient' })}>
            {t('bg.gradient')}
          </Chip>
          <Chip active={bg.type === 'pattern'} onClick={() => setBg({ type: 'pattern' })}>
            {t('bg.pattern')}
          </Chip>
          <Chip active={bg.type === 'photo'} onClick={() => setBg({ type: 'photo', photoSrc: undefined })}>
            {t('bg.photo')}
          </Chip>
        </div>
        {bg.type === 'solid' && (
          <>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setBg({ color: c })}
                  style={{ background: c }}
                  className={`h-11 w-11 rounded-full border transition active:scale-90 ${
                    bg.color === c ? 'border-accent ring-2 ring-accent' : 'border-border'
                  }`}
                />
              ))}
            </div>
            <ColorField label={t('bg.custom')} value={bg.color} onChange={(v) => setBg({ color: v })} />
          </>
        )}
        {bg.type === 'gradient' && (
          <>
            {/* Preset gradients */}
            <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
              {GRADIENT_PRESETS.map((g) => {
                const active = bg.gradientFrom === g.from && bg.gradientTo === g.to
                return (
                  <button
                    key={g.label}
                    onClick={() => setBg({ gradientFrom: g.from, gradientTo: g.to, gradientAngle: g.angle })}
                    className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
                      active ? 'border-accent' : 'border-transparent'
                    }`}
                    style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }}
                    title={g.label}
                  />
                )
              })}
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <ColorField label={t('bg.from')} value={bg.gradientFrom} onChange={(v) => setBg({ gradientFrom: v })} />
              <ColorField label={t('bg.to')} value={bg.gradientTo} onChange={(v) => setBg({ gradientTo: v })} />
              <Slider
                label={t('bg.angle')}
                min={0}
                max={360}
                value={bg.gradientAngle}
                onChange={(v) => setBg({ gradientAngle: v })}
              />
            </div>
          </>
        )}
        {bg.type === 'pattern' && (
          <>
            <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
              {PATTERN_IDS.map((p) => (
                <button
                  key={p}
                  onClick={() => setBg({ patternId: p })}
                  title={p}
                  className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-lg transition active:scale-90 ${
                    bg.patternId === p
                      ? 'bg-accent text-accent-fg'
                      : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                  }`}
                >
                  {PATTERN_GLYPH[p]}
                </button>
              ))}
            </div>
            <ColorField label={t('bg.custom')} value={bg.color} onChange={(v) => setBg({ color: v })} />
            <ColorField
              label={t('bg.patternColor')}
              value={bg.patternColor}
              onChange={(v) => setBg({ patternColor: v })}
            />
          </>
        )}
        {bg.type === 'photo' && (
          <>
            {!bg.photoSrc ? (
              <div className="flex flex-col gap-2">
                <input
                  id="bg-photo-input"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    // Hold the element: after the first await React has already
                    // pooled the event and `currentTarget` is null.
                    const input = e.currentTarget
                    const file = input.files?.[0]
                    if (!file) return
                    const src = URL.createObjectURL(file)
                    // Keep the bytes, not just the URL. This used to set
                    // `photoId: undefined` and store the object URL alone, so a
                    // photo background was gone on the next load with nothing
                    // left to rebuild it from.
                    const photoId = crypto.randomUUID()
                    try {
                      await putPhoto(backgroundKey(photoId), file)
                    } catch {
                      /* no storage — the background still works this session */
                    }
                    const img = new Image()
                    img.onload = () => {
                      setBg({ photoSrc: src, photoId })
                    }
                    img.src = src
                    input.value = ''
                  }}
                />
                <label
                  htmlFor="bg-photo-input"
                  className="bg-grad-accent flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-accent)] transition hover:brightness-110 active:scale-95"
                >
                  <ImagePlus size={16} strokeWidth={2.5} />
                  {t('photos.add')}
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="h-20 w-full overflow-hidden rounded-xl bg-surface-2">
                  <img src={bg.photoSrc} alt="" className="h-full w-full object-cover opacity-60" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBg({ photoSrc: undefined })}
                    className="flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-text transition hover:bg-surface-3"
                  >
                    {t('bg.removePhoto')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      <Section title={t('frame.title')} className="border-t border-border pt-3">
        <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
          {FRAME_STYLES.map((s) => (
            <Chip key={s} active={frame.style === s} onClick={() => setFrame({ style: s })}>
              {t('frame.' + s)}
            </Chip>
          ))}
        </div>
        {frame.style !== 'none' && (
          <>
            <ColorField
              label={t('frame.color')}
              value={frame.color}
              onChange={(v) => setFrame({ color: v })}
            />
            <Slider
              label={t('frame.width')}
              min={0.005}
              max={0.12}
              step={0.005}
              value={frame.width}
              onChange={(v) => setFrame({ width: v })}
            />
          </>
        )}
      </Section>
    </div>
  )
}

// ---- Filters -------------------------------------------------------------

export function FilterPanel() {
  const t = useT()
  const selectedId = useEditor((s) => s.selectedId)
  const el = useEditor((s) => s.elements.find((e) => e.id === s.selectedId))
  const updateFilters = useEditor((s) => s.updateFilters)
  const photo = el?.type === 'photo' ? (el as PhotoElement) : null

  if (!photo || !selectedId) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="text-4xl opacity-30">✨</span>
        <p className="text-sm text-muted">{t('filter.selectHint')}</p>
      </div>
    )
  }

  const f = photo.filters
  return (
    <div className="flex flex-col gap-4">
      <Section title={t('filter.presets')}>
        <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
          {([
            { id: 'none', label: 'Original' },
            { id: 'vivid', label: 'Vivid' },
            { id: 'punch', label: 'Punch' },
            { id: 'warm', label: 'Warm' },
            { id: 'cool', label: 'Cool' },
            { id: 'fade', label: 'Fade' },
            { id: 'sepia', label: 'Sepia' },
            { id: 'noir', label: 'Noir' },
            { id: 'grayscale', label: 'B&W' },
          ] as const).map((p) => (
            <Chip
              key={p.id}
              active={f.preset === p.id}
              onClick={() => updateFilters(selectedId, { preset: p.id })}
            >
              {t('filter.' + p.id)}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title={t('filter.adjust')}>
        <Slider
          label={t('filter.brightness')}
          min={-0.5}
          max={0.5}
          step={0.02}
          value={f.brightness}
          onChange={(v) => updateFilters(selectedId, { brightness: v })}
        />
        <Slider
          label={t('filter.contrast')}
          min={-60}
          max={60}
          value={f.contrast}
          onChange={(v) => updateFilters(selectedId, { contrast: v })}
        />
        <Slider
          label={t('filter.saturation')}
          min={-2}
          max={4}
          step={0.1}
          value={f.saturation}
          onChange={(v) => updateFilters(selectedId, { saturation: v })}
        />
        <Slider
          label={t('filter.blur')}
          min={0}
          max={40}
          value={f.blur}
          onChange={(v) => updateFilters(selectedId, { blur: v })}
        />
        <Slider
          label={t('filter.vignette')}
          min={0}
          max={0.9}
          step={0.05}
          value={f.vignette}
          onChange={(v) => updateFilters(selectedId, { vignette: v })}
        />
      </Section>
    </div>
  )
}

// ---- shared --------------------------------------------------------------

function EmptyHint({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span className="text-4xl opacity-30">{icon}</span>
      <p className="text-sm text-muted">{text}</p>
    </div>
  )
}
