import { Check } from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { useT } from '../i18n/useLang'
import type { PhotoElement, PhotoStyling } from '../types'
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_SHADOW_COLOR,
  MAX_BORDER,
  MAX_RADIUS,
  MAX_SHADOW_BLUR,
  MAX_SHADOW_OFFSET,
} from '../lib/photoStyling'
import { ColorField, Section, Slider } from './ui'

export function PhotoStyleSection({ photo }: { photo: PhotoElement }) {
  const t = useT()
  const updateElement = useEditor((s) => s.updateElement)
  const s = photo.styling ?? {}
  const rect = (photo.shape ?? 'rect') === 'rect'
  const set = (patch: Partial<PhotoStyling>) =>
    updateElement(photo.id, { styling: { ...s, ...patch } })

  return (
    <Section title={t('photoStyle.title')}>
      <Slider
        label={t('photoStyle.border')}
        min={0}
        max={MAX_BORDER}
        value={s.borderWidth ?? 0}
        onChange={(v) => set({ borderWidth: v })}
      />
      {!!s.borderWidth && (
        <ColorField
          label={t('photoStyle.borderColor')}
          value={s.borderColor ?? DEFAULT_BORDER_COLOR}
          onChange={(v) => set({ borderColor: v })}
        />
      )}
      {rect && (
        <Slider
          label={t('photoStyle.radius')}
          min={0}
          max={Math.min(MAX_RADIUS, Math.floor(Math.min(photo.width, photo.height) / 2))}
          value={s.radius ?? 0}
          onChange={(v) => set({ radius: v })}
        />
      )}
      <Slider
        label={t('photoStyle.shadowBlur')}
        min={0}
        max={MAX_SHADOW_BLUR}
        value={s.shadowBlur ?? 0}
        onChange={(v) => set({ shadowBlur: v })}
      />
      <Slider
        label={t('photoStyle.shadowOffset')}
        min={0}
        max={MAX_SHADOW_OFFSET}
        value={s.shadowOffset ?? 0}
        onChange={(v) => set({ shadowOffset: v })}
      />
      {!!(s.shadowBlur || s.shadowOffset) && (
        <ColorField
          label={t('photoStyle.shadowColor')}
          value={s.shadowColor ?? DEFAULT_SHADOW_COLOR}
          onChange={(v) => set({ shadowColor: v })}
        />
      )}
      {rect && (
        <button
          type="button"
          aria-pressed={!!s.polaroid}
          onClick={() => set({ polaroid: !s.polaroid })}
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg border px-3 text-sm transition active:scale-95 ${
            s.polaroid
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-border bg-surface-2 text-text/80 hover:bg-surface-3'
          }`}
        >
          {s.polaroid && <Check size={16} aria-hidden />}
          {t('photoStyle.polaroid')}
        </button>
      )}
    </Section>
  )
}
