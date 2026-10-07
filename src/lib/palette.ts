import { create } from 'zustand'

const KEY = 'pic-collage-colours-v1'
const MAX_RECENT = 8
const MAX_SAVED = 24
const MIN_DISTANCE = 40
const SAMPLE_SIZE = 48
const MAX_CACHED = 8

type Rgb = [number, number, number]

const toHex = ([r, g, b]: Rgb) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** A colour as lowercase `#rrggbb`, or null when it is not one we understand. */
export function normalizeColour(colour: unknown): string | null {
  if (typeof colour !== 'string') return null
  const s = colour.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s)
  if (short)
    return (
      '#' +
      short
        .slice(1)
        .map((d) => d + d)
        .join('')
    )
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(s)
  if (rgb) {
    const channels = rgb.slice(1).map(Number) as Rgb
    return channels.every((v) => v <= 255) ? toHex(channels) : null
  }
  return null
}

/**
 * The dominant colours of RGBA pixel data, most common first, skipping
 * transparent pixels and colours too close to one already chosen.
 */
export function extractPalette(data: Uint8ClampedArray, count = 6): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bucket.n++
    bucket.r += data[i]
    bucket.g += data[i + 1]
    bucket.b += data[i + 2]
    buckets.set(key, bucket)
  }
  const picked: Rgb[] = []
  for (const { n, r, g, b } of [...buckets.values()].sort((x, y) => y.n - x.n)) {
    if (picked.length >= count) break
    const c: Rgb = [r / n, g / n, b / n]
    if (picked.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) >= MIN_DISTANCE)) {
      picked.push(c)
    }
  }
  return picked.map(toHex)
}

const palettes = new Map<string, Promise<string[]>>()

/** The palette of an image, sampled from a small copy of it. Cached per source. */
export function paletteOf(src: string): Promise<string[]> {
  let palette = palettes.get(src)
  if (!palette) {
    palette = (async () => {
      const img = new Image()
      img.src = src
      await img.decode()
      const scale = SAMPLE_SIZE / Math.max(img.naturalWidth, img.naturalHeight, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Palette: no 2D canvas context to sample the photo with')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      return extractPalette(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
    })()
    palette.catch(() => palettes.delete(src))
    palettes.set(src, palette)
    if (palettes.size > MAX_CACHED) palettes.delete(palettes.keys().next().value!)
  }
  return palette
}

/** The colour of the canvas pixel under a point on the screen; null where nothing is drawn. */
export function pixelAt(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): string | null {
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor(((clientX - rect.left) * canvas.width) / rect.width)
  const y = Math.floor(((clientY - rect.top) * canvas.height) / rect.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Colour picker: the board canvas has no 2D context to read from')
  const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
  return a ? toHex([r, g, b]) : null
}

interface EyeDropperResult {
  sRGBHex: string
}
type EyeDropperCtor = new () => { open: () => Promise<EyeDropperResult> }

/** The EyeDropper API (Chromium only); null where the browser lacks it. */
export function eyeDropper(): EyeDropperCtor | null {
  return (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper ?? null
}

interface Stored {
  recent: string[]
  saved: string[]
}

const colourList = (v: unknown, max: number) =>
  Array.isArray(v)
    ? [...new Set(v.map(normalizeColour).filter((c): c is string => !!c))].slice(0, max)
    : []

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = (raw ? JSON.parse(raw) : {}) as Partial<Stored>
    return {
      recent: colourList(parsed.recent, MAX_RECENT),
      saved: colourList(parsed.saved, MAX_SAVED),
    }
  } catch {
    return { recent: [], saved: [] }
  }
}

function write(stored: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    /* storage blocked — the swatches last until the tab closes */
  }
}

interface ColourState extends Stored {
  /** Set while the next tap on the board picks a colour (no EyeDropper API). */
  boardPick: ((hex: string) => void) | null
  remember: (colour: string) => void
  toggleSaved: (colour: string) => void
  startBoardPick: (onPick: (hex: string) => void) => void
  endBoardPick: () => void
}

export const useColours = create<ColourState>((set, get) => ({
  ...read(),
  boardPick: null,
  remember(colour) {
    const hex = normalizeColour(colour)
    if (!hex) return
    const recent = [hex, ...get().recent.filter((c) => c !== hex)].slice(0, MAX_RECENT)
    set({ recent })
    write({ recent, saved: get().saved })
  },
  toggleSaved(colour) {
    const hex = normalizeColour(colour)
    if (!hex) return
    const { saved } = get()
    const next = saved.includes(hex)
      ? saved.filter((c) => c !== hex)
      : [...saved, hex].slice(-MAX_SAVED)
    set({ saved: next })
    write({ recent: get().recent, saved: next })
  },
  startBoardPick: (onPick) => set({ boardPick: onPick }),
  endBoardPick: () => set({ boardPick: null }),
}))
