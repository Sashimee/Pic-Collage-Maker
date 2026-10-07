import { describe, it, expect, afterEach, vi } from 'vitest'
import { formatLength } from '../settingsStore'

const KEY = 'pic-collage-settings'

async function loadWith(saved: unknown) {
  localStorage.setItem(KEY, JSON.stringify({ state: saved, version: 0 }))
  vi.resetModules()
  return (await import('../settingsStore')).useSettings.getState()
}

describe('settingsStore', () => {
  afterEach(() => localStorage.removeItem(KEY))

  it('starts from the defaults', async () => {
    localStorage.removeItem(KEY)
    vi.resetModules()
    const s = (await import('../settingsStore')).useSettings.getState()
    expect(s).toMatchObject({
      units: 'px',
      exportFormat: 'png',
      autosaveDelay: 1500,
      analyticsOptOut: false,
    })
  })

  it('persists a change', async () => {
    const { setUnits, setAutosaveDelay } = await loadWith({})
    setUnits('mm')
    setAutosaveDelay(15000)
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}').state
    expect(saved).toMatchObject({ units: 'mm', autosaveDelay: 15000 })
  })

  it('restores saved choices', async () => {
    const s = await loadWith({
      units: 'in',
      exportFormat: 'jpg',
      autosaveDelay: 30000,
      analyticsOptOut: true,
    })
    expect(s).toMatchObject({
      units: 'in',
      exportFormat: 'jpg',
      autosaveDelay: 30000,
      analyticsOptOut: true,
    })
  })

  it('ignores values it does not know', async () => {
    const s = await loadWith({
      units: 'cubits',
      exportFormat: 'gif',
      autosaveDelay: 1,
      analyticsOptOut: 'yes',
    })
    expect(s).toMatchObject({
      units: 'px',
      exportFormat: 'png',
      autosaveDelay: 1500,
      analyticsOptOut: false,
    })
  })
})

describe('formatLength', () => {
  it('shows design pixels as they are', () => {
    expect(formatLength(1080, 'px')).toBe('1080')
  })

  it('converts at 300 DPI', () => {
    expect(formatLength(3000, 'in')).toBe('10.00')
    expect(formatLength(1080, 'in')).toBe('3.60')
    expect(formatLength(3000, 'mm')).toBe('254')
  })

  it('handles zero', () => {
    expect(formatLength(0, 'mm')).toBe('0')
  })
})
