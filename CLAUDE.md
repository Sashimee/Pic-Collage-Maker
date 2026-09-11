# Pic Collage Maker — project guide

A **Pic Collage Maker** — a photo collage maker & editor that runs **100 %
client-side** in the browser. No backend, no account, nothing uploaded; the build
is static files hosted for free on GitHub Pages, installable as a PWA on iPhone
and Android. Multilingual UI (**DE / EN / ES / FR / IT / PT**).

> **Read the [Git workflow](#git-workflow) section before committing anything.**
> Short version: branch every feature off `dev`; **never push or merge without
> the user's explicit go-ahead.**

---

## Tech stack

| Concern | Choice | Notes |
| --- | --- | --- |
| UI | **React 19** + **TypeScript** | function components + hooks |
| Build/dev | **Vite 8** (`@vitejs/plugin-react`) | HMR, static build to `dist/` |
| Canvas editor | **konva** + **react-konva 19** | `Stage → Layer → board Group → nodes` |
| Styling | **Tailwind v4** via `@tailwindcss/vite` | no PostCSS config; `@import "tailwindcss"` in `src/index.css` |
| State | **zustand** | `src/store/editorStore.ts`, `src/i18n/useLang.ts` |
| PWA | **vite-plugin-pwa** | manifest + service worker, `registerType: 'autoUpdate'` |
| Hosting | **GitHub Pages** | `.github/workflows/deploy.yml` on push to `main` |
| Motion / icons | **framer-motion** + **lucide-react** | animations + icon set |
| Export / misc | **pdf-lib**, **jszip**, **canvas-confetti**, **piexif**, **idb** | PDF/ZIP export, confetti, EXIF, IndexedDB |
| Analytics | **GoatCounter** (no npm dep) | cookieless visit + funnel counts, `src/lib/analytics.ts`; honours DNT/GPC, skips localhost |

Core editor logic (filters, snapping, grids, i18n, image processing, the
"AI" photo tools) stays **hand-rolled and dependency-light**. The libraries
above are the deliberate exceptions (UI polish + heavier export formats);
all image processing runs on-device and **no photo or user content is ever sent
anywhere**. The only outbound requests are a same-origin `version.json` poll for
PWA update detection and a cookieless GoatCounter beacon (`src/lib/analytics.ts`)
that records anonymous visit + funnel counts. Don't add runtime deps casually.

## Commands

```bash
npm run dev            # dev server with HMR (http://localhost:5173/<base>/)
npm run build          # tsc -b && vite build  →  dist/
npm run preview        # serve the production build locally
npm run lint           # type-check only (tsc -b --noEmit)
npm run test           # vitest run (unit)
npm run test:e2e       # playwright, e2e/playwright.config.ts (starts its own dev server)
npm run build:lh       # root-based build into dist-lh/, for Lighthouse only — see gotchas
npm run generate:icons # regenerate PWA PNG icons from scripts/generate-icons.mjs
```

The e2e suite is the main regression net; run it before shipping anything that
touches the canvas, persistence or export. In a sandbox whose Chromium isn't the
build Playwright pins, add `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium`, and
`--workers=1` to match CI (the gesture specs are sensitive to contention).

## Directory map

```
Pic-Collage-Maker/
├── index.html                  # entry HTML: fonts, PWA/apple meta, viewport (no user-scalable)
├── vite.config.ts              # base path + react/tailwind/PWA plugins + manifest
├── package.json                # name: pic-collage-maker
├── tsconfig*.json              # app + node project references
├── vitest.config.ts            # unit-test config (jsdom, src/test-setup.ts)
├── scripts/
│   ├── generate-icons.mjs      # dependency-free PNG icon generator (zlib) → public/
│   └── generate-og.mjs         # Open Graph share image
├── public/                     # favicon.svg + generated pwa-*.png / apple-touch-icon.png
├── docs/
│   ├── user-guide.md           # end-user documentation
│   ├── api.md                  # module/API notes
│   └── adr/                    # 0001 client-only architecture, 0002 konva stays
├── e2e/                        # playwright: 15 specs + helpers.ts + playwright.config.ts
├── .github/
│   ├── lighthouserc.json       # LHCI thresholds (see gotchas: needs `npm run build:lh`)
│   └── workflows/              # ci.yml, deploy.yml (Pages), lighthouse.yml
└── src/
    ├── main.tsx                # React root
    ├── App.tsx                 # layout shell (Header / Canvas+SelectionBar / Docks) + export flow
    ├── index.css               # Tailwind import + base/touch styles
    ├── types.ts                # CanvasElement union, Background, Grid types, DEFAULT_FILTERS
    ├── test-setup.ts           # vitest DOM/canvas stubs
    ├── store/
    │   ├── editorStore.ts      # zustand: elements, selection, background, mode, z-order, actions
    │   ├── projectsStore.ts    # named projects in IndexedDB + autosave + the page list
    │   ├── versionStore.ts     # version history snapshots (deduped, capped at MAX_SNAPSHOTS)
    │   ├── workspaceStore.ts   # panel layout / active tab persistence
    │   └── toastStore.ts       # toasts, with an optional action button
    ├── services/
    │   └── localProjects.ts    # the IndexedDB project store (no network — see gotchas)
    ├── i18n/
    │   ├── translations.ts     # Lang type, LANGS (flags), 6-language string maps
    │   ├── useLang.ts          # lang store (detect+persist) + useT() translator hook
    │   └── useTheme.ts         # light/dark theme store
    ├── assets/fonts/           # self-hosted Poppins (latin subset) — see gotchas
    ├── ai/                     # on-device "AI" tools — all pure pixel math, no network, no model download
    │   ├── autoEnhance.ts      # one-tap exposure/contrast correction
    │   ├── bgRemoval.ts        # background removal
    │   ├── faceDetection.ts    # brightness-contrast face regions, for smart crop / retouch
    │   ├── healTool.ts         # blemish/heal brush state + canvas helpers
    │   ├── portraitRetouch.ts  # skin smoothing / eye + teeth work
    │   ├── styleTransfer.ts    # oil / sketch / pop-art styles
    │   └── textSuggestions.ts  # analyzePhoto() → caption suggestions
    ├── hooks/
    │   ├── useImage.ts         # URL → decoded HTMLImageElement
    │   ├── useMediaQuery.ts    # useIsDesktop() and friends
    │   ├── usePointerReorder.ts# axis-agnostic drag-to-reorder (LayerPanel, PageStrip)
    │   ├── usePageThumbs.ts    # page photo thumbs out of IndexedDB, with URL revocation
    │   ├── useScrollOverflow.ts# scroll-position → fade/arrow affordances (Docks, ActionSheet)
    │   ├── useContextMenu.ts   # right-click / long-press menu state
    │   ├── useMemoryPressure.ts# drops caches when the device is under memory pressure
    │   ├── useVersionCheck.ts  # same-origin version.json poll → UpdateBanner
    │   ├── useShortcuts.ts     # the main keyboard map (undo, copy/paste, nudge, save/export)
    │   └── useKeyboard.ts      # a second, overlapping shortcut map — see issue #3
    ├── lib/
    │   ├── grids.ts            # grid presets (GRID_LAYOUTS) + cellRect/assignSlots
    │   ├── customLayout.ts     # draw-your-own layouts: polygon zones, stroke → split/circle
    │   ├── customLayoutStorage.ts # saved custom layouts in localStorage
    │   ├── cellShapes.ts       # CELL_SHAPE_PRESETS: per-cell shape masks
    │   ├── shapes.ts           # PHOTO_SHAPES + tracePhotoShape() clip paths
    │   ├── patterns.ts         # pattern background tiles + their glyphs
    │   ├── filters.ts          # FILTER_PRESETS + computeFilterConfig() → Konva filter stack
    │   ├── snap.ts             # computeSnap(): alignment guides while dragging
    │   ├── emojis.ts           # EMOJI_CATEGORIES for the sticker picker
    │   ├── fonts.ts            # custom font upload → IndexedDB + FontFace registration
    │   ├── importPhotos.ts     # File → orig/preview(1080px)/thumb blobs + object URLs
    │   ├── importFiles.ts      # file-picker / drop entry point into importPhotos
    │   ├── exifHelpers.ts      # read EXIF off imports, re-inject it into exported JPEGs
    │   ├── persistence.ts      # the IndexedDB photo blob store (putPhoto/getPhoto)
    │   ├── photoRehydrate.ts   # strip blob: URLs before persisting, rebuild them on load
    │   ├── projectSchema.ts    # ProjectDocument (schema 2): pages + activePage, w/ migration
    │   ├── projectFile.ts      # .piccollage pack/unpack (project + photos as one file)
    │   ├── pagePreview.ts      # page → CSS background + photo rects, for the page strip
    │   ├── renderPages.tsx     # off-screen Konva stage: any page → a bitmap
    │   ├── photoBook.ts        # mm/pt/px page sizes at 300 DPI + buildPhotoBook()
    │   ├── exportImage.ts      # exportBoard(), download, Web Share
    │   ├── exportPDF.ts        # pdf-lib; takes an *array* of pages
    │   ├── exportSVG.ts        # board → SVG string + download
    │   ├── exportPresets.ts    # named size/format presets for the export menu
    │   ├── batchExport.ts      # every page → a ZIP (jszip)
    │   ├── firstUse.ts         # one record of which hints have been seen
    │   ├── pwaInstall.ts       # beforeinstallprompt store + platform detection
    │   ├── analytics.ts        # cookieless GoatCounter beacon (honours DNT/GPC)
    │   └── confetti.ts         # canvas-confetti burst on export
    └── components/
        ├── EditorCanvas.tsx    # Konva stage, board group, gestures, transformer, export handle
        ├── CanvasNodes.tsx     # ElementNode dispatcher: PhotoNode / TextNode / StickerNode
        ├── BoardScene.tsx      # the exportable board: background + photos + frame
        ├── Background.tsx      # solid / gradient / pattern / photo board background
        ├── BoardFrame.tsx      # the board's border/frame overlay
        ├── GridView.tsx        # grid-mode: clipped cover-fit photo cells + placeholders
        ├── LayoutGallery.tsx   # the layout picker
        ├── LayoutPreview.tsx   # one layout drawn as a thumbnail
        ├── CustomLayoutEditor.tsx  # draw-your-own layout surface
        ├── CustomLayoutToolbar.tsx # its tool row
        ├── CropOverlay.tsx     # crop handles over the selected photo
        ├── PhotoAssignmentSheet.tsx # pick which photo goes in which cell
        ├── PageStrip.tsx       # rail of pages under the canvas: add/switch/reorder/delete
        ├── PageThumb.tsx       # one page as plain DOM (background + positioned photos)
        ├── LayerPanel.tsx      # layer list: reorder / duplicate / delete / group
        ├── Panels.tsx          # Photos / Layout / Text / Stickers / Background / Filters panels
        ├── panels.config.tsx   # PANEL_TABS + usePanels() — the panel registry
        ├── FilterPanel.tsx     # the filter stack UI
        ├── WatermarkPanel.tsx  # watermark + print marks
        ├── PhotoBookSheet.tsx  # photo book options + progress
        ├── ProjectManager.tsx  # saved projects: open / rename / duplicate / delete
        ├── VersionHistoryPanel.tsx # version snapshots, restore
        ├── WorkspacePresets.tsx# saved panel layouts
        ├── FontUploader.tsx    # custom font upload
        ├── Docks.tsx        # MobileTabBar + MobileSheet + the desktop docks
        ├── SelectionBar.tsx    # floating per-element actions (dup / layer / delete)
        ├── HeaderBar.tsx       # brand, LangSwitcher, New, Export menu
        ├── StatusBar.tsx       # zoom / size / hint line
        ├── ZoomControls.tsx    # zoom in/out/fit buttons
        ├── FullScreen.tsx      # useFullScreen() + its button
        ├── ActionSheet.tsx / BottomSheet.tsx  # sheet primitives
        ├── Onboarding.tsx      # first-run overlay
        ├── GestureDemo.tsx     # animated inline-SVG demos of the four gestures
        ├── TipToast.tsx        # first-use gesture tips, on the toast host
        ├── ToastContainer.tsx  # toast host
        ├── InstallSheet.tsx    # PWA install instructions per platform
        ├── UpdateBanner.tsx    # "new version available" banner (useVersionCheck)
        ├── EmptyState.tsx      # the no-photos-yet state
        ├── ErrorBoundary.tsx   # top-level crash boundary
        ├── LangSwitcher.tsx    # 🇩🇪 / 🇬🇧 flag buttons
        ├── motion.tsx          # MotionProvider — LazyMotion + reduced motion (see gotchas)
        └── ui.tsx              # Slider / ColorField / Chip / PrimaryButton primitives
```

## Data model (`src/types.ts`)

Everything drawn on the board is a **`CanvasElement`** — a discriminated union
keyed by `type`:

```ts
type CanvasElement = PhotoElement | TextElement | StickerElement
// BaseElement: id, type, x, y, rotation, scaleX, scaleY  (positions are BOARD units)
// PhotoElement:   src, width, height, filters: PhotoFilters
// TextElement:    text, fontFamily, fontSize, fill, fontStyle
// StickerElement: emoji, fontSize
```

Plus `Background` (`solid | gradient`, colours, angle), `EditorMode`
(`free | grid`), and normalised `GridLayout` / `GridCell`.

**To add a new element type:** extend the union in `types.ts` → add an `add*`
action in `editorStore.ts` → add a `case` in `ElementNode`
(`src/components/CanvasNodes.tsx`). The shared `Transformer` (move/resize/rotate)
then works for it automatically.

## State (`src/store/editorStore.ts`)

Single zustand store. Fields: `boardWidth/boardHeight` (design units, default
1080×1350), `background`, `mode`, `gridId`, `elements`, `selectedId`.

Actions: `addPhoto`, `addText`, `addSticker`, `updateElement`, `updateFilters`,
`duplicateElement`, `removeElement`, `select`, `bringForward`, `sendBackward`,
`bringToFront`, `sendToBack`, `setBackground`, `setMode`, `setGrid`,
`setBoardSize`, `clearAll`; selector `selected()`.

- **z-order = array order** — `elements[0]` is bottom, last is top. The reorder
  actions swap/move within the array.
- **Object-URL lifecycle** — `removeElement`/`clearAll` revoke a photo's `blob:`
  URL, but only if no other element still references the same `src` (duplicates
  share it).
- **`window.__editor`** is exposed in dev (`import.meta.env.DEV`) for
  console/CDP-driven testing (used by the headless verification scripts).

## Rendering & canvas (`src/components/EditorCanvas.tsx`)

- Structure: `Stage` (viewport-sized) → one `Layer` → a **board `Group`** (holds
  `Background` + elements) **+ a sibling `Transformer`**. The transformer is a
  sibling (not a child) of the board group, so it is excluded from exports and
  its handles stay a constant on-screen size regardless of board zoom.
- **View transform `tf = {x, y, scale}`** positions/scales the board group.
  `fitToScreen()` centres and fits the board on resize; **wheel** and two-finger
  **pinch** gestures zoom-to-point by updating `tf` (canonical Konva math).
- **Free mode:** all elements render as draggable/transformable `ElementNode`s.
  **Grid mode:** `GridView` lays photos into clipped cover-fit cells; **non-photo
  elements (text/stickers) still render as free overlays on top** of the grid.
- **Transformer attach rule:** attach to the selected element when it is a free
  node — any element in free mode, only non-photo elements in grid mode (grid
  photos keep a tap-highlight, no handles). Found via `stage.findOne('#'+id)`.
- Tap on empty stage / the `background` rect clears the selection.
- Text edit: double-tap a text node → `window.prompt` (also editable in the Text
  panel).

## Coordinate & export model

Element coordinates are stored in **board design units** (`boardWidth ×
boardHeight`), independent of on-screen size. The board group is scaled/panned for
display only. **`exportBoard()`** (`src/lib/exportImage.ts`) temporarily resets
the board group to identity (scale 1, pos 0) and snapshots exactly the
`boardWidth × boardHeight` region at `pixelRatio: 2` → output resolution is
independent of the current view zoom. `App.tsx` clears the selection and waits a
frame before exporting so no transformer/highlight is captured; PNG/JPG download
or Web Share follow.

## Filters (`src/lib/filters.ts`)

`computeFilterConfig(filters)` maps the high-level `PhotoFilters` (brightness /
contrast / saturation + a preset) to a concrete Konva filter stack
(`Brighten` + `Contrast` + `HSL`, plus `Grayscale`/`Sepia` for presets) and the
numeric attrs each filter reads. In `PhotoNode`/`CellPhoto` the effect calls
`node.cache()` then applies the stack; **re-run whenever the image or filter
values change** (that's the dependency list).

## Grids (`src/lib/grids.ts`, `src/components/GridView.tsx`)

`GRID_LAYOUTS` are normalised (0..1) cell rectangles (2-vertical, 2-horizontal,
3-columns, 3 (1 big + 2), 2×2). `GridView` scales them to the board with a small
gutter, assigns `photos[i]` to cell `i` (extra photos hidden, empty cells show a
dashed "＋" placeholder), and draws each photo **object-fit: cover** inside a
clipped `Group`. Selecting a cell selects that photo (for filters/delete).

## i18n (`src/i18n/`)

Lightweight, dependency-free. `translations.ts` holds flat key→string maps for
**six languages** (`en`, `de`, `es`, `fr`, `it`, `pt`) plus `LANGS` (flag +
label). `useLang.ts` is a zustand store that **defaults to the browser language**
(`navigator.languages`, matched by prefix; English otherwise), **persists** the
choice in `localStorage`, and sets `<html lang>`. `useT()` returns a `t(key)`
translator (English is the fallback; unknown key → the key). `t()` takes a key
only — **no interpolation**, so compose counts as `` `${n} ${t('key')}` ``.
`LangSwitcher` (in the header) toggles language live. **To add a UI string:** add
the key to **all six** language maps, then `const t = useT()` and `t('your.key')`.
Font names, the bold "B", emoji, grid glyphs, and caption suggestions stay
untranslated.

## PWA & deployment

- Manifest + service worker via vite-plugin-pwa (`vite.config.ts`). Icons are
  generated by `scripts/generate-icons.mjs` (pure zlib PNG encoder) into
  `public/`; `favicon.svg` is the source motif.
- **`base` in `vite.config.ts` must equal the GitHub Pages subpath** (the repo
  name), currently `'/Pic-Collage-Maker/'`. It also feeds the manifest `start_url` /
  `scope`. **If the repo is renamed, update `BASE`** (and README/live-URL refs).
- CI: every push to `main` runs `deploy.yml` → `npm install` (see gotchas) →
  `npm run build` → upload `dist/` → deploy to Pages. Node 24.
- One-time (admin): repo **public** + Settings → Pages → Source = **GitHub
  Actions**.
- Live: `https://sashimee.github.io/Pic-Collage-Maker/`.

## Known gotchas / constraints

- **Permissions:** the local git user is **G1NG4R** and is only a **`write`**
  collaborator; the repo **owner is Sashimee** ("Alex"). Admin actions — renaming
  the repo, changing visibility, enabling Pages — return `404` and **must be done
  by Sashimee**. Pushing to `main` works.
- **The local folder is still `/home/alex/projects/Pic-collage`** while the repo
  and the Pages subpath are `Pic-Collage-Maker` (renamed 2026-09-11). The folder
  name is cosmetic and feeds nothing; `BASE` is what matters. GitHub redirects
  the old repo URL, so a stale `git remote` keeps working and hides the drift —
  check `git remote -v` if something looks like it is pushing to the wrong place.
- **CI uses `npm install`, not `npm ci`** — npm's cross-version handling of
  optional platform deps (`@emnapi/*`) made a valid lockfile read as out-of-sync
  under `npm ci`. Don't switch it back without regenerating the lockfile to match.
- Emoji flags render as flags on iOS/Android; some desktop/Windows fonts show
  letters — cosmetic only.
- React **StrictMode** is on (dev double-invoke) — keep effects idempotent.
- **Nothing on the critical path may be a third-party request.** Poppins is
  self-hosted (`src/assets/fonts/`, latin subset, ~8 KiB per weight). It used to
  come from a Google Fonts `<link>` in `index.html`, which put a third origin —
  DNS, TLS, its CSS, then the font files — ahead of first paint, and quietly made
  the "no outbound traffic" claim above untrue.
- **`index.html` paints an app shell before React runs.** Without it, first and
  largest contentful paint were both gated on parsing and evaluating the bundle.
  Keep its styles inline: moving them to a stylesheet puts the shell back behind
  the network. Keep its colours in step with `--bg`/`--muted` in `index.css`.
- **Never let a `blob:` URL reach persistence.** Photo elements hold their pixels
  as object URLs, which are handles into the *current document* and die on
  reload; the bytes live in IndexedDB under `photoId`. Anything that saves a
  document must `stripPhotoUrls()` first and `rehydratePhotos()` on the way back
  (`src/lib/photoRehydrate.ts`). Saved projects and version history both shipped
  without this and silently lost their photos across a restart. It looks fine
  until you reload — so **test persistence with an actual page reload**.
- **A store flag read through a React selector can't be set and used in the same
  tick.** `exporting` (swaps photos to full resolution for export) was set,
  used, and cleared in three consecutive statements; React never re-rendered, so
  it never took effect and every export used the 1080px preview. If a render has
  to observe a flag, `await` a frame — see `EditorCanvas.exportImage`.
- **Lighthouse needs its own build.** `npm run build:lh` emits `dist-lh/` with
  `base=/` because LHCI's static server serves the directory at the root, while
  the normal build sets `base=/Pic-Collage-Maker/` for Pages. Building the usual way
  makes the bundle 404 and Lighthouse fails with `NO_FCP` without ever scoring
  anything.
- **`prefers-reduced-motion` does not reach framer-motion by itself.** The CSS
  rule in `index.css` only zeroes CSS `animation`/`transition` durations;
  framer-motion writes inline transforms from a rAF loop. `MotionProvider` sets
  `MotionConfig reducedMotion="user"` — keep it, and give any new animation a
  still final frame via `useReducedMotion()`.
- **Import `m` from `./motion`, never `motion` from `framer-motion`.** The app
  wraps everything in `LazyMotion … strict`; mixing the two defeats the
  tree-shaking that wrapper exists for. Converting five stragglers took the
  eager `ui` chunk from 150.9 kB to 104.7 kB.
- **First-use hints go in `src/lib/firstUse.ts`, not a new localStorage key.**
  One record, claimed on read (StrictMode invokes effects twice, so a check that
  writes later shows the hint twice), and `e2e/helpers.ts`'s `openApp`
  suppresses the lot in one line — `openApp(page, { tips: true })` arms them.
- **The background is not a `CanvasElement`.** `stripPhotoUrls`/`rehydratePhotos`
  walk elements only, which is why a photo background silently died on reload
  until `stripBackgroundUrl`/`rehydrateBackground` were added. Anything new that
  holds pixels needs both halves wired at every save and load site.
- **An `<img>` inside a pointer-drag needs `draggable={false}`.** Pressing on an
  image starts the browser's own image drag, which fires `pointercancel` and
  kills the pointer stream after roughly one move — so a drag gesture built on
  pointer events silently does nothing, with no error anywhere. This is what
  made the page strip's reorder a no-op; `PageThumb` sets it, and any future
  draggable thing containing an image must too.
- **Only one Konva stage renders the live board.** Anything that has to draw a
  document the editor is *not* showing (the photo book) mounts its own stage
  off-screen and renders `BoardScene`, which takes a document as a prop. Do not
  add a second renderer, and do not drive `setActivePage` in a loop to export
  pages — that persists, clears undo and flickers through the user's work.
- **Wait for bitmaps to be on the nodes, not for a fixed number of frames.**
  `useImage` decodes asynchronously and `GridView`'s cells render no node at all
  until their image is ready, so a snapshot taken too early is a valid file full
  of blank pages. `renderPages.waitForImages` polls the nodes.
- **Pages live in `projectsStore`, not `editorStore`.** The editor holds exactly
  one live document — the page you are looking at — which is the assumption
  baked into `Snapshot`, `record()` and `loadDocument`. The store's
  `pages[activePage]` therefore *lags* the editor until the next save, so every
  page action folds the live document back in (`commitPages`) before touching
  the list. Skip that and adding a page discards whatever you just drew. For the
  same reason the page strip draws its active tile from the live editor state,
  not from `pages`.
- **Dev-only test seams**, exposed under `import.meta.env.DEV`: `window.__editor`
  (editorStore), `__projects`, `__versions`, and `__boardRect()` (the board's
  on-screen rect, from `EditorCanvas`). The e2e suite drives flows through these
  — particularly ones that must survive a page reload, where module imports and
  React refs are gone.

## Git workflow

- **`main` = production.** Every push to `main` auto-deploys to GitHub Pages, so
  `main` must stay deployable at all times.
- **`dev` = integration branch.**
- **Every new feature or fix starts on its own branch, created from `dev`**
  (e.g. `feat/undo-redo`, `fix/grid-gap`). Do the work there, commit locally with
  Conventional Commits (`feat:`, `fix:`, `chore:`, `ci:`, `docs:` …).
- **The user (Alex) may give explicit go-ahead for autonomous push/merge.**
  When the user says "go ma drilla", "/yolo", "Yes proceed and Push directly",
  or similar, Claude is authorized to push and merge without further confirmation.
- **Release / deploy = merge `dev` → `main` and push — on user request or
  autonomous approval.**

Typical cycle:

```bash
git switch dev
git switch -c feat/my-thing      # branch off dev
# …commit work locally…
# → merge to dev or main when user gives go-ahead
```

## Roadmap

Done: multi-photo import (gallery + camera), free canvas with move/resize/rotate,
preset grids + **custom draw-your-own layouts**, per-cell pan & zoom, text (rich
spans, curve, chip, custom-font upload), emoji stickers, shapes + freehand draw,
solid/gradient/pattern/photo backgrounds, filter stack (brightness/contrast/
saturation/hue/**temperature**/**tint**/exposure/shadows/highlights/blur/vignette
+ presets), artistic **style transfer** (oil/sketch/pop-art), on-device "AI"
tools (auto-enhance, background removal, portrait retouch, smart crop, caption
suggestions), layers panel + reorder/duplicate/delete/group, undo/redo, snapping
guides, watermark + print marks, PNG/JPG/SVG/PDF/ZIP export + Web Share,
autosave/restore + projects + version history (IndexedDB), mobile pinch/wheel
zoom + aspect presets, installable PWA + Pages CI/CD, **6-language UI**,
**multiple montages per project** (page model + migration, page actions, and the
page strip under the canvas).

**photo book** (pages rendered off-screen at 300 DPI, fitted onto a chosen
sheet, with an optional cover and page numbers).

**first-use gesture tips** (animated inline-SVG demos of the four gestures
nothing on screen can hint at, on one first-use registry).

Next up: nothing is committed. Candidates below.

Other ideas: richer touch gestures (two-finger rotate) · more grid layouts +
adjustable gutter/corner radius · crop tool polish · a real animation/export-video
pipeline (the half-baked one was removed) · **Capacitor** wrapper for App Store /
Play Store (structure is ready; not installed).

> **Gotcha (grid rendering):** Konva nodes rendered from data that loads async
> (e.g. `useImage` in `GridView`/`CanvasNodes`) must keep **all hooks above any
> early `return null`** — a hook after `if (!image) return null` changes the hook
> count when the image resolves and crashes the whole stage. This once made every
> grid layout blank the board.

## Conventions

- Conventional Commits.
- Everything stays **client-side** — photos and projects never leave the device.
  The only outbound traffic is the `version.json` poll and the anonymous,
  cookieless analytics beacon; keep it that way.
- Board coordinates are **design units**, not screen pixels (see above).
- Match the surrounding code's style; keep new code dependency-light.
