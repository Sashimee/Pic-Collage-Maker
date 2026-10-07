import { useEffect, useId, useRef } from 'react'
import { useEditor } from '../store/editorStore'
import { useT } from '../i18n/useLang'
import { EXPORT_PRESETS, PRESET_CATEGORIES, type ExportPreset } from '../lib/exportPresets'

function PresetThumb({ w, h, active }: { w: number; h: number; active: boolean }) {
  const box = 36
  const scale = box / Math.max(w, h)
  return (
    <span
      className={`flex h-[42px] w-[42px] items-center justify-center rounded-lg ${
        active ? 'bg-accent/20' : 'bg-surface-3'
      }`}
      aria-hidden="true"
    >
      <span
        style={{ width: w * scale, height: h * scale }}
        className={`rounded-[3px] ${active ? 'bg-accent' : 'bg-muted/60'}`}
      />
    </span>
  )
}

/** Named board sizes for social networks, print and screens, grouped by where they go. */
export function SizePresets({
  onPick,
  autoFocus = false,
}: {
  onPick?: (preset: ExportPreset) => void
  autoFocus?: boolean
}) {
  const t = useT()
  const idPrefix = useId()
  const boardWidth = useEditor((s) => s.boardWidth)
  const boardHeight = useEditor((s) => s.boardHeight)
  const setBoardSize = useEditor((s) => s.setBoardSize)
  // Story and reel share a size; only the first match shows as current.
  const activeId = EXPORT_PRESETS.find(
    (p) => p.width === boardWidth && p.height === boardHeight,
  )?.id
  const focusTarget = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (autoFocus) focusTarget.current?.focus()
  }, [autoFocus])

  return (
    <div className="flex flex-col gap-3">
      {PRESET_CATEGORIES.map((cat) => (
        <div key={cat.id} role="group" aria-labelledby={`${idPrefix}-${cat.id}`}>
          <p
            id={`${idPrefix}-${cat.id}`}
            className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted"
          >
            {t(cat.labelKey)}
          </p>
          <ul className="scroll-x flex gap-2 overflow-x-auto p-1">
            {EXPORT_PRESETS.filter((p) => p.category === cat.id).map((p) => {
              const active = p.id === activeId
              const focused = activeId ? active : p === EXPORT_PRESETS[0]
              return (
                <li key={p.id} className="shrink-0">
                  <button
                    ref={focused ? focusTarget : undefined}
                    onClick={() => {
                      setBoardSize(p.width, p.height)
                      onPick?.(p)
                    }}
                    aria-pressed={active}
                    title={`${p.width} × ${p.height}`}
                    className={`flex min-h-[44px] w-[76px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-[0.65rem] font-medium leading-tight transition active:scale-95 ${
                      active
                        ? 'bg-accent/15 text-text ring-2 ring-accent'
                        : 'text-muted hover:bg-surface-3'
                    }`}
                  >
                    <PresetThumb w={p.width} h={p.height} active={active} />
                    <span>{t(p.labelKey)}</span>
                    <span className="sr-only">{`${p.width} × ${p.height}`}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
