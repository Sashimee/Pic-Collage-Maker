const HEIC_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1'])

/**
 * Whether `file` is HEIC/HEIF. Pickers often report an empty or generic type for iPhone photos,
 * so the extension and then the ISO-BMFF `ftyp` brand are checked as well.
 */
export async function isHeic(file: Blob & { name?: string }): Promise<boolean> {
  if (HEIC_TYPES.has(file.type)) return true
  if (file.name && /\.hei[cf]$/i.test(file.name)) return true
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (head.length < 12) return false
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to))
  return ascii(4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(8, 12))
}

/** A HEIC photo this browser has no decoder for. */
export class HeicUnsupportedError extends Error {
  constructor(name: string) {
    super(`This browser cannot open HEIC photos (${name})`)
    this.name = 'HeicUnsupportedError'
  }
}

const CANVAS_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * The type to re-encode a variant as. Canvases only encode these three; anything else that may
 * carry transparency (GIF, AVIF, SVG) goes to PNG so it does not turn black.
 */
export const encodableType = (type: string) => {
  if (CANVAS_TYPES.has(type)) return type
  if (!type || type === 'application/octet-stream' || HEIC_TYPES.has(type)) return 'image/jpeg'
  return 'image/png'
}
