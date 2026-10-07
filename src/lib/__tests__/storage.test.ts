import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatBytes,
  requestPersistentStorage,
  resetPersistRequest,
  storageStatus,
} from '../storage'

function stubStorage(storage: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { ...navigator, storage })
}

describe('storageStatus', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reports usage, quota and whether the data is persistent', async () => {
    stubStorage({
      estimate: async () => ({ usage: 5 * 1024 ** 2, quota: 2 * 1024 ** 3 }),
      persisted: async () => true,
    })
    await expect(storageStatus()).resolves.toEqual({
      usage: 5 * 1024 ** 2,
      quota: 2 * 1024 ** 3,
      persisted: true,
    })
  })

  it('treats a browser without persisted() as best-effort and a missing figure as zero', async () => {
    stubStorage({ estimate: async () => ({}) })
    await expect(storageStatus()).resolves.toEqual({ usage: 0, quota: 0, persisted: false })
  })

  it('is null where the browser has no storage estimate', async () => {
    stubStorage(undefined)
    await expect(storageStatus()).resolves.toBeNull()
  })

  it('passes an estimate failure on to the caller', async () => {
    stubStorage({ estimate: () => Promise.reject(new Error('denied')) })
    await expect(storageStatus()).rejects.toThrow('denied')
  })
})

describe('requestPersistentStorage', () => {
  beforeEach(() => resetPersistRequest())
  afterEach(() => vi.unstubAllGlobals())

  it('asks once per session', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persist, persisted: async () => false })
    await expect(requestPersistentStorage()).resolves.toBe(true)
    await expect(requestPersistentStorage()).resolves.toBe(false)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('does not ask again when the data is already persistent', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persist, persisted: async () => true })
    await expect(requestPersistentStorage()).resolves.toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('reports a refusal', async () => {
    stubStorage({ persist: async () => false, persisted: async () => false })
    await expect(requestPersistentStorage()).resolves.toBe(false)
  })

  it('does nothing where the browser cannot persist', async () => {
    stubStorage({})
    await expect(requestPersistentStorage()).resolves.toBe(false)
  })
})

describe('formatBytes', () => {
  it('uses megabytes below a gigabyte, with a decimal only for small values', () => {
    expect(formatBytes(0, 'en')).toBe('0 MB')
    expect(formatBytes(2.5 * 1024 ** 2, 'en')).toBe('2.5 MB')
    expect(formatBytes(512 * 1024 ** 2, 'en')).toBe('512 MB')
  })

  it('switches to gigabytes at one gigabyte', () => {
    expect(formatBytes(1024 ** 3, 'en')).toBe('1 GB')
    expect(formatBytes(37.4 * 1024 ** 3, 'en')).toBe('37 GB')
  })

  it('follows the locale', () => {
    expect(formatBytes(2.5 * 1024 ** 2, 'de')).toBe('2,5 MB')
  })
})
