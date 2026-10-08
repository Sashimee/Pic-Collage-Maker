import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { type Dict, type Lang, LANGS, en } from '../translations'
import de from '../locales/de'
import es from '../locales/es'
import fr from '../locales/fr'
import italian from '../locales/it'
import pt from '../locales/pt'

const translations: Record<Lang, Dict> = { en, de, es, fr, it: italian, pt }

const SRC = join(import.meta.dirname, '../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry !== '__tests__') walk(p, out)
    } else if (/\.tsx?$/.test(entry)) {
      out.push(p)
    }
  }
  return out
}

/**
 * Each language is a `Record<string, string>`, so a key that
 * exists nowhere is not a type error — `t()` just renders the raw key. That is
 * how `export.facebook` and `header.newCanvas` shipped to production as visible
 * button labels reading "export.facebook". These tests are the only thing that
 * catches it.
 */
describe('translation keys', () => {
  const files = walk(SRC)

  // Only literal calls; `t(someVar)` can't be checked statically and is rare.
  const used = new Set<string>()
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'\s*[,)]/g)) {
      used.add(m[1])
    }
  }

  it('finds the literal t() calls it is supposed to check', () => {
    expect(used.size).toBeGreaterThan(100)
  })

  it('every key used in the app exists in English', () => {
    // A plural key lives in the map only under its forms.
    const missing = [...used].filter(
      (k) => !(k in translations.en) && !(`${k}.other` in translations.en),
    )
    expect(missing).toEqual([])
  })

  for (const { id } of LANGS) {
    it(`${id} defines every key English defines`, () => {
      const missing = Object.keys(translations.en).filter(
        (k) => !(k in translations[id]),
      )
      expect(missing).toEqual([])
    })

    it(`${id} has no key English lacks`, () => {
      const extra = Object.keys(translations[id]).filter(
        (k) => !(k in translations.en),
      )
      expect(extra).toEqual([])
    })

    it(`${id} uses the same placeholders as English`, () => {
      const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      const mismatched = Object.entries(translations[id])
        .filter(
          ([k, v]) => k in translations.en && names(v).join() !== names(translations.en[k]).join(),
        )
        .map(([k]) => k)
      expect(mismatched).toEqual([])
    })

    it(`${id} has no blank values`, () => {
      const blank = Object.entries(translations[id])
        .filter(([, v]) => v.trim() === '')
        .map(([k]) => k)
      expect(blank).toEqual([])
    })
  }
})
