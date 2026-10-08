import { useId, type ReactNode } from 'react'
import { useLang, useT } from '../i18n/useLang'
import { LANGS } from '../i18n/translations'
import { useTheme } from '../i18n/useTheme'
import { AUTOSAVE_DELAYS, UNITS, useSettings } from '../store/settingsStore'
import { Section } from './ui'

const UNIT_LABELS = { px: 'settings.unitsPx', mm: 'settings.unitsMm', in: 'settings.unitsIn' }

function Field<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: ReactNode }[]
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium text-text/80">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const picked = options.find((o) => o.value === e.target.value)
          if (picked) onChange(picked.value)
        }}
        className="min-h-[44px] max-w-[60%] rounded-xl border border-border bg-surface-2 px-3 text-sm text-text"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function GeneralSettings() {
  const t = useT()
  const theme = useTheme((s) => s.theme)
  const setTheme = useTheme((s) => s.setTheme)
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)
  const settings = useSettings()
  const analyticsId = useId()
  const locationId = useId()

  return (
    <Section title={t('settings.general')}>
      <Field
        label={t('settings.theme')}
        value={theme}
        options={[
          { value: 'light', label: t('settings.themeLight') },
          { value: 'dark', label: t('settings.themeDark') },
        ]}
        onChange={setTheme}
      />
      <Field
        label={t('settings.language')}
        value={lang}
        options={LANGS.map((l) => ({ value: l.id, label: `${l.flag} ${l.label}` }))}
        onChange={(l) => void setLang(l)}
      />
      <Field
        label={t('settings.units')}
        value={settings.units}
        options={UNITS.map((u) => ({ value: u, label: t(UNIT_LABELS[u]) }))}
        onChange={settings.setUnits}
      />
      <Field
        label={t('settings.exportFormat')}
        value={settings.exportFormat}
        options={[
          { value: 'png', label: 'PNG' },
          { value: 'jpg', label: 'JPG' },
        ]}
        onChange={settings.setExportFormat}
      />
      <Field
        label={t('settings.autosave')}
        value={String(settings.autosaveDelay)}
        options={AUTOSAVE_DELAYS.map((ms) => ({ value: String(ms), label: `${ms / 1000} s` }))}
        onChange={(v) => {
          const ms = AUTOSAVE_DELAYS.find((d) => String(d) === v)
          if (ms) settings.setAutosaveDelay(ms)
        }}
      />
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={analyticsId} className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-text/80">{t('settings.analytics')}</span>
          <span className="text-[0.7rem] leading-relaxed text-muted">
            {t('settings.analyticsHint')}
          </span>
        </label>
        <input
          id={analyticsId}
          type="checkbox"
          checked={!settings.analyticsOptOut}
          onChange={(e) => settings.setAnalyticsOptOut(!e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
      </div>
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={locationId} className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-text/80">{t('settings.keepLocation')}</span>
          <span className="text-[0.7rem] leading-relaxed text-muted">
            {t('settings.keepLocationHint')}
          </span>
        </label>
        <input
          id={locationId}
          type="checkbox"
          checked={settings.keepLocation}
          onChange={(e) => settings.setKeepLocation(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
      </div>
    </Section>
  )
}
