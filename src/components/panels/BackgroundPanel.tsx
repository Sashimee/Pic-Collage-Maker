import { ImagePlus } from 'lucide-react'
import { useEditor } from '../../store/editorStore'
import { PATTERN_GLYPH, PATTERN_IDS } from '../../lib/patterns'
import type { FrameStyle } from '../../types'
import { Chip, ColorField, Section, Slider } from '../ui'
import { useT } from '../../i18n/useLang'
import { putPhoto } from '../../lib/persistence'
import { backgroundKey } from '../../lib/photoRehydrate'

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
                  className="bg-grad-accent flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-accent transition hover:brightness-110 active:scale-95"
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
