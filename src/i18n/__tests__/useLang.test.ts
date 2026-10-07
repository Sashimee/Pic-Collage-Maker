import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

describe('useLang', () => {
  let store: Map<string, string>

  beforeEach(() => {
    vi.resetModules()
    store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    })
    vi.stubGlobal('navigator', { languages: ['en-US'] })
  })
  afterEach(() => vi.unstubAllGlobals())

  const load = () => import('../useLang')

  it('loads a saved language before it is ready, without re-saving it', async () => {
    store.set('lang', 'de')
    const setItem = vi.spyOn(localStorage, 'setItem')
    const { useLang, useT, langReady } = await load()
    await langReady
    expect(useLang.getState().lang).toBe('de')
    expect(document.documentElement.lang).toBe('de')
    expect(renderHook(() => useT()).result.current('tab.photos')).toBe('Fotos')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('detects the browser language when nothing is saved', async () => {
    vi.stubGlobal('navigator', { languages: ['fr-CA', 'en'] })
    const { useLang, langReady } = await load()
    await langReady
    expect(useLang.getState().lang).toBe('fr')
  })

  it('ignores a saved value that is not a language', async () => {
    store.set('lang', 'xx')
    const { useLang, langReady } = await load()
    await langReady
    expect(useLang.getState().lang).toBe('en')
  })

  it('switches and persists a picked language once its strings are in', async () => {
    const { useLang, langReady } = await load()
    await langReady
    const switching = useLang.getState().setLang('es')
    expect(useLang.getState().lang).toBe('en')
    await switching
    expect(useLang.getState().lang).toBe('es')
    expect(useLang.getState().dict['tab.photos']).toBe('Fotos')
    expect(store.get('lang')).toBe('es')
  })

  it('keeps the last pick when an earlier one finishes loading after it', async () => {
    const { useLang, langReady } = await load()
    await langReady
    const slow = useLang.getState().setLang('it')
    await useLang.getState().setLang('en')
    await slow
    expect(useLang.getState().lang).toBe('en')
    expect(store.get('lang')).toBe('en')
  })

  it('shows the key itself for a string no language has', async () => {
    store.set('lang', 'pt')
    const { useT, langReady } = await load()
    await langReady
    const t = renderHook(() => useT()).result.current
    expect(t('no.such.key')).toBe('no.such.key')
  })
})
