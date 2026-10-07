import { describe, it, expect } from 'vitest'
import { EXPORT_PRESETS, PRESET_CATEGORIES } from '../exportPresets'
import { en } from '../../i18n/translations'

const byId = (id: string) => EXPORT_PRESETS.find((p) => p.id === id)

describe('size presets', () => {
  it('has unique ids', () => {
    expect(new Set(EXPORT_PRESETS.map((p) => p.id)).size).toBe(EXPORT_PRESETS.length)
  })

  it('covers the common social and print sizes', () => {
    expect(byId('ig-post')).toMatchObject({ width: 1080, height: 1080 })
    expect(byId('ig-portrait')).toMatchObject({ width: 1080, height: 1350 })
    expect(byId('ig-story')).toMatchObject({ width: 1080, height: 1920 })
    expect(byId('a4-portrait')).toMatchObject({ width: 2480, height: 3508 })
    expect(byId('letter-portrait')).toMatchObject({ width: 2550, height: 3300 })
    expect(byId('photo-10x15')).toMatchObject({ width: 1181, height: 1772 })
  })

  it('puts every preset in a listed category and leaves no category empty', () => {
    const ids = PRESET_CATEGORIES.map((c) => c.id)
    for (const p of EXPORT_PRESETS) expect(ids).toContain(p.category)
    for (const id of ids) expect(EXPORT_PRESETS.some((p) => p.category === id)).toBe(true)
  })

  it('has an English label for every preset and category', () => {
    const keys = [...EXPORT_PRESETS, ...PRESET_CATEGORIES].map((p) => p.labelKey)
    expect(keys.filter((k) => !(k in en))).toEqual([])
  })

  it('uses positive whole-pixel sizes', () => {
    for (const p of EXPORT_PRESETS) {
      expect(Number.isInteger(p.width) && p.width > 0).toBe(true)
      expect(Number.isInteger(p.height) && p.height > 0).toBe(true)
    }
  })
})
