import { describe, it, expect } from 'vitest'
import { translate } from '../useLang'
import { en } from '../translations'

const dict = {
  'n.one': '{count} photo',
  'n.other': '{count} photos',
  greet: 'Hello {name}, {name}!',
  plain: 'No vars',
}

describe('translate', () => {
  it('picks the plural form by the language rule', () => {
    expect(translate('en', dict, 'n', { count: 1 })).toBe('1 photo')
    expect(translate('en', dict, 'n', { count: 0 })).toBe('0 photos')
    expect(translate('en', dict, 'n', { count: 2 })).toBe('2 photos')
  })

  it('follows the language, not English, for which counts are singular', () => {
    expect(translate('fr', dict, 'n', { count: 0 })).toBe('0 photo')
    expect(translate('de', dict, 'n', { count: 0 })).toBe('0 photos')
  })

  it('falls back to the other form for a category the map does not define', () => {
    const fr = { 'n.other': '{count} photos' }
    expect(translate('fr', fr, 'n', { count: 1 })).toBe('1 photos')
  })

  it('formats numbers for the language', () => {
    expect(translate('en', dict, 'n', { count: 1234 })).toBe('1,234 photos')
    expect(translate('de', dict, 'n', { count: 1234 })).toBe('1.234 photos')
  })

  it('fills every occurrence of a placeholder and leaves unknown ones visible', () => {
    expect(translate('en', dict, 'greet', { name: 'Ana' })).toBe('Hello Ana, Ana!')
    expect(translate('en', dict, 'greet', {})).toBe('Hello {name}, {name}!')
  })

  it('returns plain strings untouched, and the key when nothing defines it', () => {
    expect(translate('en', dict, 'plain')).toBe('No vars')
    expect(translate('en', dict, 'missing.key', { count: 3 })).toBe('missing.key')
  })

  it('falls back to English for a key the language lacks', () => {
    const key = Object.keys(en)[0]
    expect(translate('de', {}, key)).toBe(en[key])
  })
})
