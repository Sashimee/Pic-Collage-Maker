import { lazy, Suspense, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Palette } from 'lucide-react'
import { useT } from '../i18n/useLang'
import { useColours } from '../lib/palette'
import { m } from './motion'

const ColourTools = lazy(() => import('./ColourTools').then((m) => ({ default: m.ColourTools })))

const TAP = { scale: 0.94 }

export function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted">
      <span className="flex justify-between">
        <span className="font-medium text-text/80">{label}</span>
        <span className="tabular-nums text-muted">{Math.round(value * 100) / 100}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  )
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const t = useT()
  const id = useId()
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // React's onChange is the native `input` event, which fires on every drag of
  // the picker; `change` fires once, when the colour is committed.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const remember = () => useColours.getState().remember(input.value)
    input.addEventListener('change', remember)
    return () => input.removeEventListener('change', remember)
  }, [])

  const openNativePicker = () => {
    const input = inputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') input.showPicker()
    else input.click()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-text/80">
        <label htmlFor={`${id}-input`}>{label}</label>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-tools`}
            aria-label={label ? `${label}: ${t('color.tools')}` : t('color.tools')}
            title={t('color.tools')}
            onClick={() => setOpen((o) => !o)}
            className={`flex h-11 w-11 items-center justify-center rounded-lg border transition active:scale-95 ${
              open ? 'border-accent text-accent' : 'border-border text-text/70 hover:bg-surface-3'
            }`}
          >
            <Palette size={16} aria-hidden />
          </button>
          <span className="relative h-11 w-14 overflow-hidden rounded-lg border border-border">
            <input
              ref={inputRef}
              id={`${id}-input`}
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="absolute -inset-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] cursor-pointer border-0 bg-transparent p-0"
            />
          </span>
        </span>
      </div>
      {open && (
        <Suspense fallback={null}>
          <ColourTools
            id={`${id}-tools`}
            value={value}
            onPick={onChange}
            openNativePicker={openNativePicker}
          />
        </Suspense>
      )}
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <m.button
      whileTap={TAP}
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition ${
        active
          ? 'bg-grad-accent text-white shadow-[var(--shadow-accent)]'
          : 'bg-surface-2 text-text/80 hover:bg-surface-3'
      }`}
    >
      {children}
    </m.button>
  )
}

export function PrimaryButton({
  onClick,
  children,
  disabled,
  as,
  htmlFor,
}: {
  onClick?: () => void
  children: ReactNode
  disabled?: boolean
  as?: 'button' | 'label'
  htmlFor?: string
}) {
  const className =
    'bg-grad-accent min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-accent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer inline-flex items-center justify-center'

  if (as === 'label') {
    return (
      <m.label
        whileTap={TAP}
        htmlFor={htmlFor}
        className={className}
      >
        {children}
      </m.label>
    )
  }

  return (
    <m.button
      whileTap={TAP}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </m.button>
  )
}

// A titled group of controls — the backbone of the reorganized panels.
export function Section({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`flex flex-col gap-2.5 ${className}`}>
      {title && (
        <h3 className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}

// Unified icon/action button used across the header and toolbars.
export function IconButton({
  onClick,
  children,
  label,
  disabled,
  active,
  variant = 'ghost',
}: {
  onClick: () => void
  children: ReactNode
  label: string
  disabled?: boolean
  active?: boolean
  variant?: 'ghost' | 'accent'
}) {
  const base =
    'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl px-2.5 text-base font-medium transition disabled:opacity-30'
  const styles =
    variant === 'accent'
      ? 'bg-grad-accent text-white shadow-[var(--shadow-accent)] hover:brightness-110'
      : active
        ? 'bg-surface-3 text-text'
        : 'text-text/70 hover:bg-surface-2 hover:text-text'
  return (
    <m.button
      whileTap={disabled ? undefined : TAP}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`${base} ${styles}`}
    >
      {children}
    </m.button>
  )
}
