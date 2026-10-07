import { useState } from 'react'
import { Trash2, GripVertical, Plus, Wand2, Sparkles } from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { FILTER_PRESETS, computeFilterConfigFromStack, photoStack } from '../lib/filters'
import { useT } from '../i18n/useLang'
import type { FilterOperation, FilterPreset } from '../types'
import { Chip, Section, Slider } from './ui'
import { useToasts } from './ToastContainer'
import { PhotoStyleSection } from './PhotoStyleSection'
import { AdjustSection } from './AdjustSection'
import { autoEnhance, applyStyleTransfer } from '../ai/tools'
import { STYLE_OPTIONS } from '../ai/styleTransfer'

const ADVANCED_LABELS: Partial<Record<FilterOperation['type'], string>> = {
  levels: 'adjust.levels',
  curves: 'adjust.curves',
  hsl: 'adjust.hsl',
  lut: 'adjust.lut',
}

const FILTER_OPS = [
  { type: 'brightness', labelKey: 'filter.brightness', min: -1, max: 1, step: 0.02, default: 0 },
  { type: 'contrast', labelKey: 'filter.contrast', min: -100, max: 100, step: 1, default: 0 },
  { type: 'saturation', labelKey: 'filter.saturation', min: -2, max: 4, step: 0.1, default: 0 },
  { type: 'hueShift', labelKey: 'filter.hue', min: -180, max: 180, step: 5, default: 0 },
  { type: 'temperature', labelKey: 'filter.temperature', min: -100, max: 100, step: 1, default: 0 },
  { type: 'tint', labelKey: 'filter.tint', min: -100, max: 100, step: 1, default: 0 },
  { type: 'exposure', labelKey: 'filter.exposure', min: -1, max: 1, step: 0.05, default: 0 },
  { type: 'shadows', labelKey: 'filter.shadows', min: -1, max: 1, step: 0.05, default: 0 },
  { type: 'highlights', labelKey: 'filter.highlights', min: -1, max: 1, step: 0.05, default: 0 },
  { type: 'blur', labelKey: 'filter.blur', min: 0, max: 40, step: 1, default: 0 },
  { type: 'vignette', labelKey: 'filter.vignette', min: 0, max: 0.9, step: 0.05, default: 0 },
] as const

export function FilterPanel() {
  const t = useT()
  const toast = useToasts()
  const selectedId = useEditor((s) => s.selectedId)
  const el = useEditor((s) => s.elements.find((e) => e.id === s.selectedId))
  const updateFilterStack = useEditor((s) => s.updateFilterStack)
  const updateElement = useEditor((s) => s.updateElement)
  const updateFilters = useEditor((s) => s.updateFilters)
  const gridMode = useEditor((s) => s.mode === 'grid')
  const photo = el?.type === 'photo' ? el : null
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  if (!photo || !selectedId) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="text-4xl opacity-30">✨</span>
        <p className="text-sm text-muted">{t('filter.selectHint')}</p>
      </div>
    )
  }

  // Use v2 filterStack, or derive from v1 filters
  const stack: FilterOperation[] = photoStack(photo.filterStack, photo.filters)

  const updateStack = (next: FilterOperation[]) => {
    updateFilterStack(selectedId, next)
  }

  const updateOp = (index: number, patch: Partial<FilterOperation>) => {
    const next = [...stack]
    next[index] = { ...next[index], ...patch } as FilterOperation
    updateStack(next)
  }

  const removeOp = (index: number) => {
    const next = stack.filter((_, i) => i !== index)
    updateStack(next)
    toast.info(t('filter.removed'))
  }

  const addOp = (type: (typeof FILTER_OPS)[number]['type']) => {
    const def = FILTER_OPS.find((o) => o.type === type)
    if (!def) return
    const newOp: FilterOperation =
      type === 'blur'
        ? { type: 'blur', radius: def.default }
        : type === 'vignette'
          ? { type: 'vignette', strength: def.default }
          : { type, value: def.default }
    updateStack([...stack, newOp])
    setExpanded((prev) => new Set(prev).add(stack.length))
  }

  const addPreset = (id: FilterPreset) => {
    const next = stack.filter((op) => op.type !== 'preset') as FilterOperation[]
    if (id !== 'none') {
      next.push({ type: 'preset', id })
    }
    updateStack(next)
  }

  const resetFilters = () => {
    updateStack([
      { type: 'brightness', value: 0 },
      { type: 'contrast', value: 0 },
      { type: 'saturation', value: 0 },
      { type: 'preset', id: 'none' },
    ])
    updateFilters(selectedId, { brightness: 0, contrast: 0, saturation: 0, preset: 'none', blur: 0, vignette: 0 })
    toast.success(t('filter.resetAll'))
  }

  // Quick preview config
  const preview = computeFilterConfigFromStack(stack)

  return (
    <div className="flex flex-col gap-4">
      {/* Preview thumbnail */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
        <img
          src={photo.src}
          alt=""
          className="h-32 w-full object-cover opacity-70"
          style={{
            filter: `brightness(${1 + preview.brightness}) contrast(${1 + preview.contrast / 100}) saturate(${1 + preview.saturation / 3})`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-lg bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {stack.length} {t('filter.countLabel')}
          </span>
        </div>
      </div>

      {/* Presets */}
      <Section title={t('filter.presets')}>
        <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
          {FILTER_PRESETS.map((p) => {
            const hasPreset = stack.some((op) => op.type === 'preset' && op.id === p.id)
            return (
              <Chip
                key={p.id}
                active={hasPreset}
                onClick={() => addPreset(p.id)}
              >
                {t('filter.' + p.id)}
              </Chip>
            )
          })}
        </div>
      </Section>

      {/* Filter stack */}
      <Section title={t('filter.stackTitle')}>
        <div className="flex flex-col gap-1">
          {stack.map((op, i) => {
            const isExpanded = expanded.has(i)
            const label =
              op.type === 'preset'
                ? `${t('filter.presetLabel')}: ${t('filter.' + op.id)}`
                : op.type === 'lut'
                  ? `${t('adjust.lut')}: ${op.name}`
                  : ADVANCED_LABELS[op.type]
                    ? t(ADVANCED_LABELS[op.type]!)
                    : t(FILTER_OPS.find((o) => o.type === op.type)?.labelKey ?? '') || op.type

            const value =
              op.type === 'preset' || op.type in ADVANCED_LABELS
                ? ''
                : op.type === 'blur'
                  ? op.radius
                  : op.type === 'vignette'
                    ? op.strength
                    : 'value' in op
                      ? op.value
                      : 0

            return (
              <div
                key={`${op.type}-${i}`}
                className="rounded-lg border border-border/50 bg-surface-2 transition hover:border-border"
              >
                <div className="flex items-center">
                  {value !== '' ? (
                    <button
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev)
                          if (next.has(i)) next.delete(i)
                          else next.add(i)
                          return next
                        })
                      }
                      className="flex min-h-[44px] flex-1 items-center gap-2 px-3 text-left text-sm"
                    >
                      <GripVertical size={14} className="text-muted" />
                      <span className="flex-1 font-medium">{label}</span>
                      <span className="text-xs text-muted">
                        {typeof value === 'number' ? value.toFixed(1) : value}
                      </span>
                    </button>
                  ) : (
                    <span className="flex min-h-[44px] flex-1 items-center gap-2 px-3 text-sm">
                      <GripVertical size={14} className="text-muted" />
                      <span className="flex-1 font-medium">{label}</span>
                    </span>
                  )}
                  <button
                    onClick={() => removeOp(i)}
                    aria-label={`${t('sel.delete')}: ${label}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>

                {isExpanded && value !== '' && (
                  <div className="px-3 pb-2">
                    <Slider
                      label=""
                      min={FILTER_OPS.find((o) => o.type === op.type)?.min ?? -1}
                      max={FILTER_OPS.find((o) => o.type === op.type)?.max ?? 1}
                      step={FILTER_OPS.find((o) => o.type === op.type)?.step ?? 0.1}
                      value={value as number}
                      onChange={(v) => {
                        if (op.type === 'blur') updateOp(i, { radius: v })
                        else if (op.type === 'vignette') updateOp(i, { strength: v })
                        else updateOp(i, { value: v })
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add filter dropdown */}
        <div className="flex flex-wrap gap-1 pt-1">
          {FILTER_OPS.map((op) => (
            <button
              key={op.type}
              onClick={() => addOp(op.type)}
              className="flex items-center gap-1 rounded-md bg-surface-3 px-2 py-1 text-xs text-muted transition hover:text-text"
            >
              <Plus size={12} />
              {t(op.labelKey)}
            </button>
          ))}
        </div>
      </Section>

      <AdjustSection photoId={selectedId} stack={stack} onChange={updateStack} />

      {/* Artistic styles (destructive: replaces the photo bitmap) */}
      <Section title={t('style.title')}>
        <div className="scroll-x flex gap-2 overflow-x-auto pb-1">
          {STYLE_OPTIONS.filter((s) => s.id !== 'none').map((s) => (
            <button
              key={s.id}
              onClick={async () => {
                if (!photo?.src) return
                toast.info(t('style.applying'))
                try {
                  const out = await applyStyleTransfer(photo.src, s.id)
                  updateElement(selectedId, { src: out })
                  toast.success(t('style.applied'))
                } catch {
                  toast.error(t('style.failed'))
                }
              }}
              className="flex shrink-0 flex-col items-center gap-1 rounded-xl bg-surface-2 px-3 py-2 text-[0.7rem] font-medium text-text transition hover:bg-surface-3 active:scale-95"
            >
              <span className="text-lg">{s.emoji}</span>
              {t('style.' + s.id)}
            </button>
          ))}
        </div>
      </Section>

      {!gridMode && <PhotoStyleSection photo={photo} />}

      {/* Auto-enhance */}
      <button
        onClick={async () => {
          if (!photo?.src) return
          try {
            const enhanced = await autoEnhance(photo.src, {
              autoContrast: true,
              autoWhiteBalance: true,
              sharpen: true,
            })
            updateElement(selectedId, { src: enhanced })
            toast.success(t('toast.enhanced'))
          } catch {
            toast.error(t('toast.enhanceFailed'))
          }
        }}
        className="flex items-center justify-center gap-2 rounded-lg bg-accent/10 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20"
      >
        <Sparkles size={16} />
        {t('filter.autoEnhance')}
      </button>

      {/* Reset */}
      <button
        onClick={resetFilters}
        className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 py-2.5 text-sm text-muted transition hover:text-text"
      >
        <Wand2 size={16} />
        {t('filter.resetBtn')}
      </button>
    </div>
  )
}
