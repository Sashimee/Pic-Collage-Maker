import { useEditor } from '../store/editorStore'
import { useT } from '../i18n/useLang'
import { Slider, ColorField, Section, Chip } from './ui'
import { m, SPRING } from './motion'
import type { WatermarkPosition } from '../types'
import { WorkspacePresets } from './WorkspacePresets'
import { GeneralSettings } from './GeneralSettings'
import { RefreshCcw } from 'lucide-react'
import { resetTips } from '../lib/firstUse'
import { useToasts } from './ToastContainer'

const POSITIONS: { label: string; value: WatermarkPosition }[] = [
  { label: 'Top Left', value: 'top-left' },
  { label: 'Top Right', value: 'top-right' },
  { label: 'Bottom Left', value: 'bottom-left' },
  { label: 'Bottom Right', value: 'bottom-right' },
  { label: 'Center', value: 'center' },
]

export function WatermarkPanel() {
  const t = useT()
  const watermark = useEditor((s) => s.watermark)
  const setWatermark = useEditor((s) => s.setWatermark)

  return (
    <div className="flex flex-col gap-4">
      <Section title={t('watermark.title')}>
        <label className="flex items-center justify-between gap-2 text-sm font-medium text-text/80">
          <span>{t('watermark.enabled')}</span>
          <button
            onClick={() => setWatermark({ enabled: !watermark.enabled })}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition ${
              watermark.enabled ? 'bg-accent' : 'bg-surface-3'
            }`}
            aria-pressed={watermark.enabled}
          >
            <m.span
              className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
              animate={{ x: watermark.enabled ? 22 : 4 }}
              transition={SPRING.toggle}
            />
          </button>
        </label>
      </Section>

      {watermark.enabled && (
        <>
          <Section title={t('watermark.text')}>
            <input
              type="text"
              value={watermark.text}
              onChange={(e) => setWatermark({ text: e.target.value })}
              placeholder={t('watermark.placeholder')}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
            />
          </Section>

          <Section title={t('watermark.position')}>
            <div className="grid grid-cols-2 gap-2">
              {POSITIONS.map((p) => (
                <Chip
                  key={p.value}
                  active={watermark.position === p.value}
                  onClick={() => setWatermark({ position: p.value })}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title={t('common.color')}>
            <ColorField
              label=""
              value={watermark.color}
              onChange={(v) => setWatermark({ color: v })}
            />
          </Section>

          <Section title={t('common.opacity')}>
            <Slider
              label=""
              min={0}
              max={100}
              step={1}
              value={Math.round(watermark.opacity * 100)}
              onChange={(v) => setWatermark({ opacity: v / 100 })}
            />
          </Section>

          <Section title={t('common.size')}>
            <Slider
              label=""
              min={12}
              max={72}
              step={1}
              value={watermark.fontSize}
              onChange={(v) => setWatermark({ fontSize: v })}
            />
          </Section>
        </>
      )}
    </div>
  )
}

export function PrintPanel() {
  const t = useT()
  const print = useEditor((s) => s.print)
  const setPrint = useEditor((s) => s.setPrint)

  return (
    <div className="flex flex-col gap-4">
      <Section title={t('print.title')}>
        <label className="flex items-center justify-between gap-2 text-sm font-medium text-text/80">
          <span>{t('print.enabled')}</span>
          <button
            onClick={() => setPrint({ enabled: !print.enabled })}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition ${
              print.enabled ? 'bg-accent' : 'bg-surface-3'
            }`}
            aria-pressed={print.enabled}
          >
            <m.span
              className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
              animate={{ x: print.enabled ? 22 : 4 }}
              transition={SPRING.toggle}
            />
          </button>
        </label>
      </Section>

      {print.enabled && (
        <>
          <Section title={t('print.bleed')}>
            <label className="flex items-center justify-between gap-2 text-sm font-medium text-text/80">
              <span>{t('print.bleedEnabled')}</span>
              <button
                onClick={() => setPrint({ bleedMarks: !print.bleedMarks })}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition ${
                  print.bleedMarks ? 'bg-accent' : 'bg-surface-3'
                }`}
                aria-pressed={print.bleedMarks}
              >
                <m.span
                  className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
                  animate={{ x: print.bleedMarks ? 22 : 4 }}
                  transition={SPRING.toggle}
                />
              </button>
            </label>
          </Section>

          <Section title={t('print.crop')}>
            <label className="flex items-center justify-between gap-2 text-sm font-medium text-text/80">
              <span>{t('print.cropEnabled')}</span>
              <button
                onClick={() => setPrint({ cropMarks: !print.cropMarks })}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition ${
                  print.cropMarks ? 'bg-accent' : 'bg-surface-3'
                }`}
                aria-pressed={print.cropMarks}
              >
                <m.span
                  className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
                  animate={{ x: print.cropMarks ? 22 : 4 }}
                  transition={SPRING.toggle}
                />
              </button>
            </label>
          </Section>

          <p className="text-xs text-muted">
            {t('print.hint')}
          </p>
        </>
      )}
    </div>
  )
}

/**
 * Replay the first-use tips.
 *
 * A once-only hint is otherwise gone forever — including for the person who
 * dismissed it by accident, and for anyone showing the app to someone else.
 */
function TipsPanel() {
  const t = useT()
  const toast = useToasts()
  return (
    <Section title={t('tips.title')}>
      <p className="text-[0.7rem] leading-relaxed text-muted">{t('tips.hint')}</p>
      <button
        onClick={() => {
          resetTips()
          toast.success(t('tips.reset'))
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-surface-3 active:scale-[0.99]"
      >
        <RefreshCcw size={14} /> {t('tips.replay')}
      </button>
    </Section>
  )
}

export function SettingsPanel() {
  return (
    <div className="flex flex-col gap-6">
      <GeneralSettings />
      <WorkspacePresets />
      <WatermarkPanel />
      <PrintPanel />
      <TipsPanel />
    </div>
  )
}
