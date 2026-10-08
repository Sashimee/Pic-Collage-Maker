import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as piexif from 'piexif'
import { describe, expect, it } from 'vitest'
import { extractFirstExif, injectExifIntoJpeg, withoutLocation } from '../exifHelpers'
import type { CanvasElement } from '../../types'

const GEOTAGGED = `data:image/jpeg;base64,${readFileSync(join(import.meta.dirname, 'fixtures/geotagged.jpg')).toString('base64')}`
const { GPSTag } = piexif.TagValues.ImageIFD
const { GPSLatitude } = piexif.TagValues.GPSIFD

const photo = (src: string) => ({ id: 'p', type: 'photo', src }) as CanvasElement

/** What a viewer reading the exported file back would see. */
const readBack = (dataURL: string) => piexif.load(atob(dataURL.split(',')[1]))

describe('the geotagged fixture', () => {
  it('carries coordinates, or the tests below prove nothing', () => {
    const exif = readBack(GEOTAGGED)
    expect(exif.GPS?.[GPSLatitude]).toEqual([
      [52, 1],
      [31, 1],
      [12, 1],
    ])
    expect(exif['0th']?.[GPSTag]).toBeDefined()
  })
})

describe('extractFirstExif', () => {
  it('drops the location by default and keeps the rest', async () => {
    const exif = await extractFirstExif([photo(GEOTAGGED)])
    expect(exif?.GPS).toBeUndefined()
    expect(exif?.['0th']?.[GPSTag]).toBeUndefined()
    expect(exif?.['0th']?.[piexif.TagValues.ImageIFD.Make]).toBe('FixtureCam')
  })

  it('keeps the location when asked to', async () => {
    const exif = await extractFirstExif([photo(GEOTAGGED)], { keepLocation: true })
    expect(exif?.GPS?.[GPSLatitude]).toBeDefined()
  })

  it('finds nothing in a photo that is not a JPEG data URL', async () => {
    expect(await extractFirstExif([photo('blob:http://x/1')])).toBeNull()
    expect(await extractFirstExif([])).toBeNull()
  })
})

describe('an exported JPEG', () => {
  it('has no GPS block once written with the default EXIF', async () => {
    const exported = injectExifIntoJpeg(GEOTAGGED, await extractFirstExif([photo(GEOTAGGED)]))
    const exif = readBack(exported)
    expect(exif.GPS ?? {}).toEqual({})
    expect(exif['0th']?.[GPSTag]).toBeUndefined()
    expect(exif['0th']?.[piexif.TagValues.ImageIFD.Model]).toBe('Geo 1')
  })

  it('still has it when the location was kept', async () => {
    const exif = await extractFirstExif([photo(GEOTAGGED)], { keepLocation: true })
    expect(readBack(injectExifIntoJpeg(GEOTAGGED, exif)).GPS?.[GPSLatitude]).toBeDefined()
  })
})

describe('withoutLocation', () => {
  it('leaves the input alone', () => {
    const exif = readBack(GEOTAGGED)
    withoutLocation(exif)
    expect(exif.GPS).toBeDefined()
    expect(exif['0th']?.[GPSTag]).toBeDefined()
  })

  it('copes with EXIF that never had a 0th IFD', () => {
    expect(withoutLocation({ GPS: { 1: 'N' } })).toEqual({})
  })
})
