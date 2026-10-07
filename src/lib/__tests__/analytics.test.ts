import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * The module keeps state across calls, so each case re-imports it fresh via
 * vi.resetModules() after the environment has been set up the way it wants.
 */
async function load() {
  vi.resetModules()
  return import('../analytics')
}

/** jsdom defaults to about:blank; pretend we're on the deployed origin. */
function setHost(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hostname, href: `https://${hostname}/` },
    writable: true,
    configurable: true,
  })
}

function setSignal(name: string, value: unknown, target: object = navigator) {
  Object.defineProperty(target, name, { value, writable: true, configurable: true })
}

const scripts = () => Array.from(document.head.querySelectorAll('script'))

beforeEach(() => {
  document.head.innerHTML = ''
  delete (window as { goatcounter?: unknown }).goatcounter
  setHost('sashimee.github.io')
  setSignal('doNotTrack', undefined)
  setSignal('globalPrivacyControl', undefined)
  setSignal('msDoNotTrack', undefined)
  setSignal('doNotTrack', undefined, window)
  // Run the idle callback synchronously so tests don't have to wait.
  setSignal('requestIdleCallback', (cb: () => void) => cb(), window)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('initAnalytics', () => {
  it('injects the GoatCounter script with the endpoint attached', async () => {
    const { initAnalytics } = await load()
    initAnalytics()
    const s = scripts()
    expect(s).toHaveLength(1)
    expect(s[0].src).toContain('gc.zgo.at/count.js')
    expect(s[0].dataset.goatcounter).toBe('https://sashimee.goatcounter.com/count')
    expect(s[0].defer).toBe(true)
  })

  it('only ever injects the script once', async () => {
    const { initAnalytics } = await load()
    initAnalytics()
    initAnalytics()
    initAnalytics()
    expect(scripts()).toHaveLength(1)
  })

  it('falls back to setTimeout when requestIdleCallback is missing', async () => {
    setSignal('requestIdleCallback', undefined, window)
    vi.useFakeTimers()
    const { initAnalytics } = await load()
    initAnalytics()
    expect(scripts()).toHaveLength(0)
    vi.runAllTimers()
    expect(scripts()).toHaveLength(1)
    vi.useRealTimers()
  })
})

describe('opt-out signals', () => {
  it('makes no request at all when Do Not Track is set', async () => {
    setSignal('doNotTrack', '1')
    const { initAnalytics, track } = await load()
    initAnalytics()
    track('export-png')
    expect(scripts()).toHaveLength(0)
  })

  it('honours the legacy window.doNotTrack spelling', async () => {
    setSignal('doNotTrack', 'yes', window)
    const { initAnalytics } = await load()
    initAnalytics()
    expect(scripts()).toHaveLength(0)
  })

  it('honours Global Privacy Control', async () => {
    setSignal('globalPrivacyControl', true)
    const { initAnalytics } = await load()
    initAnalytics()
    expect(scripts()).toHaveLength(0)
  })

  it('honours the opt-out in Settings, saved from an earlier visit', async () => {
    localStorage.setItem(
      'pic-collage-settings',
      JSON.stringify({ state: { analyticsOptOut: true } }),
    )
    try {
      const { initAnalytics } = await load()
      initAnalytics()
      expect(scripts()).toHaveLength(0)
    } finally {
      localStorage.removeItem('pic-collage-settings')
    }
  })

  it('does not count local development sessions', async () => {
    setHost('localhost')
    const { initAnalytics, track } = await load()
    initAnalytics()
    track('export-png')
    expect(scripts()).toHaveLength(0)
  })
})

describe('track', () => {
  it('queues events fired before the script loads, then flushes them', async () => {
    const { initAnalytics, track } = await load()
    initAnalytics()
    track('layout-preset')
    track('photo-added')

    const count = vi.fn()
    ;(window as { goatcounter?: unknown }).goatcounter = { count }
    scripts()[0].dispatchEvent(new Event('load'))

    expect(count.mock.calls.map((c) => c[0].path)).toEqual(['layout-preset', 'photo-added'])
    expect(count.mock.calls.every((c) => c[0].event === true)).toBe(true)
  })

  it('sends straight through once loaded', async () => {
    const { initAnalytics, track } = await load()
    initAnalytics()
    const count = vi.fn()
    ;(window as { goatcounter?: unknown }).goatcounter = { count }
    scripts()[0].dispatchEvent(new Event('load'))

    track('export-pdf')
    expect(count).toHaveBeenCalledWith({ path: 'export-pdf', event: true })
  })

  it('drops the queue when the script is blocked', async () => {
    const { initAnalytics, track } = await load()
    initAnalytics()
    track('layout-preset')
    scripts()[0].dispatchEvent(new Event('error'))

    const count = vi.fn()
    ;(window as { goatcounter?: unknown }).goatcounter = { count }
    scripts()[0].dispatchEvent(new Event('load'))
    expect(count).not.toHaveBeenCalled()
  })

  it('caps the queue so a blocked script cannot grow it without bound', async () => {
    const { initAnalytics, track } = await load()
    initAnalytics()
    for (let i = 0; i < 500; i++) track(`event-${i}`)

    const count = vi.fn()
    ;(window as { goatcounter?: unknown }).goatcounter = { count }
    scripts()[0].dispatchEvent(new Event('load'))
    expect(count.mock.calls.length).toBeLessThanOrEqual(20)
  })

  it('never throws, even when the counter itself blows up', async () => {
    const { initAnalytics, track } = await load()
    initAnalytics()
    ;(window as { goatcounter?: unknown }).goatcounter = {
      count: () => {
        throw new Error('boom')
      },
    }
    scripts()[0].dispatchEvent(new Event('load'))
    expect(() => track('export-png')).not.toThrow()
  })

  it('is safe to call before init', async () => {
    const { track } = await load()
    expect(() => track('export-png')).not.toThrow()
    expect(scripts()).toHaveLength(0)
  })
})
