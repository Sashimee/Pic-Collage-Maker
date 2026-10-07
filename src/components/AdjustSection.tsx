import { useEffect, useId, useRef, useState } from 'react'
import { Eye, Upload } from 'lucide-react'
import { useT } from '../i18n/useLang'
import { HSL_BANDS, parseCube } from '../lib/adjustments'
import { useFilterCompare } from '../lib/filters'
import type { CurvePoint, FilterOperation, HslAdjust, HslBand, ToneChannel } from '../types'
import { Section, Slider } from './ui'
import { useToasts } from './ToastContainer'

type Op<T extends FilterOperation['type']> = Extract<FilterOperation, { type: T }>

const CURVE_INPUTS = [64, 128, 192] as const
const CHANNELS: { id: ToneChannel; label: string; nameKey: string }[] = [
  { id: 'rgb', label: 'RGB', nameKey: 'adjust.allChannels' },
  { id: 'r', label: 'R', nameKey: 'adjust.band.red' },
  { id: 'g', label: 'G', nameKey: 'adjust.band.green' },
  { id: 'b', label: 'B', nameKey: 'adjust.band.blue' },
]
const SWATCH_EDGE = 'inset 0 0 0 1px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.6)'
const NO_HSL: HslAdjust = { hue: 0, saturation: 0, lightness: 0 }

const toggleClass = (on: boolean) =>
  `min-h-[44px] min-w-[44px] rounded-lg px-3 text-sm font-medium transition ${
    on ? 'bg-accent font-bold text-white' : 'bg-surface-2 text-text/80 hover:bg-surface-3'
  }`

function curveOutput(points: CurvePoint[] | undefined, x: number): number {
  return points?.find((p) => p[0] === x)?.[1] ?? x
}

/** Levels, curves, per-band HSL, .cube LUTs and hold-to-compare for one photo. */
export function AdjustSection({
  photoId,
  stack,
  onChange,
}: {
  photoId: string
  stack: FilterOperation[]
  onChange: (next: FilterOperation[]) => void
}) {
  const t = useT()
  const toast = useToasts()
  const fileRef = useRef<HTMLInputElement>(null)
  const [channel, setChannel] = useState<ToneChannel>('rgb')
  const [band, setBand] = useState<HslBand>('red')
  const channelLabel = useId()
  const bandLabel = useId()

  const find = <T extends FilterOperation['type']>(type: T) =>
    stack.find((op): op is Op<T> => op.type === type)
  const put = (op: FilterOperation) => {
    const at = stack.findIndex((o) => o.type === op.type)
    onChange(at < 0 ? [...stack, op] : stack.map((o, i) => (i === at ? op : o)))
  }

  const levels = find('levels') ?? { type: 'levels', black: 0, white: 255, gamma: 1 }
  const curves = find('curves') ?? { type: 'curves', channels: {} }
  const hsl = find('hsl') ?? { type: 'hsl', bands: {} }
  const lut = find('lut')
  const points = curves.channels[channel]
  const bandValues = hsl.bands[band] ?? NO_HSL
  const channelName = t(CHANNELS.find((c) => c.id === channel)!.nameKey)
  const bandName = t('adjust.band.' + band)

  const setCurve = (x: number, y: number) => {
    const next: CurvePoint[] = CURVE_INPUTS.map((input) => [
      input,
      input === x ? y : curveOutput(points, input),
    ])
    put({ ...curves, channels: { ...curves.channels, [channel]: next } })
  }

  const importLut = async (file: File) => {
    try {
      put(parseCube(await file.text(), file.name.replace(/\.cube$/i, '')))
    } catch (err) {
      console.error(err)
      toast.error(`${t('adjust.lutFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const comparing = useFilterCompare((s) => s.id === photoId)
  const compare = (on: boolean) => useFilterCompare.setState({ id: on ? photoId : null })
  useEffect(
    () => () => {
      if (useFilterCompare.getState().id === photoId) useFilterCompare.setState({ id: null })
    },
    [photoId],
  )

  return (
    <Section title={t('adjust.title')}>
      {/* Hold with a pointer; a keyboard or screen-reader click (detail 0) toggles. */}
      <button
        type="button"
        aria-pressed={comparing}
        onPointerDown={() => compare(true)}
        onPointerUp={() => compare(false)}
        onPointerLeave={() => compare(false)}
        onPointerCancel={() => compare(false)}
        onClick={(e) => {
          if (e.detail === 0) compare(!comparing)
        }}
        onBlur={() => compare(false)}
        onContextMenu={(e) => e.preventDefault()}
        className="flex min-h-[44px] touch-none select-none items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-sm text-text/80 transition active:bg-surface-3"
      >
        <Eye size={16} aria-hidden />
        {t('adjust.compare')}
      </button>

      <h4 className="pt-1 text-xs font-semibold text-text/80">{t('adjust.levels')}</h4>
      <Slider
        label={t('adjust.black')}
        min={0}
        max={levels.white - 5}
        value={levels.black}
        onChange={(v) => put({ ...levels, black: Math.min(v, levels.white - 5) })}
      />
      <Slider
        label={t('adjust.gamma')}
        min={0.2}
        max={3}
        step={0.05}
        value={levels.gamma}
        onChange={(v) => put({ ...levels, gamma: v })}
      />
      <Slider
        label={t('adjust.white')}
        min={levels.black + 5}
        max={255}
        value={levels.white}
        onChange={(v) => put({ ...levels, white: Math.max(v, levels.black + 5) })}
      />

      <h4 className="pt-1 text-xs font-semibold text-text/80">{t('adjust.curves')}</h4>
      <span id={channelLabel} className="sr-only">
        {t('adjust.channel')}
      </span>
      <div role="group" aria-labelledby={channelLabel} className="flex gap-1.5">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={channel === c.id}
            aria-label={`${c.label} – ${t(c.nameKey)}`}
            onClick={() => setChannel(c.id)}
            className={toggleClass(channel === c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {CURVE_INPUTS.map((x, i) => (
        <Slider
          key={x}
          label={`${channelName} · ${t(['filter.shadows', 'adjust.midtones', 'filter.highlights'][i])}`}
          min={0}
          max={255}
          value={curveOutput(points, x)}
          onChange={(y) => setCurve(x, y)}
        />
      ))}

      <h4 className="pt-1 text-xs font-semibold text-text/80">{t('adjust.hsl')}</h4>
      <span id={bandLabel} className="sr-only">
        {t('adjust.band')}
      </span>
      <div role="group" aria-labelledby={bandLabel} className="flex flex-wrap gap-1.5">
        {HSL_BANDS.map((b) => (
          <button
            key={b.band}
            type="button"
            aria-pressed={band === b.band}
            aria-label={t('adjust.band.' + b.band)}
            title={t('adjust.band.' + b.band)}
            onClick={() => setBand(b.band)}
            style={{ background: b.swatch, boxShadow: SWATCH_EDGE }}
            className={`h-11 w-11 rounded-full transition active:scale-90 ${
              band === b.band ? 'border-[3px] border-text' : ''
            }`}
          />
        ))}
      </div>
      <Slider
        label={`${bandName} · ${t('filter.hue')}`}
        min={-30}
        max={30}
        value={bandValues.hue}
        onChange={(v) =>
          put({ ...hsl, bands: { ...hsl.bands, [band]: { ...bandValues, hue: v } } })
        }
      />
      <Slider
        label={`${bandName} · ${t('filter.saturation')}`}
        min={-1}
        max={1}
        step={0.05}
        value={bandValues.saturation}
        onChange={(v) =>
          put({ ...hsl, bands: { ...hsl.bands, [band]: { ...bandValues, saturation: v } } })
        }
      />
      <Slider
        label={`${bandName} · ${t('adjust.lightness')}`}
        min={-1}
        max={1}
        step={0.05}
        value={bandValues.lightness}
        onChange={(v) =>
          put({ ...hsl, bands: { ...hsl.bands, [band]: { ...bandValues, lightness: v } } })
        }
      />

      <h4 className="pt-1 text-xs font-semibold text-text/80">{t('adjust.lut')}</h4>
      <input
        ref={fileRef}
        type="file"
        accept=".cube"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void importLut(file)
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-sm text-text/80 transition hover:bg-surface-3"
      >
        <Upload size={16} aria-hidden />
        {lut ? `${t('adjust.importLut')} (${lut.name})` : t('adjust.importLut')}
      </button>
      {lut && (
        <Slider
          label={t('adjust.lutStrength')}
          min={0}
          max={1}
          step={0.05}
          value={lut.amount}
          onChange={(v) => put({ ...lut, amount: v })}
        />
      )}
    </Section>
  )
}
