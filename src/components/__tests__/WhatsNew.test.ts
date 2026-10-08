import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { claimWhatsNew } from '../WhatsNew'
import { RELEASES, WHATS_NEW_TIP } from '../../lib/changelog'
import { hasSeen, markSeen } from '../../lib/firstUse'
import { en } from '../../i18n/translations'

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('claimWhatsNew', () => {
  it('shows nothing on a first visit, and nothing later for this release either', () => {
    expect(claimWhatsNew()).toBe(false)
    markSeen('welcome')
    expect(claimWhatsNew()).toBe(false)
    expect(hasSeen(WHATS_NEW_TIP)).toBe(true)
  })

  it('shows once to someone who used the app before this release', () => {
    markSeen('welcome')
    expect(claimWhatsNew()).toBe(true)
    expect(claimWhatsNew()).toBe(false)
  })
})

describe('the changelog', () => {
  it('has a newest release with lines to show', () => {
    expect(RELEASES[0].items.length).toBeGreaterThan(0)
  })

  it('names only strings that exist, since t() cannot check a key held in data', () => {
    const missing = RELEASES[0].items.filter((key) => !(key in en))
    expect(missing).toEqual([])
  })
})
