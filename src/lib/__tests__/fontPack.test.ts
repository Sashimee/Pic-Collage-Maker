import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

class FakeFace {
  static instances: FakeFace[] = []
  static fail = false
  constructor(
    public family: string,
    public source: string,
  ) {
    FakeFace.instances.push(this)
  }
  load() {
    return FakeFace.fail ? Promise.reject(new Error('404')) : Promise.resolve(this)
  }
}

const added = new Set<unknown>()

beforeEach(() => {
  vi.resetModules()
  FakeFace.instances = []
  FakeFace.fail = false
  added.clear()
  vi.stubGlobal('FontFace', FakeFace)
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { add: (f: unknown) => added.add(f), delete: (f: unknown) => added.delete(f) },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('primaryFamily', () => {
  it('takes the first family of a CSS list and unquotes it', async () => {
    const { primaryFamily } = await import('../fontPack')
    expect(primaryFamily('Bebas Neue, system-ui, sans-serif')).toBe('Bebas Neue')
    expect(primaryFamily('"Playfair Display", serif')).toBe('Playfair Display')
    expect(primaryFamily('Poppins')).toBe('Poppins')
  })

  it('gives no family for a value that is not a string', async () => {
    const { primaryFamily } = await import('../fontPack')
    expect(primaryFamily(undefined)).toBe('')
    expect(primaryFamily(42)).toBe('')
  })
})

describe('loadPackFont', () => {
  it('ignores families outside the pack', async () => {
    const { loadPackFont } = await import('../fontPack')
    expect(loadPackFont('Poppins')).toBeNull()
    expect(FakeFace.instances).toHaveLength(0)
  })

  it('fetches a pack font from its own bundled file, once for every caller', async () => {
    const { loadPackFont } = await import('../fontPack')
    const a = loadPackFont('Lobster')
    const b = loadPackFont('Lobster')
    expect(a).toBe(b)
    await a
    expect(FakeFace.instances).toHaveLength(1)
    expect(FakeFace.instances[0].source).toMatch(/^url\(\/.*pack-lobster\.woff2\)$/)
    expect(added.size).toBe(1)
  })

  it('reports a failed load and retries it on the next use', async () => {
    const { loadPackFont } = await import('../fontPack')
    FakeFace.fail = true
    await expect(loadPackFont('Caveat')).rejects.toThrow(/could not load "Caveat"/)
    expect(added.size).toBe(0)
    FakeFace.fail = false
    await loadPackFont('Caveat')
    expect(FakeFace.instances).toHaveLength(2)
  })

  it('ships every family as a distinct file', async () => {
    const { FONT_PACK } = await import('../fontPack')
    expect(new Set(FONT_PACK.map((f) => f.url)).size).toBe(FONT_PACK.length)
  })
})
