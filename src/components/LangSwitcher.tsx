import { useLang } from '../i18n/useLang'
import { useState } from 'react'
import { LANGS } from '../i18n/translations'

// Compact dropdown — shows only active flag, opens menu with all languages
export function LangDropdown() {
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)
  const [open, setOpen] = useState(false)
  const active = LANGS.find((l) => l.id === lang) ?? LANGS[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={active.label}
        title={active.label}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-lg transition hover:bg-surface-3"
      >
        {active.flag}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-surface-2 shadow-2xl">
            {LANGS.map((l) => (
              <button
                key={l.id}
                onClick={() => { setLang(l.id); setOpen(false) }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-3 ${
                  l.id === lang ? 'text-accent font-medium' : 'text-text'
                }`}
              >
                <span className="text-base">{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Legacy: all flags visible (takes more space)
export function LangSwitcher() {
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5">
      {LANGS.map((l) => (
        <button
          key={l.id}
          onClick={() => setLang(l.id)}
          aria-label={l.label}
          title={l.label}
          className={`rounded-md px-1.5 py-1 text-base leading-none transition ${
            lang === l.id ? 'bg-surface-3' : 'opacity-50 hover:opacity-100'
          }`}
        >
          {l.flag}
        </button>
      ))}
    </div>
  )
}

// Compact single-button toggle for mobile where space is tight.
export function LangSwitcherMobile() {
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)
  const next = lang === 'de' ? 'en' : 'de'
  const label = next === 'en' ? 'English' : 'Deutsch'
  const flag = next === 'en' ? '🇬🇧' : '🇩🇪'

  return (
    <button
      onClick={() => setLang(next)}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-lg transition hover:bg-surface-3"
    >
      {flag}
    </button>
  )
}
