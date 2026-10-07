import abrilFatface from '../assets/fonts/pack/pack-abril-fatface.woff2?url'
import bebasNeue from '../assets/fonts/pack/pack-bebas-neue.woff2?url'
import caveat from '../assets/fonts/pack/pack-caveat.woff2?url'
import lobster from '../assets/fonts/pack/pack-lobster.woff2?url'
import montserrat from '../assets/fonts/pack/pack-montserrat.woff2?url'
import pacifico from '../assets/fonts/pack/pack-pacifico.woff2?url'
import playfairDisplay from '../assets/fonts/pack/pack-playfair-display.woff2?url'
import spaceMono from '../assets/fonts/pack/pack-space-mono.woff2?url'

/**
 * Self-hosted OFL fonts (latin subset, see assets/fonts/pack/OFL.txt). Nothing
 * here is fetched until a text element uses the family, and the service worker
 * keeps them out of the precache so they are cached only once used.
 */
export const FONT_PACK: readonly { family: string; url: string }[] = [
  { family: 'Montserrat', url: montserrat },
  { family: 'Playfair Display', url: playfairDisplay },
  { family: 'Abril Fatface', url: abrilFatface },
  { family: 'Bebas Neue', url: bebasNeue },
  { family: 'Lobster', url: lobster },
  { family: 'Pacifico', url: pacifico },
  { family: 'Caveat', url: caveat },
  { family: 'Space Mono', url: spaceMono },
]

const loads = new Map<string, Promise<void>>()

/** The first family of a CSS font-family list, unquoted. */
export function primaryFamily(fontFamily: unknown): string {
  if (typeof fontFamily !== 'string') return ''
  return fontFamily
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
}

/**
 * Loads a pack font once, for every caller. Resolves when it can be drawn;
 * returns null for a family that is not in the pack. A failed load is
 * forgotten so the next use retries it.
 */
export function loadPackFont(family: string): Promise<void> | null {
  const font = FONT_PACK.find((f) => f.family === family)
  if (!font) return null
  let load = loads.get(family)
  if (!load) {
    const face = new FontFace(family, `url(${font.url})`)
    // Added before loading so document.fonts.ready waits for it.
    document.fonts.add(face)
    load = face.load().then(
      () => undefined,
      (err: unknown) => {
        loads.delete(family)
        document.fonts.delete(face)
        throw new Error(`Font pack: could not load "${family}" from ${font.url}`, { cause: err })
      },
    )
    loads.set(family, load)
  }
  return load
}
