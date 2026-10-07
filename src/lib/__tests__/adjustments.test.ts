import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  advancedFilters,
  base64ToBytes,
  bytesToBase64,
  curveTable,
  levelsTable,
  MAX_LUT_SIZE,
  parseCube,
} from '../adjustments'
import type { FilterOperation } from '../../types'

const image = (...pixels: [number, number, number][]) =>
  ({ data: new Uint8ClampedArray(pixels.flatMap(([r, g, b]) => [r, g, b, 255])) }) as ImageData

const run = (op: FilterOperation, ...pixels: [number, number, number][]) => {
  const img = image(...pixels)
  for (const f of advancedFilters([op])) f(img)
  return Array.from({ length: pixels.length }, (_, i) =>
    Array.from(img.data.slice(i * 4, i * 4 + 3)),
  )
}

function identityCube(size: number, map = (v: number) => v) {
  const lines = [`TITLE "Test"`, `LUT_3D_SIZE ${size}`]
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++)
        lines.push([r, g, b].map((v) => map(v / (size - 1)).toFixed(6)).join(' '))
  return lines.join('\n')
}

afterEach(() => vi.restoreAllMocks())

describe('levelsTable', () => {
  it('is the identity at defaults', () => {
    const t = levelsTable(0, 255, 1)
    expect([t[0], t[77], t[255]]).toEqual([0, 77, 255])
  })

  it('clips below black and above white, and stretches between', () => {
    const t = levelsTable(50, 200, 1)
    expect([t[0], t[50], t[125], t[200], t[255]]).toEqual([0, 0, 128, 255, 255])
  })

  it('brightens midtones with gamma above 1 but keeps the ends', () => {
    const t = levelsTable(0, 255, 2)
    expect(t[128]).toBeGreaterThan(170)
    expect([t[0], t[255]]).toEqual([0, 255])
  })

  it('survives white at or below black and non-finite input', () => {
    expect(() => levelsTable(200, 100, NaN)).not.toThrow()
    const t = levelsTable(200, 100, NaN)
    expect([t[199], t[201]]).toEqual([0, 255])
  })
})

describe('curveTable', () => {
  it('is the identity with no points', () => {
    const t = curveTable(undefined)
    expect(Array.from(t)).toEqual(Array.from({ length: 256 }, (_, i) => i))
  })

  it('passes through its points and stays monotone (no overshoot)', () => {
    const t = curveTable([
      [64, 30],
      [128, 128],
      [192, 230],
    ])
    expect([t[64], t[128], t[192]]).toEqual([30, 128, 230])
    for (let i = 1; i < 256; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1])
  })

  it('ignores malformed points and sorts the rest', () => {
    const t = curveTable([[192, 255], 'x', [NaN, 3], [64, 0], [64, 99]])
    expect([t[0], t[64], t[192], t[255]]).toEqual([0, 0, 255, 255])
  })
})

describe('advancedFilters', () => {
  it('applies levels to every channel', () => {
    expect(run({ type: 'levels', black: 50, white: 200, gamma: 1 }, [50, 125, 200])).toEqual([
      [0, 128, 255],
    ])
  })

  it('applies a channel curve after the master curve', () => {
    const op: FilterOperation = {
      type: 'curves',
      channels: { rgb: [[128, 64]], r: [[64, 128]] },
    }
    const [[r, g, b]] = run(op, [128, 128, 128])
    expect([g, b]).toEqual([64, 64])
    expect(r).toBe(128)
  })

  it('shifts only the hues in the chosen band and leaves greys alone', () => {
    const op: FilterOperation = {
      type: 'hsl',
      bands: { blue: { hue: 0, saturation: -1, lightness: 0 } },
    }
    const [red, blue, grey] = run(op, [200, 20, 20], [20, 20, 200], [90, 90, 90])
    expect(red).toEqual([200, 20, 20])
    expect(new Set(blue).size).toBe(1)
    expect(grey).toEqual([90, 90, 90])
  })

  it('rotates hue by band, blending the bands either side of a hue', () => {
    const op: FilterOperation = {
      type: 'hsl',
      bands: { red: { hue: 30, saturation: 0, lightness: 0 } },
    }
    const [red, pinkishRed] = run(op, [255, 0, 0], [255, 0, 51])
    expect(red).toEqual([255, 128, 0])
    // Hue 348° is 80 % red, 20 % magenta: +24° lands on 12°.
    expect(pinkishRed).toEqual([255, 51, 0])
  })

  it('builds no filter for ops left at their neutral settings', () => {
    const neutral: FilterOperation[] = [
      { type: 'levels', black: 0, white: 255, gamma: 1 },
      { type: 'curves', channels: { rgb: [[128, 128]] } },
      { type: 'hsl', bands: { red: { hue: 0, saturation: 0, lightness: 0 } } },
      { type: 'lut', name: 'x', size: 2, data: bytesToBase64(new Uint8Array(24)), amount: 0 },
    ]
    expect(advancedFilters(neutral)).toEqual([])
  })

  it('reuses the built filter for the same op object', () => {
    const op: FilterOperation = { type: 'levels', black: 10, white: 240, gamma: 1 }
    expect(advancedFilters([op])[0]).toBe(advancedFilters([op])[0])
    expect(advancedFilters([{ ...op }])[0]).not.toBe(advancedFilters([op])[0])
  })

  it('skips the basic ops and a corrupt LUT, saying why', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const filters = advancedFilters([
      { type: 'brightness', value: 1 },
      { type: 'lut', name: 'Broken', size: 2, data: 'AAAA', amount: 1 },
    ])
    expect(filters).toEqual([])
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Broken'))
  })
})

describe('parseCube', () => {
  it('reads an identity LUT that leaves pixels unchanged', () => {
    const op = parseCube(identityCube(5), 'file')
    expect(op).toMatchObject({ type: 'lut', name: 'Test', size: 5, amount: 1 })
    expect(run(op, [10, 128, 250])).toEqual([[10, 128, 250]])
  })

  it('applies a mapping, blended by amount', () => {
    const invert = parseCube(
      identityCube(2, (v) => 1 - v),
      'Invert',
    )
    expect(run(invert, [0, 100, 255])).toEqual([[255, 155, 0]])
    expect(run({ ...invert, amount: 0.5 }, [0, 100, 255])).toEqual([[128, 128, 128]])
  })

  it('honours DOMAIN_MAX and falls back to the file name', () => {
    const text = identityCube(2, (v) => v * 2)
      .replace('TITLE "Test"\n', '')
      .replace('LUT_3D_SIZE 2', 'LUT_3D_SIZE 2\nDOMAIN_MAX 2 2 2')
    const op = parseCube(text, 'scaled')
    expect(op.name).toBe('scaled')
    expect(run(op, [40, 80, 160])).toEqual([[40, 80, 160]])
  })

  it(`shrinks LUTs larger than ${MAX_LUT_SIZE} per side`, () => {
    const op = parseCube(identityCube(40), 'big')
    expect(op.size).toBe(MAX_LUT_SIZE)
    expect(base64ToBytes(op.data)).toHaveLength(MAX_LUT_SIZE ** 3 * 3)
    const [[r, g, b]] = run(op, [10, 128, 250])
    expect(Math.abs(r - 10) + Math.abs(g - 128) + Math.abs(b - 250)).toBeLessThanOrEqual(3)
  })

  it('rejects what it cannot read, with the reason', () => {
    expect(() => parseCube('LUT_1D_SIZE 4\n0 0 0', 'x')).toThrow(/1D/)
    expect(() => parseCube('0 0 0', 'x')).toThrow(/LUT_3D_SIZE/)
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0', 'x')).toThrow(/expected 8 entries, found 1/)
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 zz', 'x')).toThrow(/bad data line/)
  })
})

describe('base64', () => {
  it('round-trips bytes, including more than one chunk', () => {
    const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => i % 256)
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })
})
