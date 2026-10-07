import { describe, it, expect } from 'vitest'
import { TEMPLATES, TEMPLATE_CATEGORIES, TEMPLATE_SIZES, buildTemplate } from '../templates'
import { calendarTexts, monthWeeks, weekStart } from '../templates/calendar'
import { getGridById } from '../grids'
import { en } from '../../i18n/translations'
import type { TextElement } from '../../types'

const echo = (key: string) => `<${key}>`

describe('templates', () => {
  it('ships about thirty templates with unique ids in every category', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(30)
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length)
    for (const c of TEMPLATE_CATEGORIES) {
      expect(en[c.labelKey]).toBeTruthy()
      expect(TEMPLATES.some((t) => t.category === c.id)).toBe(true)
    }
  })

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s builds onto a real layout', (_, tpl) => {
    expect(getGridById(tpl.gridId)).toBeDefined()
    expect(en[`aspect.${tpl.size}`]).toBeTruthy()
    for (const text of tpl.texts) if (text.key) expect(en[text.key]).toBeTruthy()

    const doc = buildTemplate(tpl, (k) => en[k], 'en', new Date(2026, 9, 7))
    const [W, H] = TEMPLATE_SIZES[tpl.size]
    expect(doc.elements.some((e) => e.type === 'text')).toBe(true)
    for (const el of doc.elements) {
      expect(el.x).toBeGreaterThanOrEqual(0)
      expect(el.y).toBeGreaterThanOrEqual(0)
      expect(el.y).toBeLessThan(H)
      if (el.type === 'text' && el.width !== undefined)
        expect(el.x + el.width).toBeLessThanOrEqual(W)
      else expect(el.x).toBeLessThan(W)
    }
  })

  it('scales fractions to the board and translates only keyed words', () => {
    const tpl = TEMPLATES.find((t) => t.id === 'wedding-save')!
    const doc = buildTemplate(tpl, echo, 'en')
    const [title, names] = doc.elements as TextElement[]
    expect(doc).toMatchObject({ boardWidth: 1080, boardHeight: 1350, gridId: 'tpl-arch' })
    expect(title).toMatchObject({
      text: '<tpl.text.saveTheDate>',
      fontSize: Math.round(0.085 * 1080),
      fontStyle: 'italic',
      width: Math.round(0.84 * 1080),
      align: 'center',
    })
    expect(names.text).toBe('Anna & Ben')
  })

  it('gives a chip text no width, so the chip hugs the translated words', () => {
    const tpl = TEMPLATES.find((t) => t.id === 'road-trip')!
    const [chip] = buildTemplate(tpl, echo, 'en').elements as TextElement[]
    expect(chip.width).toBeUndefined()
    expect(chip.chip).toMatchObject({ color: '#facc15' })
    expect(chip.chip!.padding).toBeGreaterThan(0)
  })
})

describe('calendar', () => {
  it('lays October 2026 out from Monday and from Sunday', () => {
    const monday = monthWeeks(2026, 9, 1)
    expect(monday[0]).toEqual([null, null, null, 1, 2, 3, 4])
    expect(monday).toHaveLength(5)
    expect(monday.at(-1)).toEqual([26, 27, 28, 29, 30, 31, null])

    const sunday = monthWeeks(2026, 9, 0)
    expect(sunday[0]).toEqual([null, null, null, null, 1, 2, 3])
  })

  it('needs only four rows for a February that starts on the first day', () => {
    expect(monthWeeks(2026, 1, 0)).toHaveLength(4)
  })

  it('starts the German week on Monday', () => {
    expect(weekStart('de')).toBe(1)
    expect(weekStart('en')).toBeGreaterThanOrEqual(0)
    expect(weekStart('en')).toBeLessThan(7)
  })

  it('titles the page with the month and puts each date in its weekday column', () => {
    const [title, ...rest] = calendarTexts(new Date(2026, 9, 7), 'en', 1)
    expect(title.literal).toBe('October 2026')
    const headers = rest.slice(0, 7)
    const columns = rest.slice(7)
    expect(headers).toHaveLength(7)
    expect(columns).toHaveLength(7)
    expect(columns[3].literal!.split('\n')).toEqual(['1', '8', '15', '22', '29'])
    expect(columns[0].literal!.split('\n')[0]).toBe('')
  })

  it('capitalises month names that the locale writes in lower case', () => {
    const [title] = calendarTexts(new Date(2026, 9, 7), 'es', 1)
    expect(title.literal!.charAt(0)).toBe('O')
  })
})
