import { describe, it, expect, beforeEach } from 'vitest'
import { crashedRightAfterRecovery, hasCrashed, markCrashed, noteRecovery } from '../crashState'

describe('crashState', () => {
  beforeEach(() => sessionStorage.clear())

  it('starts clean and latches once marked', () => {
    expect(hasCrashed()).toBe(false)
    markCrashed()
    expect(hasCrashed()).toBe(true)
  })

  it('is not a loop when no recovery happened this session', () => {
    expect(crashedRightAfterRecovery()).toBe(false)
  })

  it('treats a crash within 15 s of a recovery as a loop, and a later one as new', () => {
    const t = Date.now()
    noteRecovery()
    expect(crashedRightAfterRecovery(t + 14_999)).toBe(true)
    expect(crashedRightAfterRecovery(t + 60_000)).toBe(false)
  })

  it('ignores a garbage stored value', () => {
    sessionStorage.setItem('pcm-recovered-at', 'nope')
    expect(crashedRightAfterRecovery()).toBe(false)
  })
})
