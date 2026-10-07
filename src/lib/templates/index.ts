import type { Background, Frame, StickerElement, TextElement } from '../../types'
import { calendarTexts, weekStart } from './calendar'

export type TemplateCategory = 'occasions' | 'travel' | 'social' | 'print'

/** Board sizes in design units, named by the `aspect.*` key that labels them. */
export const TEMPLATE_SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  story: [1080, 1920],
  pin: [1000, 1500],
  wide: [1280, 720],
  landscape: [1800, 1200],
} as const

export type TemplateSize = keyof typeof TEMPLATE_SIZES

/**
 * A text block. Positions and sizes are fractions of the board (font size of
 * its width), so one definition reads the same at any resolution. A block with
 * `w` wraps and aligns inside that box; one without hugs its words, which is
 * what a chip needs to fit the translated text.
 */
export interface TemplateText {
  /** Translation key of the placeholder words, or `literal` for names and dates. */
  key?: string
  literal?: string
  x: number
  y: number
  w?: number
  size: number
  font: string
  fill: string
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  rotation?: number
  spacing?: number
  lineHeight?: number
  chip?: string
  stroke?: string
}

export interface TemplateSticker {
  emoji: string
  x: number
  y: number
  size: number
  rotation?: number
}

export interface Template {
  id: string
  category: TemplateCategory
  size: TemplateSize
  gridId: string
  gap?: number
  radius?: number
  margin?: number
  background: Partial<Background>
  frame?: Frame
  texts: TemplateText[]
  stickers?: TemplateSticker[]
  /** Fills in this month's dates when applied. */
  calendar?: boolean
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; labelKey: string }[] = [
  { id: 'occasions', labelKey: 'tpl.catOccasions' },
  { id: 'travel', labelKey: 'tpl.catTravel' },
  { id: 'social', labelKey: 'tpl.catSocial' },
  { id: 'print', labelKey: 'tpl.catPrint' },
]

const solid = (color: string): Partial<Background> => ({ type: 'solid', color })
const gradient = (from: string, to: string, angle = 90): Partial<Background> => ({
  type: 'gradient',
  gradientFrom: from,
  gradientTo: to,
  gradientAngle: angle,
})

export const TEMPLATES: Template[] = [
  {
    id: 'birthday-post',
    category: 'occasions',
    size: 'square',
    gridId: 'polaroid-2',
    gap: 0,
    background: gradient('#f9a8d4', '#fde68a'),
    texts: [
      {
        key: 'tpl.text.happyBirthday',
        x: 0.05,
        y: 0.025,
        w: 0.9,
        size: 0.085,
        font: 'Pacifico',
        fill: '#be185d',
      },
      {
        key: 'tpl.text.makeAWish',
        x: 0.05,
        y: 0.72,
        w: 0.9,
        size: 0.07,
        font: 'Caveat',
        fill: '#7c2d12',
      },
    ],
    stickers: [
      { emoji: '🎈', x: 0.06, y: 0.82, size: 0.1, rotation: -10 },
      { emoji: '🎂', x: 0.82, y: 0.82, size: 0.1 },
    ],
  },
  {
    id: 'birthday-story',
    category: 'occasions',
    size: 'story',
    gridId: 'film-4',
    gap: 12,
    background: solid('#fde68a'),
    texts: [
      {
        key: 'tpl.text.itsMyBirthday',
        x: 0.06,
        y: 0.08,
        w: 0.88,
        size: 0.13,
        font: 'Bebas Neue',
        fill: '#111827',
      },
      {
        key: 'tpl.text.cheers',
        x: 0.06,
        y: 0.74,
        w: 0.88,
        size: 0.08,
        font: 'Caveat',
        fill: '#92400e',
      },
    ],
    stickers: [{ emoji: '🎉', x: 0.42, y: 0.86, size: 0.15 }],
  },
  {
    id: 'party-portrait',
    category: 'occasions',
    size: 'portrait',
    gridId: 'polaroid-4',
    gap: 0,
    background: { type: 'pattern', patternId: 'dots', color: '#1e1b4b', patternColor: '#3730a3' },
    texts: [
      {
        key: 'tpl.text.partyTime',
        x: 0.05,
        y: 0.405,
        w: 0.9,
        size: 0.085,
        font: 'Abril Fatface',
        fill: '#fbbf24',
      },
    ],
    stickers: [{ emoji: '🥳', x: 0.44, y: 0.885, size: 0.09 }],
  },
  {
    id: 'wedding-save',
    category: 'occasions',
    size: 'portrait',
    gridId: 'tpl-arch',
    gap: 0,
    background: solid('#fdf6ec'),
    frame: { style: 'solid', color: '#d4b483', width: 0.025 },
    texts: [
      {
        key: 'tpl.text.saveTheDate',
        x: 0.08,
        y: 0.06,
        w: 0.84,
        size: 0.085,
        font: 'Playfair Display',
        fill: '#92400e',
        italic: true,
      },
      {
        literal: 'Anna & Ben',
        x: 0.08,
        y: 0.77,
        w: 0.84,
        size: 0.09,
        font: 'Caveat',
        fill: '#78350f',
      },
      {
        literal: '06 · 06 · 2027',
        x: 0.08,
        y: 0.875,
        w: 0.84,
        size: 0.04,
        font: 'Montserrat',
        fill: '#92400e',
        spacing: 6,
      },
    ],
  },
  {
    id: 'wedding-married',
    category: 'occasions',
    size: 'square',
    gridId: 'tpl-hero',
    gap: 0,
    radius: 24,
    background: solid('#ffffff'),
    texts: [
      {
        key: 'tpl.text.justMarried',
        x: 0.05,
        y: 0.05,
        w: 0.9,
        size: 0.08,
        font: 'Playfair Display',
        fill: '#111827',
      },
      {
        key: 'tpl.text.withLove',
        x: 0.05,
        y: 0.81,
        w: 0.9,
        size: 0.07,
        font: 'Caveat',
        fill: '#9f1239',
      },
    ],
    stickers: [{ emoji: '💍', x: 0.85, y: 0.84, size: 0.08 }],
  },
  {
    id: 'baby-hello',
    category: 'occasions',
    size: 'square',
    gridId: 'tpl-arch',
    gap: 0,
    background: solid('#e0f2fe'),
    texts: [
      {
        key: 'tpl.text.helloWorld',
        x: 0.05,
        y: 0.04,
        w: 0.9,
        size: 0.085,
        font: 'Pacifico',
        fill: '#0369a1',
      },
      {
        key: 'tpl.text.welcomeLittleOne',
        x: 0.05,
        y: 0.8,
        w: 0.9,
        size: 0.05,
        font: 'Montserrat',
        fill: '#0c4a6e',
        bold: true,
      },
    ],
    stickers: [
      { emoji: '⭐', x: 0.06, y: 0.3, size: 0.07, rotation: -12 },
      { emoji: '🍼', x: 0.86, y: 0.55, size: 0.07, rotation: 10 },
    ],
  },
  {
    id: 'christmas',
    category: 'occasions',
    size: 'portrait',
    gridId: 'polaroid-3',
    gap: 0,
    background: solid('#14532d'),
    texts: [
      {
        key: 'tpl.text.merryChristmas',
        x: 0.05,
        y: 0.08,
        w: 0.9,
        size: 0.1,
        font: 'Lobster',
        fill: '#fef3c7',
      },
      {
        key: 'tpl.text.seasonsGreetings',
        x: 0.05,
        y: 0.67,
        w: 0.9,
        size: 0.07,
        font: 'Caveat',
        fill: '#fde68a',
      },
    ],
    stickers: [
      { emoji: '🎄', x: 0.1, y: 0.8, size: 0.1 },
      { emoji: '🎁', x: 0.8, y: 0.8, size: 0.1 },
    ],
  },
  {
    id: 'new-year',
    category: 'occasions',
    size: 'story',
    gridId: 'tpl-hero',
    gap: 0,
    radius: 32,
    background: gradient('#0f172a', '#4c1d95', 90),
    texts: [
      {
        key: 'tpl.text.happyNewYear',
        x: 0.06,
        y: 0.05,
        w: 0.88,
        size: 0.12,
        font: 'Abril Fatface',
        fill: '#fde047',
      },
      {
        key: 'tpl.text.newMemories',
        x: 0.06,
        y: 0.81,
        w: 0.88,
        size: 0.065,
        font: 'Caveat',
        fill: '#e9d5ff',
      },
    ],
    stickers: [{ emoji: '🥂', x: 0.43, y: 0.9, size: 0.12 }],
  },
  {
    id: 'graduation',
    category: 'occasions',
    size: 'portrait',
    gridId: 'tpl-hero',
    gap: 0,
    background: solid('#1e3a8a'),
    texts: [
      {
        key: 'tpl.text.congratsGrad',
        x: 0.05,
        y: 0.05,
        w: 0.9,
        size: 0.085,
        font: 'Abril Fatface',
        fill: '#fde68a',
      },
    ],
    stickers: [{ emoji: '🎓', x: 0.44, y: 0.82, size: 0.12 }],
  },
  {
    id: 'thank-you',
    category: 'occasions',
    size: 'landscape',
    gridId: 'tpl-side',
    gap: 0,
    background: solid('#fef2f2'),
    texts: [
      {
        key: 'tpl.text.thankYou',
        x: 0.04,
        y: 0.28,
        w: 0.38,
        size: 0.075,
        font: 'Pacifico',
        fill: '#be123c',
      },
      {
        key: 'tpl.text.thanksNote',
        x: 0.04,
        y: 0.56,
        w: 0.38,
        size: 0.04,
        font: 'Caveat',
        fill: '#881337',
      },
    ],
  },
  {
    id: 'postcard-greetings',
    category: 'travel',
    size: 'landscape',
    gridId: 'tpl-top',
    gap: 0,
    background: solid('#fffbeb'),
    texts: [
      {
        key: 'tpl.text.greetingsFrom',
        x: 0.05,
        y: 0.635,
        size: 0.055,
        font: 'Pacifico',
        fill: '#b45309',
      },
      {
        key: 'tpl.text.yourPlace',
        x: 0.05,
        y: 0.75,
        size: 0.085,
        font: 'Bebas Neue',
        fill: '#1e3a8a',
      },
    ],
    stickers: [{ emoji: '✈️', x: 0.86, y: 0.72, size: 0.08, rotation: -15 }],
  },
  {
    id: 'wanderlust',
    category: 'travel',
    size: 'pin',
    gridId: 'mag-cover',
    gap: 10,
    background: solid('#ffffff'),
    texts: [
      {
        key: 'tpl.text.wanderlust',
        x: 0.06,
        y: 0.53,
        size: 0.14,
        font: 'Bebas Neue',
        fill: '#111827',
        chip: '#ffffff',
        spacing: 4,
      },
    ],
  },
  {
    id: 'road-trip',
    category: 'travel',
    size: 'story',
    gridId: 'story-3',
    gap: 10,
    background: solid('#111827'),
    texts: [
      {
        key: 'tpl.text.roadTrip',
        x: 0.07,
        y: 0.35,
        size: 0.14,
        font: 'Bebas Neue',
        fill: '#111827',
        chip: '#facc15',
        rotation: -4,
      },
    ],
  },
  {
    id: 'summer',
    category: 'travel',
    size: 'square',
    gridId: '4-grid',
    gap: 16,
    margin: 40,
    radius: 16,
    background: solid('#fef08a'),
    texts: [
      {
        key: 'tpl.text.summerVibes',
        x: 0.12,
        y: 0.43,
        size: 0.08,
        font: 'Pacifico',
        fill: '#ea580c',
        chip: '#ffffff',
        rotation: -6,
      },
    ],
    stickers: [{ emoji: '☀️', x: 0.82, y: 0.04, size: 0.1 }],
  },
  {
    id: 'adventure',
    category: 'travel',
    size: 'portrait',
    gridId: 'tpl-duo-top',
    gap: 0,
    radius: 20,
    background: solid('#ecfccb'),
    texts: [
      {
        key: 'tpl.text.adventureAwaits',
        x: 0.06,
        y: 0.7,
        w: 0.88,
        size: 0.085,
        font: 'Abril Fatface',
        fill: '#365314',
      },
    ],
    stickers: [{ emoji: '🧭', x: 0.45, y: 0.87, size: 0.09 }],
  },
  {
    id: 'travel-diary',
    category: 'travel',
    size: 'pin',
    gridId: 'polaroid-4',
    gap: 0,
    background: { type: 'pattern', patternId: 'grid', color: '#fafaf9', patternColor: '#e7e5e4' },
    texts: [
      {
        key: 'tpl.text.travelDiary',
        x: 0.05,
        y: 0.885,
        w: 0.9,
        size: 0.08,
        font: 'Caveat',
        fill: '#1f2937',
      },
    ],
  },
  {
    id: 'city-break',
    category: 'travel',
    size: 'story',
    gridId: 'tpl-hero',
    gap: 0,
    background: solid('#111827'),
    texts: [
      {
        key: 'tpl.text.yourPlace',
        x: 0.06,
        y: 0.07,
        w: 0.88,
        size: 0.13,
        font: 'Bebas Neue',
        fill: '#f9fafb',
        spacing: 8,
      },
      {
        key: 'tpl.text.weekendGetaway',
        x: 0.06,
        y: 0.81,
        w: 0.88,
        size: 0.045,
        font: 'Montserrat',
        fill: '#9ca3af',
        spacing: 4,
      },
    ],
  },
  {
    id: 'before-after',
    category: 'social',
    size: 'square',
    gridId: '2-v',
    gap: 8,
    background: solid('#ffffff'),
    texts: [
      {
        key: 'tpl.text.before',
        x: 0.04,
        y: 0.9,
        size: 0.045,
        font: 'Montserrat',
        fill: '#ffffff',
        bold: true,
        chip: '#111827',
      },
      {
        key: 'tpl.text.after',
        x: 0.54,
        y: 0.9,
        size: 0.045,
        font: 'Montserrat',
        fill: '#111827',
        bold: true,
        chip: '#ffffff',
      },
    ],
  },
  {
    id: 'moodboard',
    category: 'social',
    size: 'square',
    gridId: 'moodboard',
    gap: 10,
    background: solid('#f5f5f4'),
    texts: [
      {
        key: 'tpl.text.mood',
        x: 0.05,
        y: 0.04,
        size: 0.1,
        font: 'Abril Fatface',
        fill: '#ffffff',
        stroke: '#111827',
      },
    ],
  },
  {
    id: 'story-week',
    category: 'social',
    size: 'story',
    gridId: 'story-5',
    gap: 12,
    background: solid('#ffffff'),
    texts: [
      {
        key: 'tpl.text.thisWeek',
        x: 0.06,
        y: 0.43,
        size: 0.1,
        font: 'Bebas Neue',
        fill: '#111827',
        chip: '#ffffff',
      },
    ],
  },
  {
    id: 'behind-scenes',
    category: 'social',
    size: 'story',
    gridId: 'story-l3',
    gap: 8,
    background: solid('#000000'),
    texts: [
      {
        key: 'tpl.text.behindTheScenes',
        x: 0.06,
        y: 0.9,
        size: 0.05,
        font: 'Montserrat',
        fill: '#ffffff',
        bold: true,
        chip: '#000000',
      },
    ],
  },
  {
    id: 'top-moments',
    category: 'social',
    size: 'portrait',
    gridId: 'mag-banner',
    gap: 8,
    background: solid('#ffffff'),
    texts: [
      {
        key: 'tpl.text.topMoments',
        x: 0.05,
        y: 0.25,
        size: 0.08,
        font: 'Bebas Neue',
        fill: '#ffffff',
        chip: '#f43f5e',
      },
    ],
  },
  {
    id: 'pin-inspiration',
    category: 'social',
    size: 'pin',
    gridId: '5-pinterest',
    gap: 12,
    margin: 24,
    radius: 12,
    background: solid('#fff7ed'),
    texts: [
      {
        key: 'tpl.text.inspiration',
        x: 0.08,
        y: 0.45,
        size: 0.075,
        font: 'Playfair Display',
        fill: '#9a3412',
        italic: true,
        chip: '#ffffff',
      },
    ],
  },
  {
    id: 'pin-recipe',
    category: 'social',
    size: 'pin',
    gridId: 'tpl-top',
    gap: 0,
    background: solid('#fef3c7'),
    texts: [
      {
        key: 'tpl.text.easyRecipe',
        x: 0.06,
        y: 0.64,
        w: 0.88,
        size: 0.1,
        font: 'Abril Fatface',
        fill: '#7c2d12',
      },
      {
        key: 'tpl.text.saveForLater',
        x: 0.06,
        y: 0.84,
        w: 0.88,
        size: 0.045,
        font: 'Montserrat',
        fill: '#92400e',
        spacing: 3,
      },
    ],
  },
  {
    id: 'yt-vlog',
    category: 'social',
    size: 'wide',
    gridId: 'tpl-side',
    gap: 0,
    background: solid('#facc15'),
    texts: [
      {
        key: 'tpl.text.myWeek',
        x: 0.04,
        y: 0.18,
        w: 0.39,
        size: 0.085,
        font: 'Bebas Neue',
        fill: '#111827',
      },
      {
        key: 'tpl.text.watchNow',
        x: 0.04,
        y: 0.76,
        size: 0.035,
        font: 'Montserrat',
        fill: '#ffffff',
        bold: true,
        chip: '#dc2626',
      },
    ],
  },
  {
    id: 'yt-reaction',
    category: 'social',
    size: 'wide',
    gridId: '2-v',
    gap: 6,
    background: solid('#111827'),
    texts: [
      {
        key: 'tpl.text.youWontBelieve',
        x: 0.04,
        y: 0.74,
        size: 0.075,
        font: 'Bebas Neue',
        fill: '#ffffff',
        stroke: '#000000',
      },
    ],
    stickers: [{ emoji: '😱', x: 0.44, y: 0.08, size: 0.12 }],
  },
  {
    id: 'yt-tips',
    category: 'social',
    size: 'wide',
    gridId: '3-1big-left',
    gap: 6,
    background: solid('#ffffff'),
    texts: [
      {
        key: 'tpl.text.tipsTricks',
        x: 0.04,
        y: 0.78,
        size: 0.065,
        font: 'Bebas Neue',
        fill: '#ffffff',
        chip: '#2563eb',
      },
    ],
  },
  {
    id: 'postcard-wish',
    category: 'print',
    size: 'landscape',
    gridId: 'polaroid-3',
    gap: 0,
    background: {
      type: 'pattern',
      patternId: 'stripes',
      color: '#eff6ff',
      patternColor: '#dbeafe',
    },
    texts: [
      {
        key: 'tpl.text.wishYouWereHere',
        x: 0.05,
        y: 0.08,
        w: 0.9,
        size: 0.06,
        font: 'Caveat',
        fill: '#1e3a8a',
      },
    ],
    stickers: [{ emoji: '📮', x: 0.86, y: 0.7, size: 0.07 }],
  },
  {
    id: 'calendar',
    category: 'print',
    size: 'portrait',
    gridId: 'tpl-calendar',
    gap: 0,
    background: solid('#ffffff'),
    texts: [],
    calendar: true,
  },
  {
    id: 'invitation',
    category: 'print',
    size: 'portrait',
    gridId: 'tpl-trio',
    gap: 0,
    radius: 16,
    background: solid('#fff1f2'),
    texts: [
      {
        key: 'tpl.text.youreInvited',
        x: 0.05,
        y: 0.08,
        w: 0.9,
        size: 0.085,
        font: 'Playfair Display',
        fill: '#881337',
        italic: true,
      },
      {
        key: 'tpl.text.joinUs',
        x: 0.05,
        y: 0.8,
        w: 0.9,
        size: 0.045,
        font: 'Montserrat',
        fill: '#9f1239',
      },
    ],
  },
  {
    id: 'our-year',
    category: 'print',
    size: 'square',
    gridId: '9-grid',
    gap: 8,
    margin: 60,
    background: solid('#111827'),
    texts: [
      {
        key: 'tpl.text.ourYear',
        x: 0.1,
        y: 0.44,
        size: 0.065,
        font: 'Abril Fatface',
        fill: '#111827',
        chip: '#ffffff',
      },
    ],
  },
]

export type TemplateElement = Omit<TextElement, 'id'> | Omit<StickerElement, 'id'>

/** What applying a template sets; the editor keeps its photos and fills the cells with them. */
export interface TemplateDocument {
  boardWidth: number
  boardHeight: number
  background: Partial<Background>
  gridId: string
  gridGap: number
  gridRadius: number
  gridMargin: number
  frame: Frame
  elements: TemplateElement[]
}

const NO_FRAME: Frame = { style: 'none', color: '#ffffff', width: 0.04 }

function toText(b: TemplateText, W: number, H: number, t: (key: string) => string) {
  const fontSize = Math.round(b.size * W)
  const style = [b.bold && 'bold', b.italic && 'italic'].filter(Boolean).join(' ')
  const text: Omit<TextElement, 'id'> = {
    type: 'text',
    text: b.literal ?? t(b.key ?? ''),
    fontFamily: `${b.font}, system-ui, sans-serif`,
    fontSize,
    fill: b.fill,
    fontStyle: style || 'normal',
    x: Math.round(b.x * W),
    y: Math.round(b.y * H),
    rotation: b.rotation ?? 0,
    scaleX: 1,
    scaleY: 1,
  }
  if (b.w !== undefined) {
    text.width = Math.round(b.w * W)
    text.align = b.align ?? 'center'
  }
  if (b.spacing) text.letterSpacing = b.spacing
  if (b.lineHeight) text.lineHeight = b.lineHeight
  if (b.chip)
    text.chip = {
      color: b.chip,
      padding: Math.round(fontSize * 0.25),
      radius: Math.round(fontSize * 0.15),
    }
  if (b.stroke) {
    text.stroke = b.stroke
    text.strokeWidth = Math.max(2, Math.round(fontSize * 0.05))
  }
  return text
}

const toSticker = (s: TemplateSticker, W: number, H: number): Omit<StickerElement, 'id'> => ({
  type: 'sticker',
  emoji: s.emoji,
  fontSize: Math.round(s.size * W),
  x: Math.round(s.x * W),
  y: Math.round(s.y * H),
  rotation: s.rotation ?? 0,
  scaleX: 1,
  scaleY: 1,
})

/** Words come out in the current language; a calendar shows the month of `now`. */
export function buildTemplate(
  tpl: Template,
  t: (key: string) => string,
  locale: string,
  now = new Date(),
): TemplateDocument {
  const [W, H] = TEMPLATE_SIZES[tpl.size]
  const texts = tpl.calendar ? calendarTexts(now, locale, weekStart(locale)) : tpl.texts
  return {
    boardWidth: W,
    boardHeight: H,
    background: tpl.background,
    gridId: tpl.gridId,
    gridGap: tpl.gap ?? 0,
    gridRadius: tpl.radius ?? 0,
    gridMargin: tpl.margin ?? 0,
    frame: tpl.frame ?? NO_FRAME,
    elements: [
      ...texts.map((b) => toText(b, W, H, t)),
      ...(tpl.stickers ?? []).map((s) => toSticker(s, W, H)),
    ],
  }
}
