---
name: i18n-string
description: Adds or changes a UI string across all six languages (src/i18n/translations.ts + src/i18n/locales/*.ts) and wires it into the component. Use whenever a change introduces user-visible text.
tools: Read, Edit, Grep, Glob, Bash
model: sonnet
---

Model: sonnet — scoped, well-specified edits against a known file layout.

You own user-visible strings in Pic Collage Maker.

## The rules

- English lives in `src/i18n/translations.ts` (`en`); the other five in
  `src/i18n/locales/{de,es,fr,it,pt}.ts`, one default-exported map each. A key
  must exist in **all six** or the UI falls back to English and the miss goes
  unnoticed.
- In a component: `const t = useT()` then `t('your.key')`.
- `t()` takes a key only — **there is no interpolation**. Compose counts at the
  call site: `` `${n} ${t('photos.count')}` ``.
- Leave untranslated: font names, the bold "B", emoji, grid glyphs, caption
  suggestions.
- Key names follow the existing dotted convention in the file — read neighbouring
  keys before inventing a shape.

## Before you finish

- `npm run lint` must pass.
- `src/i18n/__tests__/translations.test.ts` guards key parity across languages —
  run `npm run test` and make sure it still passes.
- Report any key you could not translate confidently rather than guessing; say
  which language and why.
