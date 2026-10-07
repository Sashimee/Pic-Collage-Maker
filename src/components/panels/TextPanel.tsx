import { useState, useEffect, useCallback } from 'react'
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import { useEditor } from '../../store/editorStore'
import { FontUploader } from '../FontUploader'
import { loadCustomFonts } from '../../lib/fonts'
import { FONT_PACK } from '../../lib/fontPack'
import { analyzePhoto, getSuggestions } from '../../ai/textSuggestions'
import type { PhotoElement, TextElement, TextSpan } from '../../types'
import { ColorField, PrimaryButton, Section, Slider } from '../ui'
import { useT } from '../../i18n/useLang'
import { TextEffects } from './TextEffects'

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

const ALIGNS = [
  { id: 'left', Icon: AlignLeft, label: 'text.alignLeft' },
  { id: 'center', Icon: AlignCenter, label: 'text.alignCenter' },
  { id: 'right', Icon: AlignRight, label: 'text.alignRight' },
] as const

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
  const fontOptions = [
    ...FONTS,
    ...customFonts.filter((f) => !FONTS.includes(f) && !FONT_PACK.some((p) => p.family === f)),
  ]

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
                <optgroup label={t('font.pack')}>
                  {FONT_PACK.map(({ family }) => (
                    <option key={family} value={family}>
                      {family}
                    </option>
                  ))}
                </optgroup>
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
            <div role="group" aria-label={t('text.align')} className="flex gap-2">
              {ALIGNS.map(({ id, Icon, label }) => {
                const on = (text.align ?? 'left') === id
                return (
                  <button
                    key={id}
                    type="button"
                    aria-label={t(label)}
                    aria-pressed={on}
                    onClick={() => update(selectedId, { align: id })}
                    className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg border transition active:scale-95 ${
                      on
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-border bg-surface-2 text-text/80 hover:bg-surface-3'
                    }`}
                  >
                    <Icon size={18} aria-hidden />
                  </button>
                )
              })}
            </div>
            <Slider
              label={t('text.lineHeight')}
              min={0.8}
              max={2.5}
              step={0.05}
              value={text.lineHeight ?? 1.2}
              onChange={(v) => update(selectedId, { lineHeight: v })}
            />
            <Slider
              label={t('text.letterSpacing')}
              min={-5}
              max={40}
              value={text.letterSpacing ?? 0}
              onChange={(v) => update(selectedId, { letterSpacing: v })}
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

          <TextEffects text={text} selectedId={selectedId} />
        </>
      ) : (
        <EmptyHint icon="✏️" text={t('text.selectHint')} />
      )}
    </div>
  )
}

function EmptyHint({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span className="text-4xl opacity-30">{icon}</span>
      <p className="text-sm text-muted">{text}</p>
    </div>
  )
}
