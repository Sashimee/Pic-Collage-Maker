import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { useLang, useT } from '../i18n/useLang'
import { useToasts } from './ToastContainer'
import { backgroundStyle } from '../lib/pagePreview'
import { cellRect, getGridById } from '../lib/grids'
import { track } from '../lib/analytics'
import type { Background } from '../types'
import { templateBlocker, templateFromBoard } from '../lib/templates/fromBoard'
import {
  createUserTemplate,
  deleteUserTemplate,
  listUserTemplates,
  saveUserTemplate,
  type UserTemplate,
} from '../services/localTemplates'
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

// The thumbnail draws the template's text, so the button's name has to contain all of
// it (WCAG 2.5.3, label in name), not just the title it is filed under.
const thumbText = (doc: TemplateDocument) =>
  doc.elements
    .flatMap((el) => (el.type === 'text' ? [el.text.replace(/\s+/g, ' ').trim()] : []))
    .join(' ')

const mineLabel = (name: string, doc: TemplateDocument) => {
  const text = thumbText(doc)
  if (!text || name.includes(text)) return name
  return text.includes(name) ? text : `${name}: ${text}`
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
          // The space keeps adjacent lines apart in the text the label is checked against.
          <Fragment key={i}>
            {' '}
            <span
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
          </Fragment>
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

/** "Summer", then "Summer 2", "Summer 3"…, so two saved templates never share a name. */
function uniqueName(base: string, taken: string[]) {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base} ${n}`)) n++
  return `${base} ${n}`
}

function MyTemplates({ apply }: { apply: (doc: TemplateDocument) => void }) {
  const t = useT()
  const toast = useToasts()
  const hintId = useId()
  const blocker = useEditor(templateBlocker)
  const hint = blocker === 'customLayout' ? t('tpl.saveNoCustom') : t('tpl.saveNeedsLayout')
  const canSave = !blocker
  const saving = useRef(false)
  const [mine, setMine] = useState<UserTemplate[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const saveButton = useRef<HTMLButtonElement>(null)
  const itemButtons = useRef(new Map<string, HTMLButtonElement>())

  const refresh = useCallback(async () => {
    try {
      const list = await listUserTemplates()
      setMine(list)
      setLoadFailed(false)
      return list
    } catch (err) {
      console.error('Saved templates failed to load', err)
      setLoadFailed(true)
      return null
    }
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])

  const save = async () => {
    const doc = templateFromBoard(useEditor.getState())
    if (!doc) {
      toast.info(hint)
      return
    }
    if (saving.current) return
    saving.current = true
    const title = doc.elements.find((e) => e.type === 'text')
    const base = (title?.type === 'text' && title.text.split('\n')[0].trim()) || t('tpl.untitled')
    try {
      const taken = (await listUserTemplates()).map((m) => m.name)
      await createUserTemplate(uniqueName(base, taken), doc)
      toast.success(t('tpl.saved'))
      await refresh()
    } catch (err) {
      console.error('Saving the template failed', err)
      toast.error(t('tpl.saveFailed'))
    } finally {
      saving.current = false
    }
  }

  const remove = async (tpl: UserTemplate, index: number) => {
    const hadFocus = !!document.activeElement?.closest(`[data-template="${tpl.id}"]`)
    try {
      await deleteUserTemplate(tpl.id)
    } catch (err) {
      console.error('Deleting the template failed', err)
      toast.error(t('tpl.deleteFailed'))
      return
    }
    toast.action(t('tpl.deleted'), {
      label: t('header.undo'),
      onClick: () =>
        saveUserTemplate(tpl).then(refresh, (err) => {
          console.error('Restoring the template failed', err)
          toast.error(t('tpl.saveFailed'))
        }),
    })
    const list = await refresh()
    // The deleted item took the focused button with it; land on its neighbour instead of <body>.
    if (!hadFocus) return
    const next = list?.[Math.min(index, list.length - 1)]
    ;(next ? itemButtons.current.get(next.id) : saveButton.current)?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        ref={saveButton}
        onClick={save}
        // Stays focusable when unavailable, so a keyboard user can still reach it and hear why.
        aria-disabled={!canSave}
        aria-describedby={canSave ? undefined : hintId}
        className="min-h-[44px] rounded-xl bg-surface-2 px-3 text-sm font-medium text-text transition hover:bg-surface-3 active:scale-95 aria-disabled:opacity-50"
      >
        {t('tpl.saveMine')}
      </button>
      {!canSave && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {loadFailed ? (
        <div role="alert" className="flex items-center gap-2 text-sm text-muted">
          <p>{t('tpl.mineFailed')}</p>
          <button
            onClick={() => location.reload()}
            className="min-h-[44px] shrink-0 rounded-lg bg-surface-2 px-3 font-medium text-text hover:bg-surface-3"
          >
            {t('common.refresh')}
          </button>
        </div>
      ) : mine === null ? (
        <p role="status" className="min-h-[44px] text-sm text-muted">
          {t('tpl.loading')}
        </p>
      ) : mine.length === 0 ? (
        <p className="text-sm text-muted">{t('tpl.mineEmpty')}</p>
      ) : (
        <ul aria-label={t('tpl.catMine')} className="scroll-x flex gap-2 overflow-x-auto p-1">
          {mine.map((tpl, i) => (
            <li key={tpl.id} data-template={tpl.id} className="relative shrink-0">
              <button
                ref={(el) => {
                  if (el) itemButtons.current.set(tpl.id, el)
                  else itemButtons.current.delete(tpl.id)
                }}
                onClick={() => apply(tpl.doc)}
                aria-label={mineLabel(tpl.name, tpl.doc)}
                title={tpl.name}
                className="flex h-[112px] w-[112px] items-center justify-center rounded-xl bg-surface-2 transition hover:bg-surface-3 active:scale-95"
              >
                <TemplateThumb doc={tpl.doc} />
              </button>
              <button
                onClick={() => remove(tpl, i)}
                aria-label={`${t('tpl.deleteMine')}: ${tpl.name}`}
                title={`${t('tpl.deleteMine')}: ${tpl.name}`}
                className="absolute right-0 top-0 flex h-[44px] w-[44px] items-center justify-center rounded-full text-muted hover:text-text"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow">
                  <Trash2 size={14} aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const [category, setCategory] = useState<TemplateCategory | 'mine'>('occasions')

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
        <button
          onClick={() => setCategory('mine')}
          aria-pressed={category === 'mine'}
          className={`min-h-[44px] shrink-0 rounded-full px-3 text-xs font-semibold transition ${
            category === 'mine'
              ? 'bg-accent text-accent-fg'
              : 'bg-surface-2 text-muted hover:bg-surface-3'
          }`}
        >
          {t('tpl.catMine')}
        </button>
      </div>
      {category === 'mine' ? (
        <MyTemplates apply={apply} />
      ) : (
        <ul
          aria-label={t(mod.TEMPLATE_CATEGORIES.find((c) => c.id === category)!.labelKey)}
          className="scroll-x flex gap-2 overflow-x-auto p-1"
        >
          {built.map(({ tpl, doc }) => {
            const text = thumbText(doc)
            const aspect = t(`aspect.${tpl.size}`)
            const name = text ? `${text}, ${aspect}` : aspect
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
      )}
    </div>
  )
}
