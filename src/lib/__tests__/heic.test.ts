import { describe, expect, it } from 'vitest'
import { encodableType, isHeic } from '../heic'

const ftyp = (brand: string) => {
  const bytes = new Uint8Array(16)
  bytes.set([0, 0, 0, 24])
  bytes.set(
    Array.from('ftyp' + brand, (c) => c.charCodeAt(0)),
    4,
  )
  return bytes
}

describe('isHeic', () => {
  it('trusts a HEIC or HEIF mime type', async () => {
    expect(await isHeic(new File([], 'a', { type: 'image/heic' }))).toBe(true)
    expect(await isHeic(new File([], 'a', { type: 'image/heif' }))).toBe(true)
  })

  it('falls back to the extension when the picker gives no type', async () => {
    expect(await isHeic(new File([], 'IMG_0001.HEIC'))).toBe(true)
    expect(await isHeic(new File([], 'photo.heif'))).toBe(true)
  })

  it('reads the ftyp brand when type and name say nothing', async () => {
    expect(await isHeic(new File([ftyp('heic')], 'blob'))).toBe(true)
    expect(await isHeic(new File([ftyp('mif1')], 'blob'))).toBe(true)
    expect(await isHeic(new File([ftyp('isom')], 'blob'))).toBe(false)
  })

  it('is false for JPEGs and for files too short to carry a brand', async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'a.jpg', {
      type: 'image/jpeg',
    })
    expect(await isHeic(jpeg)).toBe(false)
    expect(await isHeic(new File([], 'empty'))).toBe(false)
  })
})

describe('encodableType', () => {
  it('keeps the types a canvas can encode', () => {
    expect(encodableType('image/png')).toBe('image/png')
    expect(encodableType('image/webp')).toBe('image/webp')
    expect(encodableType('image/jpeg')).toBe('image/jpeg')
  })

  it('sends HEIC and untyped picks to JPEG', () => {
    expect(encodableType('image/heic')).toBe('image/jpeg')
    expect(encodableType('image/heif')).toBe('image/jpeg')
    expect(encodableType('')).toBe('image/jpeg')
    expect(encodableType('application/octet-stream')).toBe('image/jpeg')
  })

  it('sends types that may be transparent to PNG', () => {
    expect(encodableType('image/gif')).toBe('image/png')
    expect(encodableType('image/avif')).toBe('image/png')
    expect(encodableType('image/svg+xml')).toBe('image/png')
  })
})
