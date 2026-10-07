# Pro roadmap — Pic Collage Maker

Status: **planned, not started** (written 2026-10-07 against `dev` @ `f32098d`).

Goal: take the app from "feature-complete hobby project" to something that feels
like a paid, professional editor — without breaking the product's core promise:
**100 % client-side, nothing uploaded, no account, works offline.**

## Ground rules for executing this plan

- **Phases run in order.** Phase 0 is a prerequisite for everything else — it
  installs the guard rails (lint, splitting the 1 200-line files, visual
  regression) that keep the later feature work from regressing the canvas.
- **One item = one GitHub issue = one `feat|fix|chore/<issue>-<slug>` branch off
  `dev` = one PR into `dev`.** Create a milestone per phase.
- Every item lists its **done-when**. An item is not done until `npm run lint`,
  `npm run test`, `npm run build` and the e2e suite (`e2e-runner` agent) pass, and
  `canvas-guard` has reviewed anything touching canvas/persistence/export.
- Every new UI string goes through the `i18n-string` agent (all six languages).
- Anything that holds pixels must be wired into `stripPhotoUrls` /
  `rehydratePhotos` (or the background equivalents) and tested **with a reload**.
- Items marked **[dep]** add a runtime dependency and need Alex's explicit OK
  first. Items marked **[Alex]** need input only Alex can give.

---

## Phase 0 — Foundations (do first)

| # | Item | Done when |
| --- | --- | --- |
| 0.1 | **Fix #3** — every shortcut fires twice. Fold `useKeyboard.ts` into `useShortcuts.ts`, delete the duplicate map | One keydown listener; undo steps once; e2e asserts a single undo step |
| 0.2 | **Fix #4** — flaky `custom-layout.spec.ts` | 20 consecutive green runs with `--workers=1 --repeat-each=20` |
| 0.3 | **Real linting.** ESLint flat config: `typescript-eslint`, `eslint-plugin-react-hooks` (catches the hooks-after-`return null` crash in the gotchas), `eslint-plugin-jsx-a11y`; Prettier. Dev deps only. `npm run lint` = tsc + eslint; CI gate | Zero errors on `dev`; rule-of-hooks is `error` |
| 0.4 | **Split the giants.** `Panels.tsx` (1 239 lines) → one file per panel under `components/panels/`; `EditorCanvas.tsx` (869) → gestures / transformer / export handle hooks. Pure move, no behaviour change | No file > 400 lines in `components/`; e2e unchanged |
| 0.5 | **Visual regression.** Playwright `toHaveScreenshot` on the board for every grid layout, each filter preset, text styles, and a PDF/PNG export render | Baselines committed; CI fails on pixel diff |
| 0.6 | **Coverage + component tests.** Vitest coverage thresholds (start at today's number, ratchet up); RTL tests for `ui.tsx` primitives, sheets, LayerPanel | Threshold enforced in CI |
| 0.7 | **Bundle budget.** CI script fails if the eager JS exceeds a budget (today's size + 5 %); verify `pdf-lib` / `jszip` / AI tools are lazy chunks | Budget gate in `ci.yml` |
| 0.8 | **Local crash diagnostics.** `ErrorBoundary` gets "Copy diagnostics" (version, UA, last actions, stack) and "Recover last autosave". Nothing sent anywhere | Forced crash → recover restores the board after reload |
| 0.9 | **Dependency hygiene.** Dependabot (npm + actions, grouped, weekly), CodeQL workflow, `npm audit` step | Workflows green |

## Phase 1 — Pro editing

| # | Item | Done when |
| --- | --- | --- |
| 1.1 | **Two-finger rotate (#2)**, combined with pinch, with 15° snap + haptic tick (`navigator.vibrate` where available) | e2e gesture spec on mobile viewport |
| 1.2 | **Multi-select**: shift-click, marquee drag, select-all; group move/scale/rotate via the shared Transformer | Undo treats a multi-move as one step |
| 1.3 | **Align & distribute** (left/center/right/top/middle/bottom, distribute H/V, align to board) in SelectionBar | Unit tests on the geometry |
| 1.4 | **Layer lock / hide / rename**, opacity per element, **blend modes** (multiply, screen, overlay…) | Persisted and survive reload; exported correctly |
| 1.5 | **Smarter guides**: equal-spacing hints, rulers, centre lines, print **safe-area & bleed** overlay | Toggle in StatusBar; not exported |
| 1.6 | **Crop tool polish**: aspect presets, straighten slider, flip H/V, reset; per-cell crop in grid mode | Crop round-trips through save/reload |
| 1.7 | **Grid controls**: adjustable gutter, outer margin, corner radius; 15+ new presets (magazine, filmstrip, polaroid, story 9:16) | Visual-regression baselines per preset |
| 1.8 | **Photo styling**: border/stroke, drop shadow, rounded corners, polaroid frame | Exported in PNG/PDF/SVG |
| 1.9 | **Text pro**: letter-spacing, line-height, alignment, outline, shadow, gradient fill, background highlight; curated self-hosted font pack (lazy, latin subset, OFL) | Fonts precached only on use; no third-party request |
| 1.10 | **Colour tools**: EyeDropper API (fallback: pick from board), palette extracted from the photos, recent colours, saved swatches | Works in Chrome; graceful fallback in Safari |
| 1.11 | **Advanced adjustments**: curves, levels, per-channel HSL, `.cube` LUT import, before/after hold-to-compare | Filter math unit-tested; StrictMode-safe caching |
| 1.12 | **Copy / paste style** between elements; history list (named undo steps) | — |
| 1.13 | **Sticker & shape library**: SVG sticker packs (self-made or CC0), arrows, badges, speech bubbles | Bundled lazily |

## Phase 2 — Templates & smart layout

| # | Item | Done when |
| --- | --- | --- |
| 2.1 | **Template gallery**: ~30 designed templates (birthday, travel, wedding, Insta post/story, Pinterest, YouTube thumb, postcard, calendar month) with photo placeholders, text and background | Template → swap photos → export, in e2e |
| 2.2 | **Social size presets** in the New flow and export menu (IG 1:1/4:5/9:16, FB, X, Pinterest, A4/Letter, 10×15) | — |
| 2.3 | **Magic layout**: auto-arrange N photos by their aspect ratios (justified/row-packing) and face positions (`faceDetection.ts`) | Deterministic unit tests |
| 2.4 | **Smart fill**: auto-assign photos to cells so faces stay in-frame (smart crop) | — |
| 2.5 | **Save as my template** (local, via IndexedDB) | Survives reload |

## Phase 3 — Performance & big files

| # | Item | Done when |
| --- | --- | --- |
| 3.1 | **Move pixel work off the main thread**: AI tools, style transfer, filter bake and import downscale run in a Web Worker with `OffscreenCanvas` | No long task > 200 ms while applying a tool on a 24 MP photo |
| 3.2 | **Progress + cancel** for every long operation (import, AI, PDF/ZIP/photo book) | — |
| 3.3 | **HEIC/HEIF import** (iPhone default). Native decode where the browser can; otherwise a lazy WASM decoder **[dep]** | iPhone HEIC imports on Chrome/Android |
| 3.4 | **Memory budget**: cap decoded bitmaps, downscale on low-memory devices, extend `useMemoryPressure` | 50-photo project doesn't crash iOS Safari |
| 3.5 | **Lighthouse**: perf gate 0.75 → 0.85, a11y/best-practices/SEO gates ≥ 0.95 | LHCI green |

## Phase 4 — Platform & PWA

| # | Item | Done when |
| --- | --- | --- |
| 4.1 | **Share target**: appear in the Android/desktop share sheet; receive photos (SW handles the POST, hands files to the app) | Share from Gallery → photos land on the board |
| 4.2 | **File handlers**: open `.piccollage` and images from the OS (`file_handlers` + `launchQueue`) | — |
| 4.3 | **Manifest polish**: `shortcuts` (New collage, Open project), `screenshots` (richer install UI), `launch_handler`, `id`, categories | Chrome install dialog shows screenshots |
| 4.4 | **Persistent storage**: `navigator.storage.persist()` after the first save + quota meter in ProjectManager with a "free space" action | — |
| 4.5 | **Backup / restore all projects** into one file (extends `projectFile.ts`) | Round-trip in e2e across a reload |
| 4.6 | **Clipboard**: paste images (Ctrl+V / long-press), copy the board as PNG | — |
| 4.7 | **Desktop save-in-place** via File System Access API (fallback: download) | — |
| 4.8 | **Print** directly (print stylesheet / PDF), with the photo-book sizes | — |
| 4.9 | **Offline guarantee test**: e2e loads, goes offline, edits, exports | — |
| 4.10 | **Capacitor wrapper** for App Store / Play Store **[dep] [Alex]** — separate project decision, needs developer accounts | — |

## Phase 5 — UX polish & accessibility

| # | Item | Done when |
| --- | --- | --- |
| 5.1 | **Command palette** (Ctrl/Cmd+K) over every action + **shortcut cheat sheet** (`?`) | All six languages |
| 5.2 | **Accessibility pass**: axe-core in e2e for every sheet/panel; focus traps and focus return in sheets; full keyboard operation of the canvas (Tab through elements, arrows nudge, Enter edits); LayerPanel as an accessible tree; live-region announcements; WCAG AA contrast in both themes | axe: 0 serious/critical |
| 5.3 | **Design-system pass**: one token set (spacing, radius, elevation, motion durations) in `index.css`; audit every component against it; dark-mode audit | Screenshot baselines updated deliberately |
| 5.4 | **Micro-interactions**: skeletons for thumbnails, optimistic page actions, snap/haptic feedback, toast undo for destructive actions everywhere | — |
| 5.5 | **Demo project**: "Try with sample photos" in the empty state (bundled, small, lazily loaded) | — |
| 5.6 | **Settings sheet**: theme, language, units (mm/in/px), export defaults, autosave interval, analytics opt-out, reset hints | Persisted |
| 5.7 | **i18n upgrade**: interpolation + plurals (`Intl.PluralRules`), `Intl.NumberFormat` for sizes; CI test that every key exists in all six maps; consider NL/PL as languages 7–8 **[Alex]** | — |
| 5.8 | **What's new** sheet driven by the changelog on first launch after an update | — |

## Phase 6 — Trust, privacy, legal

| # | Item | Done when |
| --- | --- | --- |
| 6.1 | **Content-Security-Policy** meta (self + GoatCounter only, no `unsafe-eval`), `Referrer-Policy`, `Permissions-Policy` | App works with CSP; violation-free in e2e |
| 6.2 | **EXIF privacy**: strip GPS by default on export, opt-in to keep; clear UI note | Unit-tested on a geotagged fixture |
| 6.3 | **Privacy page + Impressum** (German operator → Impressum is legally required) **[Alex]** for name/address | Linked from header menu and README |
| 6.4 | `LICENSE`, third-party notices (fonts OFL, stickers), generated at build | — |

## Phase 7 — Release engineering & reach

| # | Item | Done when |
| --- | --- | --- |
| 7.1 | **Versioning**: SemVer, `CHANGELOG.md` from Conventional Commits (release-please), version + build hash shown in the app | `main` releases are tagged |
| 7.2 | **Release checklist** in `docs/` + PR template + issue templates | — |
| 7.3 | **Dev preview deploy**: `dev` published to a `/dev/` subpath (or Cloudflare Pages preview) so changes are seen on a phone before `main` **[Alex]** | — |
| 7.4 | **SEO / landing**: per-language meta + `hreflang`, structured data (`WebApplication`), sitemap, refreshed OG image, short marketing section above the editor fold for search visitors | Lighthouse SEO ≥ 0.95 |
| 7.5 | **Docs refresh**: user guide with screenshots, FAQ, `docs/api.md` updated | — |

## Phase 8 — Stretch: motion

| # | Item | Done when |
| --- | --- | --- |
| 8.1 | **Animated export**: pages as a slideshow / simple element entrance animations → WebM/MP4 via WebCodecs (muxer **[dep]**), GIF fallback | Exports play on iOS and Android |
| 8.2 | Background music track (local file only) | — |

---

## Open decisions for Alex

1. Approve runtime deps: HEIC decoder (3.3), MP4 muxer (8.1), Capacitor (4.10). ESLint/Prettier are dev-only.
2. Impressum details (6.3).
3. Dev preview hosting (7.3).
4. Extra languages (5.7).
5. Autonomy: may Claude push branches and open PRs into `dev` per item without asking each time? (merging `dev` → `main` stays manual.)
