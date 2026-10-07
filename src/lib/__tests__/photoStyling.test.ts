import { describe, it, expect } from 'vitest'
import { resolveStyling } from '../photoStyling'
import type { PhotoStyling } from '../../types'

const photo = (styling?: PhotoStyling, shape: 'rect' | 'circle' = 'rect') => ({
  width: 400,
  height: 300,
  shape,
  styling,
})

describe('resolveStyling', () => {
  it('draws nothing extra for an unstyled photo', () => {
    expect(resolveStyling(photo())).toEqual({ radius: 0, border: null, shadow: null, card: null })
  })

  it('caps the corner radius at half the short side', () => {
    expect(resolveStyling(photo({ radius: 999 })).radius).toBe(150)
  })

  it('ignores radius and polaroid on a shaped photo, but keeps border and shadow', () => {
    const r = resolveStyling(
      photo({ radius: 40, polaroid: true, borderWidth: 6, shadowBlur: 10 }, 'circle'),
    )
    expect(r.radius).toBe(0)
    expect(r.card).toBeNull()
    expect(r.border?.width).toBe(6)
    expect(r.shadow?.blur).toBe(10)
  })

  it('fills in default colours', () => {
    const r = resolveStyling(photo({ borderWidth: 4, shadowOffset: 8 }))
    expect(r.border).toEqual({ width: 4, color: '#ffffff' })
    expect(r.shadow).toEqual({ blur: 0, offset: 8, color: '#000000' })
  })

  it('treats a zero or negative width and shadow as off', () => {
    const r = resolveStyling(photo({ borderWidth: 0, shadowBlur: -3, shadowOffset: 0 }))
    expect(r.border).toBeNull()
    expect(r.shadow).toBeNull()
  })

  it('puts the polaroid card around the photo with a deeper bottom edge', () => {
    const { card } = resolveStyling(photo({ polaroid: true }))
    expect(card).not.toBeNull()
    const top = -card!.y
    const bottom = card!.y + card!.height - 300
    expect(card!.x).toBe(card!.y)
    expect(card!.width).toBeCloseTo(400 + 2 * top)
    expect(bottom).toBeGreaterThan(top * 3)
  })

  it('treats malformed values from a loaded file as unset', () => {
    const hostile = {
      radius: 'abc',
      borderWidth: Infinity,
      borderColor: 5,
      shadowBlur: NaN,
      shadowOffset: 8,
      shadowColor: {},
      polaroid: 'false',
    } as unknown as PhotoStyling
    expect(resolveStyling(photo(hostile))).toEqual({
      radius: 0,
      border: null,
      shadow: { blur: 0, offset: 8, color: '#000000' },
      card: null,
    })
    expect(
      resolveStyling(photo({ borderWidth: 4, borderColor: 7 } as unknown as PhotoStyling)).border,
    ).toEqual({ width: 4, color: '#ffffff' })
  })
})
