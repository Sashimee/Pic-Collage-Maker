/** Self-made vector stickers. Every path is drawn in a 120 × 120 box. */
export interface LibraryShape {
  /** Also the `library.<id>` translation key of its name. */
  id: string
  d: string
}

export interface ShapePack {
  id: 'arrows' | 'badges' | 'bubbles' | 'decor'
  labelKey: string
  shapes: LibraryShape[]
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`

function burst(points: number, inner: number, outer: number, cx = 60, cy = 60) {
  const corners = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer
    const a = (Math.PI * i) / points - Math.PI / 2
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  })
  return `M${corners.join(' L')} Z`
}

export const SHAPE_PACKS: ShapePack[] = [
  {
    id: 'arrows',
    labelKey: 'library.arrows',
    shapes: [
      {
        id: 'arrowRight',
        d: 'M0,45 L70,45 L70,20 L120,60 L70,100 L70,75 L0,75 Z',
      },
      {
        id: 'arrowBoth',
        d: 'M0,60 L35,20 L35,45 L85,45 L85,20 L120,60 L85,100 L85,75 L35,75 L35,100 Z',
      },
      {
        id: 'arrowCurve',
        d: 'M10,115 Q10,30 75,30 L75,5 L120,45 L75,85 L75,60 Q40,60 40,115 Z',
      },
      {
        id: 'chevron',
        d: 'M5,10 L45,10 L100,60 L45,110 L5,110 L60,60 Z',
      },
      {
        id: 'arrowUp',
        d: 'M60,0 L105,50 L78,50 L78,120 L42,120 L42,50 L15,50 Z',
      },
    ],
  },
  {
    id: 'badges',
    labelKey: 'library.badges',
    shapes: [
      { id: 'seal', d: burst(16, 50, 60) },
      { id: 'starburst', d: burst(10, 30, 60) },
      {
        id: 'shield',
        d: 'M60,0 L115,18 L110,70 Q100,100 60,120 Q20,100 10,70 L5,18 Z',
      },
      {
        id: 'ribbon',
        d: 'M0,40 L22,40 L22,30 L98,30 L98,40 L120,40 L106,62 L120,84 L98,84 L98,90 L22,90 L22,84 L0,84 L14,62 Z',
      },
      { id: 'tag', d: 'M0,60 L35,20 L120,20 L120,100 L35,100 Z' },
      {
        id: 'pill',
        d: 'M30,30 L90,30 A30,30 0 0,1 90,90 L30,90 A30,30 0 0,1 30,30 Z',
      },
    ],
  },
  {
    id: 'bubbles',
    labelKey: 'library.bubbles',
    shapes: [
      {
        id: 'speech',
        d: 'M20,0 L100,0 Q120,0 120,20 L120,70 Q120,90 100,90 L45,90 L20,115 L25,90 L20,90 Q0,90 0,70 L0,20 Q0,0 20,0 Z',
      },
      {
        id: 'speechRound',
        d: 'M60,5 C95,5 120,25 120,50 C120,75 95,95 60,95 C52,95 45,94 38,92 L12,112 L20,85 C8,77 0,64 0,50 C0,25 25,5 60,5 Z',
      },
      {
        id: 'thought',
        d: [
          circle(40, 40, 28),
          circle(75, 35, 30),
          circle(95, 60, 22),
          circle(60, 65, 28),
          circle(28, 65, 20),
          circle(22, 100, 9),
          circle(10, 115, 5),
        ].join(' '),
      },
      { id: 'shout', d: burst(14, 44, 60) },
    ],
  },
  {
    id: 'decor',
    labelKey: 'library.decor',
    shapes: [
      {
        id: 'sparkle',
        d: 'M60,0 Q66,54 120,60 Q66,66 60,120 Q54,66 0,60 Q54,54 60,0 Z',
      },
      {
        id: 'crown',
        d: 'M0,100 L10,30 L38,62 L60,15 L82,62 L110,30 L120,100 Z',
      },
      {
        id: 'bolt',
        d: 'M72,0 L20,70 L55,70 L40,120 L100,45 L65,45 L88,0 Z',
      },
      {
        id: 'heart',
        d: 'M60,110 C20,80 0,60 0,35 C0,15 15,0 33,0 C45,0 55,7 60,18 C65,7 75,0 87,0 C105,0 120,15 120,35 C120,60 100,80 60,110 Z',
      },
      {
        id: 'cloud',
        d: [circle(32, 75, 25), circle(62, 55, 32), circle(92, 75, 25), circle(62, 80, 22)].join(
          ' ',
        ),
      },
      {
        id: 'flower',
        d: [0, 72, 144, 216, 288]
          .map((deg) => {
            const a = (deg * Math.PI) / 180 - Math.PI / 2
            return circle(60 + 32 * Math.cos(a), 60 + 32 * Math.sin(a), 26)
          })
          .concat(circle(60, 60, 24))
          .join(' '),
      },
    ],
  },
]
