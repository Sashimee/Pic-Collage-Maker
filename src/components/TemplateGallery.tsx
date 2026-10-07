import { useEffect, useMemo, useState } from 'react'
import { useEditor } from '../store/editorStore'
import { useLang, useT } from '../i18n/useLang'
import { useToasts } from './ToastContainer'
import { backgroundStyle } from '../lib/pagePreview'
import { cellRect, getGridById } from '../lib/grids'
import { track } from '../lib/analytics'
import type { Background } from '../types'
import type { TemplateCategory, TemplateDocument } from '../lib/templates'

type TemplatesModule = typeof import('../lib/templates')

const THUMB = 96

const PREVIEW_BACKGROUND: Background = {
  type: 'solid',
  color: '#ffffff',
  gradientFrom: '#ffffff',
  gradientTo: '#ffffff',
  gradientAngle: 0,
  patternId: 'dots',
  patternColor: '#000000',
}

function TemplateThumb({ doc }: { doc: TemplateDocument }) {
  const scale = THUMB / Math.max(doc.boardWidth, doc.boardHeight)
  const layout = getGridById(doc.gridId)
  return (
    <span
      className="relative block overflow-hidden rounded-md shadow-sm"
      style={{ width: doc.boardWidth * scale, height: doc.boardHeight * scale }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0"
        style={backgroundStyle({ ...PREVIEW_BACKGROUND, ...doc.background })}
      />
      {layout?.cells.map((cell, i) => {
        const r = cellRect(cell, doc.boardWidth, doc.boardHeight, doc.gridGap, doc.gridMargin)
        return (
          <span
            key={i}
            className="absolute bg-[#cbd5e1]"
            style={{
              left: r.x * scale,
              top: r.y * scale,
              width: r.w * scale,
              height: r.h * scale,
              borderRadius:
                cell.shape === 'ellipse' || cell.shape === 'circle'
                  ? '50%'
                  : doc.gridRadius * scale,
            }}
          />
        )
      })}
      {doc.elements.map((el, i) =>
        el.type === 'text' ? (
          <span
            key={i}
            className="absolute whitespace-pre-wrap"
            style={{
              left: el.x * scale,
              top: el.y * scale,
              width: el.width !== undefined ? el.width * scale : undefined,
              textAlign: el.align,
              fontFamily: el.fontFamily,
              fontSize: el.fontSize * scale,
              fontWeight: el.fontStyle.includes('bold') ? 700 : 400,
              fontStyle: el.fontStyle.includes('italic') ? 'italic' : undefined,
              lineHeight: el.lineHeight ?? 1,
              color: el.fill,
              background: el.chip?.color,
              padding: el.chip ? el.chip.padding * scale : undefined,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              transformOrigin: 'top left',
            }}
          >
            {el.text}
          </span>
        ) : (
          <span
            key={i}
            className="absolute leading-none"
            style={{ left: el.x * scale, top: el.y * scale, fontSize: el.fontSize * scale }}
          >
            {el.emoji}
          </span>
        ),
      )}
    </span>
  )
}

/** Designed starting points: a layout, words and a background, waiting for photos. */
export function TemplateGallery({ onApplied }: { onApplied?: () => void }) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const toast = useToasts()
  const applyTemplate = useEditor((s) => s.applyTemplate)
  const [mod, setMod] = useState<TemplatesModule | null>(null)
  const [failed, setFailed] = useState(false)
  const [category, setCategory] = useState<TemplateCategory>('occasions')

  useEffect(() => {
    let live = true
    import('../lib/templates').then(
      (m) => live && setMod(m),
      (err) => {
        console.error('Templates failed to load', err)
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [])

  const built = useMemo(
    () =>
      mod?.TEMPLATES.filter((tpl) => tpl.category === category).map((tpl) => ({
        tpl,
        doc: mod.buildTemplate(tpl, t, lang),
      })) ?? [],
    [mod, category, t, lang],
  )

  if (failed) {
    // A failed dynamic import stays cached for the page's lifetime, so only a reload retries it.
    return (
      <div role="alert" className="flex items-center gap-2 text-sm text-muted">
        <p>{t('tpl.failed')}</p>
        <button
          onClick={() => location.reload()}
          className="min-h-[44px] shrink-0 rounded-lg bg-surface-2 px-3 font-medium text-text hover:bg-surface-3"
        >
          {t('common.refresh')}
        </button>
      </div>
    )
  }
  if (!mod) {
    return (
      <p role="status" className="min-h-[44px] text-sm text-muted">
        {t('tpl.loading')}
      </p>
    )
  }

  const apply = (doc: TemplateDocument) => {
    applyTemplate(doc)
    track('template')
    toast.info(t('tpl.applied'))
    onApplied?.()
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={t('tpl.title')}
        className="scroll-x flex gap-1 overflow-x-auto p-1"
      >
        {mod.TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            aria-pressed={category === c.id}
            className={`min-h-[44px] shrink-0 rounded-full px-3 text-xs font-semibold transition ${
              category === c.id
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-muted hover:bg-surface-3'
            }`}
          >
            {t(c.labelKey)}
          </button>
        ))}
      </div>
      <ul
        aria-label={t(mod.TEMPLATE_CATEGORIES.find((c) => c.id === category)!.labelKey)}
        className="scroll-x flex gap-2 overflow-x-auto p-1"
      >
        {built.map(({ tpl, doc }) => {
          const title = doc.elements.find((e) => e.type === 'text')
          const name = `${title?.type === 'text' ? title.text.split('\n')[0] : ''}, ${t(`aspect.${tpl.size}`)}`
          return (
            <li key={tpl.id} className="shrink-0">
              <button
                onClick={() => apply(mod.buildTemplate(tpl, t, lang))}
                aria-label={name}
                title={name}
                className="flex h-[112px] w-[112px] items-center justify-center rounded-xl bg-surface-2 transition hover:bg-surface-3 active:scale-95"
              >
                <TemplateThumb doc={doc} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
