import type { CurvePoint, FilterOperation, HslAdjust, HslBand, ToneChannel } from '../types'

export const HSL_BANDS: { band: HslBand; hue: number; swatch: string }[] = [
  { band: 'red', hue: 0, swatch: '#e53935' },
  { band: 'orange', hue: 30, swatch: '#fb8c00' },
  { band: 'yellow', hue: 60, swatch: '#fdd835' },
  { band: 'green', hue: 120, swatch: '#43a047' },
  { band: 'aqua', hue: 180, swatch: '#00acc1' },
  { band: 'blue', hue: 240, swatch: '#1e88e5' },
  { band: 'purple', hue: 270, swatch: '#8e24aa' },
  { band: 'magenta', hue: 300, swatch: '#d81b60' },
]

export const MAX_LUT_SIZE = 33

type Filter = (imageData: ImageData) => void

type AdvancedOp = Extract<FilterOperation, { type: 'levels' | 'curves' | 'hsl' | 'lut' }>

const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

const toByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))

/** Input → output table for a levels adjustment. */
export function levelsTable(black: number, white: number, gamma: number): Uint8Array {
  const lo = num(black, 0, 0, 254)
  const hi = Math.max(lo + 1, num(white, 255, 1, 255))
  const g = num(gamma, 1, 0.1, 10)
  const table = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const t = Math.min(1, Math.max(0, (i - lo) / (hi - lo)))
    table[i] = toByte(255 * Math.pow(t, 1 / g))
  }
  return table
}

/**
 * Input → output table for a tone curve through `points`, by monotone cubic
 * interpolation (Fritsch–Carlson), so the curve never overshoots its points.
 */
export function curveTable(points: unknown): Uint8Array {
  const clean = (Array.isArray(points) ? points : [])
    .filter(
      (p): p is CurvePoint => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    )
    .map(([x, y]) => [num(x, 0, 0, 255), num(y, 0, 0, 255)] as CurvePoint)
    .sort((a, b) => a[0] - b[0])
    .filter((p, i, all) => i === 0 || p[0] > all[i - 1][0])
  if (!clean.length || clean[0][0] > 0) clean.unshift([0, 0])
  if (clean[clean.length - 1][0] < 255) clean.push([255, 255])

  const n = clean.length
  const xs = clean.map((p) => p[0])
  const ys = clean.map((p) => p[1])
  const slopes = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]))
  const tangents = xs.map((_, i) => {
    if (i === 0) return slopes[0]
    if (i === n - 1) return slopes[n - 2]
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2
  })
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = tangents[i + 1] = 0
      continue
    }
    const a = tangents[i] / slopes[i]
    const b = tangents[i + 1] / slopes[i]
    const h = Math.hypot(a, b)
    if (h > 3) {
      tangents[i] = (3 * a * slopes[i]) / h
      tangents[i + 1] = (3 * b * slopes[i]) / h
    }
  }

  const table = new Uint8Array(256)
  let seg = 0
  for (let x = 0; x < 256; x++) {
    while (seg < n - 2 && x > xs[seg + 1]) seg++
    const w = xs[seg + 1] - xs[seg]
    const t = (x - xs[seg]) / w
    const t2 = t * t
    const t3 = t2 * t
    table[x] = toByte(
      (2 * t3 - 3 * t2 + 1) * ys[seg] +
        (t3 - 2 * t2 + t) * w * tangents[seg] +
        (-2 * t3 + 3 * t2) * ys[seg + 1] +
        (t3 - t2) * w * tangents[seg + 1],
    )
  }
  return table
}

function toneFilter(r: Uint8Array, g: Uint8Array, b: Uint8Array): Filter {
  return (imageData: ImageData) => {
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      d[i] = r[d[i]]
      d[i + 1] = g[d[i + 1]]
      d[i + 2] = b[d[i + 2]]
    }
  }
}

const isIdentity = (table: Uint8Array) => table.every((v, i) => v === i)

function curvesFilter(channels: Partial<Record<ToneChannel, CurvePoint[]>>): Filter | null {
  const master = curveTable(channels?.rgb)
  const per = (c: ToneChannel) => {
    const own = curveTable(channels?.[c])
    return master.map((v) => own[v])
  }
  const [r, g, b] = [per('r'), per('g'), per('b')]
  return isIdentity(r) && isIdentity(g) && isIdentity(b) ? null : toneFilter(r, g, b)
}

/**
 * Per-degree hue/saturation/lightness shifts, for hues 0..360. Each hue is
 * split linearly between its two neighbouring band centres, so a table at 1°
 * steps, read with linear interpolation, is exact.
 */
function bandTables(adjust: HslAdjust[]) {
  const dh = new Float32Array(361)
  const ds = new Float32Array(361)
  const dl = new Float32Array(361)
  for (let i = 0; i < HSL_BANDS.length; i++) {
    const from = HSL_BANDS[i].hue
    const to = i + 1 < HSL_BANDS.length ? HSL_BANDS[i + 1].hue : 360
    const A = adjust[i]
    const C = adjust[(i + 1) % HSL_BANDS.length]
    for (let h = from; h <= to; h++) {
      const t = (h - from) / (to - from)
      dh[h] = A.hue * (1 - t) + C.hue * t
      ds[h] = A.saturation * (1 - t) + C.saturation * t
      dl[h] = A.lightness * (1 - t) + C.lightness * t
    }
  }
  return { dh, ds, dl }
}

function hslFilter(bands: Partial<Record<HslBand, HslAdjust>>): Filter | null {
  const adjust = HSL_BANDS.map(({ band }) => ({
    hue: num(bands?.[band]?.hue, 0, -30, 30),
    saturation: num(bands?.[band]?.saturation, 0, -1, 1),
    lightness: num(bands?.[band]?.lightness, 0, -1, 1),
  }))
  if (adjust.every((a) => !a.hue && !a.saturation && !a.lightness)) return null
  const table = bandTables(adjust)
  return (imageData: ImageData) => {
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255
      const g = d[i + 1] / 255
      const b = d[i + 2] / 255
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const delta = max - min
      if (delta === 0) continue
      let l = (max + min) / 2
      let s = delta / (1 - Math.abs(2 * l - 1))
      let h =
        max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
      h = h * 60
      if (h < 0) h += 360

      const at = Math.min(359, Math.floor(h))
      const f = h - at
      // Near-greys have no meaningful hue; fade the effect in with saturation.
      const strength = Math.min(1, s * 4)
      const dh = (table.dh[at] * (1 - f) + table.dh[at + 1] * f) * strength
      const ds = (table.ds[at] * (1 - f) + table.ds[at + 1] * f) * strength
      const dl = (table.dl[at] * (1 - f) + table.dl[at + 1] * f) * strength
      if (!dh && !ds && !dl) continue

      h = (((h + dh) % 360) + 360) % 360
      s = Math.min(1, Math.max(0, s * (1 + ds)))
      l = Math.min(1, Math.max(0, l + dl * (dl > 0 ? 1 - l : l)))

      const k = (1 - Math.abs(2 * l - 1)) * s
      const x = k * (1 - Math.abs(((h / 60) % 2) - 1))
      const m = (l - k / 2) * 255
      const sector = Math.floor(h / 60)
      const r1 = sector === 0 || sector === 5 ? k : sector === 1 || sector === 4 ? x : 0
      const g1 = sector === 1 || sector === 2 ? k : sector === 0 || sector === 3 ? x : 0
      const b1 = sector === 3 || sector === 4 ? k : sector === 2 || sector === 5 ? x : 0
      d[i] = toByte(r1 * 255 + m)
      d[i + 1] = toByte(g1 * 255 + m)
      d[i + 2] = toByte(b1 * 255 + m)
    }
  }
}

/** Trilinear lookup of r, g, b (0..1) in a LUT of `size`³ RGB byte entries; writes 0..255 into `out`. */
function sampleLut(lut: Uint8Array, size: number, r: number, g: number, b: number, out: number[]) {
  const last = size - 1
  const fr = r * last
  const fg = g * last
  const fb = b * last
  const r0 = Math.min(last - 1, Math.floor(fr))
  const g0 = Math.min(last - 1, Math.floor(fg))
  const b0 = Math.min(last - 1, Math.floor(fb))
  const tr = fr - r0
  const tg = fg - g0
  const tb = fb - b0
  const dr = 3
  const dg = size * 3
  const db = size * size * 3
  const p000 = ((b0 * size + g0) * size + r0) * 3
  for (let ch = 0; ch < 3; ch++) {
    const p = p000 + ch
    const c00 = lut[p] * (1 - tr) + lut[p + dr] * tr
    const c10 = lut[p + dg] * (1 - tr) + lut[p + dg + dr] * tr
    const c01 = lut[p + db] * (1 - tr) + lut[p + db + dr] * tr
    const c11 = lut[p + db + dg] * (1 - tr) + lut[p + db + dg + dr] * tr
    const c0 = c00 * (1 - tg) + c10 * tg
    const c1 = c01 * (1 - tg) + c11 * tg
    out[ch] = c0 * (1 - tb) + c1 * tb
  }
}

function lutFilter(lut: Uint8Array, size: number, amount: number): Filter {
  const keep = 1 - amount
  const out = [0, 0, 0]
  return (imageData: ImageData) => {
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      sampleLut(lut, size, d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, out)
      d[i] = toByte(d[i] * keep + out[0] * amount)
      d[i + 1] = toByte(d[i + 1] * keep + out[1] * amount)
      d[i + 2] = toByte(d[i + 2] * keep + out[2] * amount)
    }
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** A LUT resampled to at most MAX_LUT_SIZE per side, to keep project files small. */
function shrinkLut(lut: Uint8Array, size: number): { size: number; bytes: Uint8Array } {
  if (size <= MAX_LUT_SIZE) return { size, bytes: lut }
  const n = MAX_LUT_SIZE
  const bytes = new Uint8Array(n * n * n * 3)
  const out = [0, 0, 0]
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++) {
        sampleLut(lut, size, r / (n - 1), g / (n - 1), b / (n - 1), out)
        const at = ((b * n + g) * n + r) * 3
        bytes[at] = toByte(out[0])
        bytes[at + 1] = toByte(out[1])
        bytes[at + 2] = toByte(out[2])
      }
  return { size: n, bytes }
}

/** Parses an Adobe/Resolve `.cube` 3D LUT. Throws with the reason when it can't. */
export function parseCube(
  text: string,
  fallbackName: string,
): Extract<FilterOperation, { type: 'lut' }> {
  let name = fallbackName
  let size = 0
  let min = [0, 0, 0]
  let max = [1, 1, 1]
  const values: number[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const [key, ...rest] = line.split(/\s+/)
    if (key === 'TITLE') name = line.slice(5).trim().replace(/^"|"$/g, '') || name
    else if (key === 'LUT_1D_SIZE') throw new Error('1D LUTs are not supported')
    else if (key === 'LUT_3D_SIZE') size = Number(rest[0])
    else if (key === 'DOMAIN_MIN') min = rest.map(Number)
    else if (key === 'DOMAIN_MAX') max = rest.map(Number)
    else if (/^[-+.\d]/.test(key)) {
      const triple = [key, ...rest].slice(0, 3).map(Number)
      if (triple.length !== 3 || !triple.every(Number.isFinite)) {
        throw new Error(`bad data line "${line.slice(0, 40)}"`)
      }
      values.push(...triple)
    }
  }
  if (!Number.isInteger(size) || size < 2 || size > 256)
    throw new Error('missing or invalid LUT_3D_SIZE')
  if (values.length !== size ** 3 * 3) {
    throw new Error(`expected ${size ** 3} entries, found ${values.length / 3}`)
  }
  if (![...min, ...max].every(Number.isFinite) || min.length !== 3 || max.length !== 3) {
    throw new Error('invalid DOMAIN_MIN/DOMAIN_MAX')
  }
  const bytes = new Uint8Array(values.length)
  for (let i = 0; i < values.length; i++) {
    const ch = i % 3
    bytes[i] = toByte(((values[i] - min[ch]) / (max[ch] - min[ch] || 1)) * 255)
  }
  const shrunk = shrinkLut(bytes, size)
  return { type: 'lut', name, size: shrunk.size, data: bytesToBase64(shrunk.bytes), amount: 1 }
}

function build(op: AdvancedOp): Filter | null {
  switch (op.type) {
    case 'levels': {
      const t = levelsTable(op.black, op.white, op.gamma)
      return isIdentity(t) ? null : toneFilter(t, t, t)
    }
    case 'curves':
      return curvesFilter(op.channels)
    case 'hsl':
      return hslFilter(op.bands)
    case 'lut': {
      const size = num(op.size, 0, 0, MAX_LUT_SIZE)
      let bytes: Uint8Array
      try {
        bytes = base64ToBytes(op.data)
      } catch {
        bytes = new Uint8Array()
      }
      if (!Number.isInteger(size) || size < 2 || bytes.length !== size ** 3 * 3) {
        console.error(`LUT "${op.name}" is corrupt (size ${op.size}); it is not applied`)
        return null
      }
      const amount = num(op.amount, 1, 0, 1)
      return amount ? lutFilter(bytes, size, amount) : null
    }
  }
}

// Ops in the store are immutable, so a filter built for one stays valid for as
// long as that object lives — re-renders and StrictMode's doubled effects reuse it.
const built = new WeakMap<AdvancedOp, Filter | null>()

/** Konva filters for the levels/curves/HSL/LUT ops of a stack, in stack order. */
export function advancedFilters(stack: FilterOperation[]): Filter[] {
  const filters: Filter[] = []
  for (const op of stack) {
    if (op.type !== 'levels' && op.type !== 'curves' && op.type !== 'hsl' && op.type !== 'lut')
      continue
    if (!built.has(op)) built.set(op, build(op))
    const filter = built.get(op)
    if (filter) filters.push(filter)
  }
  return filters
}
