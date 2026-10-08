import * as piexif from 'piexif'
import type { CanvasElement } from '../types'

/** Convert a base64 string to a binary string for piexif. */
function base64ToBinary(base64: string): string {
  const raw = atob(base64)
  let binary = ''
  for (let i = 0; i < raw.length; i++) {
    binary += String.fromCharCode(raw.charCodeAt(i))
  }
  return binary
}

/** Convert a binary string to a Uint8Array. */
function binaryToUint8(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Convert Uint8Array to base64 data URL prefix based on mime type. */
function uint8ToDataURL(bytes: Uint8Array, mime: string): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  return `data:${mime};base64,${base64}`
}

/** The EXIF with its GPS block and the pointer to it gone, so no coordinates survive a dump. */
export function withoutLocation(exif: piexif.IExif): piexif.IExif {
  const rest = { ...exif }
  delete rest.GPS
  if (exif['0th']) {
    const zeroth = { ...exif['0th'] }
    delete zeroth[piexif.TagValues.ImageIFD.GPSTag]
    rest['0th'] = zeroth
  }
  return rest
}

/**
 * Extract EXIF from the first photo element that has a source blob URL or photoId.
 * Returns the EXIF object (ready for piexif.dump) or null if none found. Where the
 * photo was taken is left out unless `keepLocation` asks for it.
 */
export async function extractFirstExif(
  elements: CanvasElement[],
  { keepLocation = false } = {},
): Promise<piexif.IExif | null> {
  for (const el of elements) {
    if (el.type !== 'photo') continue
    // Prefer reading from the blob URL if it's a data URL (base64 JPEG)
    if (el.src.startsWith('data:image/jpeg')) {
      const base64 = el.src.split(',')[1]
      if (!base64) continue
      const binary = base64ToBinary(base64)
      try {
        const exif = piexif.load(binary)
        // Ensure the Exif IFD exists so piexif.dump won't throw
        if (!exif.Exif) exif.Exif = {}
        return keepLocation ? exif : withoutLocation(exif)
      } catch {
        // ignore unreadable EXIF
      }
    }
    // If it's a blob: URL we can't read it synchronously here; skip.
  }
  return null
}

/**
 * Inject EXIF into a JPEG data URL. If no exif is provided, returns the original dataURL.
 */
export function injectExifIntoJpeg(dataURL: string, exif: piexif.IExif | null): string {
  if (!exif || !dataURL.startsWith('data:image/jpeg')) return dataURL
  const base64 = dataURL.split(',')[1]
  if (!base64) return dataURL

  const binary = base64ToBinary(base64)
  let exifBinary: string
  try {
    exifBinary = piexif.dump(exif)
  } catch {
    return dataURL
  }

  let inserted: string
  try {
    inserted = piexif.insert(exifBinary, binary)
  } catch {
    return dataURL
  }

  const bytes = binaryToUint8(inserted)
  return uint8ToDataURL(bytes, 'image/jpeg')
}
