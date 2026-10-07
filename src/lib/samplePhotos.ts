/**
 * Sample photos for "Try with sample photos". Painted on a canvas rather than
 * bundled: four JPEGs would cost more than this whole module, and painting
 * needs no licence for the pictures.
 */

const W = 1200
const H = 900

type Paint = (ctx: CanvasRenderingContext2D, rand: () => number) => void

/** Deterministic, so every visitor (and every test) sees the same pictures. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function sky(ctx: CanvasRenderingContext2D, stops: string[], height = H) {
  const g = ctx.createLinearGradient(0, 0, 0, height)
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, height)
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

function ridge(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  base: number,
  amp: number,
  fill: string,
) {
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x <= W; x += 60) ctx.lineTo(x, base - rand() * amp)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

const SCENES: [string, Paint][] = [
  [
    'sunset',
    (ctx) => {
      sky(ctx, ['#2b1055', '#d53369', '#ffb56b'], H * 0.62)
      disc(ctx, W * 0.5, H * 0.58, 110, '#ffe29a')
      const sea = ctx.createLinearGradient(0, H * 0.62, 0, H)
      sea.addColorStop(0, '#5b2a6e')
      sea.addColorStop(1, '#1b1035')
      ctx.fillStyle = sea
      ctx.fillRect(0, H * 0.62, W, H)
      ctx.fillStyle = 'rgba(255, 226, 154, 0.55)'
      for (let i = 0; i < 9; i++) {
        const w = 220 - i * 20
        ctx.fillRect(W * 0.5 - w / 2, H * 0.65 + i * 26, w, 6)
      }
    },
  ],
  [
    'mountains',
    (ctx, rand) => {
      sky(ctx, ['#4facfe', '#c2e9fb'])
      disc(ctx, W * 0.78, H * 0.2, 60, '#fff8e1')
      ridge(ctx, rand, H * 0.55, 220, '#7d8fb3')
      ridge(ctx, rand, H * 0.7, 160, '#4a5d84')
      ridge(ctx, rand, H * 0.85, 90, '#26344f')
    },
  ],
  [
    'meadow',
    (ctx, rand) => {
      ctx.fillStyle = '#4e9a3f'
      ctx.fillRect(0, 0, W, H)
      sky(ctx, ['#a1e3ff', '#e0f7fa'], H * 0.55)
      ctx.fillStyle = '#7cc56b'
      ctx.beginPath()
      ctx.ellipse(W * 0.3, H, W * 0.7, H * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#4e9a3f'
      ctx.beginPath()
      ctx.ellipse(W * 0.85, H * 1.05, W * 0.6, H * 0.42, 0, 0, Math.PI * 2)
      ctx.fill()
      const petals = ['#ff6b8b', '#ffd93d', '#ffffff', '#c77dff']
      for (let i = 0; i < 140; i++) {
        const y = H * 0.62 + rand() * H * 0.38
        disc(ctx, rand() * W, y, 4 + (y / H) * 8, petals[i % petals.length])
      }
    },
  ],
  [
    'night',
    (ctx, rand) => {
      sky(ctx, ['#0b1026', '#1d2b64', '#3a4a8c'])
      for (let i = 0; i < 220; i++) {
        disc(ctx, rand() * W, rand() * H * 0.7, rand() * 2.2 + 0.4, 'rgba(255,255,255,0.85)')
      }
      disc(ctx, W * 0.24, H * 0.24, 70, '#f4f1de')
      disc(ctx, W * 0.24 + 28, H * 0.24 - 14, 62, '#162152')
      ridge(ctx, rand, H * 0.88, 120, '#0a0f24')
    },
  ],
]

export async function samplePhotos(): Promise<File[]> {
  return Promise.all(
    SCENES.map(([name, paint], i) => {
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx)
        throw new Error('Painting the sample photos needs a 2D canvas, which is unavailable')
      paint(ctx, seeded(i + 1))
      return new Promise<File>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(new File([blob], `sample-${name}.jpg`, { type: 'image/jpeg' }))
              : reject(new Error(`Encoding the ${name} sample photo failed`)),
          'image/jpeg',
          0.85,
        ),
      )
    }),
  )
}
