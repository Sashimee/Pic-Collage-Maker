import { create } from 'zustand'
import { type Dict, type Lang, LANGS, en } from './translations'

const STORAGE_KEY = 'lang'

const LOADERS: Record<Exclude<Lang, 'en'>, () => Promise<{ default: Dict }>> = {
  de: () => import('./locales/de'),
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  it: () => import('./locales/it'),
  pt: () => import('./locales/pt'),
}

const loaded: Partial<Record<Lang, Dict>> = { en }

async function loadDict(lang: Lang): Promise<Dict> {
  if (lang === 'en') return en
  return (loaded[lang] ??= (await LOADERS[lang]()).default)
}

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const known = LANGS.find((l) => l.id === saved)
    if (known) return known.id
  } catch {
    /* localStorage unavailable */
  }
  const prefs =
    typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []
  for (const l of prefs) {
    const lower = l?.toLowerCase() ?? ''
    if (lower.startsWith('de')) return 'de'
    if (lower.startsWith('es')) return 'es'
    if (lower.startsWith('fr')) return 'fr'
    if (lower.startsWith('it')) return 'it'
    if (lower.startsWith('pt')) return 'pt'
  }
  return 'en'
}

function applyDocumentLang(lang: Lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}

interface LangState {
  lang: Lang
  dict: Dict
  /** Resolves once the language's strings are loaded and showing. */
  setLang: (lang: Lang) => Promise<void>
}

let latest: Lang = 'en'

async function switchTo(lang: Lang, persist: boolean) {
  latest = lang
  let dict: Dict
  try {
    dict = await loadDict(lang)
  } catch (err) {
    console.error(
      `Could not load the "${lang}" translations; staying on "${useLang.getState().lang}".`,
      err,
    )
    return
  }
  if (latest !== lang) return
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
  }
  applyDocumentLang(lang)
  useLang.setState({ lang, dict })
}

export const useLang = create<LangState>(() => ({
  lang: 'en',
  dict: en,
  setLang: (lang) => switchTo(lang, true),
}))

/** The detected language, loaded; main.tsx waits for it before the first render. */
export const langReady: Promise<void> = switchTo(detectLang(), false)

export type TVars = Record<string, string | number>
export type TFunc = (key: string, vars?: TVars) => string

/**
 * A key with a `count` var is looked up as `key.one`, `key.few`… by the language's plural
 * rule, falling back to `key.other`; `{name}` placeholders take the vars, numbers formatted
 * for the language.
 */
// Built once per language: the layout gallery alone renders dozens of counts, and
// constructing these is far from free.
const pluralRules = new Map<Lang, Intl.PluralRules>()
const numberFormats = new Map<Lang, Intl.NumberFormat>()

function cached<T>(cache: Map<Lang, T>, lang: Lang, make: (lang: Lang) => T): T {
  let value = cache.get(lang)
  if (!value) cache.set(lang, (value = make(lang)))
  return value
}

export function translate(lang: Lang, dict: Dict, key: string, vars?: TVars): string {
  const lookup = (k: string) => dict[k] ?? en[k]
  let text: string | undefined
  if (typeof vars?.count === 'number') {
    const rule = cached(pluralRules, lang, (l) => new Intl.PluralRules(l)).select(vars.count)
    text = lookup(`${key}.${rule}`) ?? lookup(`${key}.other`)
  }
  text ??= lookup(key)
  if (text === undefined) return key
  if (!vars) return text
  const numbers = cached(numberFormats, lang, (l) => new Intl.NumberFormat(l))
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name]
    if (value === undefined) return whole
    return typeof value === 'number' ? numbers.format(value) : value
  })
}

// Hook returning a translator bound to the current language. English is the
// fallback; an unknown key returns the key itself so misses are visible.
export function useT(): TFunc {
  const lang = useLang((s) => s.lang)
  const dict = useLang((s) => s.dict)
  return (key, vars) => translate(lang, dict, key, vars)
}
