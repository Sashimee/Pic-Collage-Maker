import type { TemplateText } from './index'

/**
 * The first day of the week for a locale, 0 = Sunday. `getWeekInfo` (or the
 * older `weekInfo` getter) is missing in some engines; Monday covers most of
 * the languages the app ships.
 */
export function weekStart(locale: string): number {
  const loc = new Intl.Locale(locale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number }
    weekInfo?: { firstDay: number }
  }
  const firstDay = loc.getWeekInfo?.().firstDay ?? loc.weekInfo?.firstDay ?? 1
  return firstDay % 7
}

/** The month as rows of seven days, `null` where a day belongs to another month. */
export function monthWeeks(year: number, month: number, firstDay: number): (number | null)[][] {
  const days = new Date(year, month + 1, 0).getDate()
  const lead = (new Date(year, month, 1).getDay() - firstDay + 7) % 7
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}

const LEFT = 0.06
const COLUMN = 0.88 / 7

/**
 * A month page: its name, then one text block per weekday column. Columns
 * rather than rows, because proportional digits only line up when each
 * column is centred on its own.
 */
export function calendarTexts(now: Date, locale: string, firstDay: number): TemplateText[] {
  const year = now.getFullYear()
  const month = now.getMonth()
  const weeks = monthWeeks(year, month, firstDay)
  const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  )
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  // 2023-01-01 was a Sunday.
  const dayName = (column: number) =>
    weekday.format(new Date(2023, 0, 1 + ((firstDay + column) % 7)))

  const columns = Array.from({ length: 7 }, (_, c) => c)
  return [
    {
      literal: title.charAt(0).toLocaleUpperCase(locale) + title.slice(1),
      x: LEFT,
      y: 0.52,
      w: 0.88,
      size: 0.075,
      font: 'Playfair Display',
      fill: '#111827',
    },
    ...columns.map((c) => ({
      literal: dayName(c),
      x: LEFT + c * COLUMN,
      y: 0.615,
      w: COLUMN,
      size: 0.03,
      font: 'Montserrat',
      fill: '#6b7280',
      bold: true,
    })),
    ...columns.map((c) => ({
      literal: weeks.map((week) => week[c] ?? '').join('\n'),
      x: LEFT + c * COLUMN,
      y: 0.66,
      w: COLUMN,
      size: 0.034,
      lineHeight: 1.6,
      font: 'Montserrat',
      fill: '#111827',
    })),
  ]
}
