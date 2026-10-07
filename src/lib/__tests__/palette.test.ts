import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractPalette, normalizeColour } from '../palette'

const pixels = (...colours: [number, number, number, number, number][]) =>
  new Uint8ClampedArray(
    colours.flatMap(([r, g, b, a, n]) => Array.from({ length: n }, () => [r, g, b, a]).flat()),
  )

describe('normalizeColour', () => {
  it('accepts hex in either length and rgb(), as lowercase #rrggbb', () => {
    expect(normalizeColour('#FF8800')).toBe('#ff8800')
    expect(normalizeColour('#f80')).toBe('#ff8800')
    expect(normalizeColour('rgb(255, 136, 0)')).toBe('#ff8800')
    expect(normalizeColour('rgba(0,0,0,0.5)')).toBe('#000000')
  })

  it('rejects anything else', () => {
    for (const bad of ['red', '#12345', 'rgb(300,0,0)', '', '"/><script>', 42, null]) {
      expect(normalizeColour(bad), String(bad)).toBeNull()
    }
  })
})

describe('extractPalette', () => {
  it('orders colours by how much of the image they cover', () => {
    const data = pixels([0, 0, 255, 255, 10], [255, 0, 0, 255, 30], [0, 255, 0, 255, 20])
    expect(extractPalette(data)).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('skips transparent pixels and near-duplicates', () => {
    const data = pixels([255, 0, 0, 255, 30], [230, 10, 10, 255, 20], [0, 0, 0, 0, 100])
    expect(extractPalette(data)).toEqual(['#ff0000'])
  })

  it('stops at the requested count, and copes with no pixels', () => {
    const data = pixels([255, 0, 0, 255, 3], [0, 255, 0, 255, 2], [0, 0, 255, 255, 1])
    expect(extractPalette(data, 2)).toHaveLength(2)
    expect(extractPalette(new Uint8ClampedArray())).toEqual([])
  })
})

describe('useColours', () => {
  let store: Map<string, string>

  beforeEach(() => {
    vi.resetModules()
    store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  const load = async () => (await import('../palette')).useColours

  it('keeps recent colours newest first, deduplicated and capped', async () => {
    const useColours = await load()
    for (let i = 0; i < 10; i++) useColours.getState().remember(`#00000${i}`.slice(0, 7))
    useColours.getState().remember('#000003')
    const { recent } = useColours.getState()
    expect(recent[0]).toBe('#000003')
    expect(recent).toHaveLength(8)
    expect(new Set(recent).size).toBe(recent.length)
  })

  it('toggles a saved swatch and survives a reload', async () => {
    let useColours = await load()
    useColours.getState().toggleSaved('#ABCDEF')
    expect(useColours.getState().saved).toEqual(['#abcdef'])
    vi.resetModules()
    useColours = await load()
    expect(useColours.getState().saved).toEqual(['#abcdef'])
    useColours.getState().toggleSaved('#abcdef')
    expect(useColours.getState().saved).toEqual([])
  })

  it('ignores invalid colours, in calls and in storage', async () => {
    store.set('pic-collage-colours-v1', JSON.stringify({ recent: ['#fff', 'nope', 7], saved: 'x' }))
    const useColours = await load()
    expect(useColours.getState()).toMatchObject({ recent: ['#ffffff'], saved: [] })
    useColours.getState().remember('javascript:alert(1)')
    expect(useColours.getState().recent).toEqual(['#ffffff'])
  })

  it('starts empty when storage is unreadable', async () => {
    store.set('pic-collage-colours-v1', '{not json')
    const useColours = await load()
    expect(useColours.getState()).toMatchObject({ recent: [], saved: [] })
  })
})
