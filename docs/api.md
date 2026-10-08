# Developer Reference

Internal modules of Pic Collage Maker. There is no public or plugin API; this
describes how the app's own pieces fit together. Paths are relative to `src/`.

## Data model (`types.ts`)

Everything on the board is a `CanvasElement`, a union keyed by `type`:

| `type`    | Interface        | Main fields                                                                                                                                                                                                                    |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `photo`   | `PhotoElement`   | `src`, `photoId?`, `previewSrc?`, `originalSrc?`, `thumbSrc?`, `width`, `height`, `filters` (v1), `filterStack?` (v2), `shape?`, `crop?`, `straighten?`, `flipX?`, `flipY?`, `styling?`, `cellIndex?`, `cellZoom?`, `cellPan?` |
| `text`    | `TextElement`    | `text`, `fontFamily`, `fontSize`, `fill`, `fontStyle`, plus optional stroke, shadow, `chip`, `curve`, `spans`, `effects` and paragraph settings                                                                                |
| `sticker` | `StickerElement` | `emoji`, `fontSize`                                                                                                                                                                                                            |
| `drawing` | `DrawingElement` | `points`, `stroke`, `strokeWidth`                                                                                                                                                                                              |
| `shape`   | `ShapeElement`   | `shapeType`, `fill`, `stroke?`, `path?`, `libraryId?`                                                                                                                                                                          |
| `path`    | `PathElement`    | `d`, `stroke`, `strokeWidth`, `fill?`, `closePath?`                                                                                                                                                                            |
| `group`   | `GroupElement`   | `children`                                                                                                                                                                                                                     |

`path` and `group` are declared but nothing in the app creates them. Grouping is
flat: `groupElements` stamps a shared `groupId` on the members.

Every element extends `BaseElement`: `id`, `type`, `x`, `y`, `rotation`,
`scaleX`, `scaleY`, and optional `hidden`, `locked`, `opacity`, `blendMode`
(`normal | multiply | screen | overlay | darken | lighten`), `name`, `groupId`.

- **Coordinates are board design units** (`boardWidth × boardHeight`, default
  1080 × 1350), not screen pixels.
- **z-order is array order**: `elements[0]` is the bottom.

Other types:

- `Background`: `type` is `solid | gradient | pattern | photo`, with `color`,
  `gradientFrom`, `gradientTo`, `gradientAngle`, `patternId`
  (`dots | stripes | grid | checker | hearts`), `patternColor`, and `photoSrc?`
  / `photoId?` for a photo background.
- `Frame`: `style` (`none | solid | rounded | polaroid`), `color`, `width`
  (fraction of the board).
- `EditorMode`: `free | grid | custom-layout`.
- `FilterOperation`: one step of a photo's `filterStack` (brightness, contrast,
  saturation, hue shift, exposure, shadows, highlights, temperature, tint,
  preset, blur, vignette, levels, curves, HSL bands, `.cube` LUT).
- `WatermarkSettings`, `PrintSettings`: per-document, defaults in `types.ts`.

## Stores

All state lives in zustand stores.

### `useEditor` (`store/editorStore.ts`)

The live document — the page currently shown — plus selection, tools and undo.

Document fields: `boardWidth`, `boardHeight`, `background`, `mode`, `gridId`,
`gridGap`, `gridRadius`, `gridMargin`, `frame`, `elements`, `watermark`,
`print`. Editor fields include `selectedId`, `multiSelected`, `croppingId`,
`tool` (`select | draw`), `brushColor`, `brushSize`, `past` / `future`,
`canvasZoom`, `exporting`, and the custom-layout state (`customLayoutZones`,
`customLayoutMode`).

| Group         | Actions                                                                                                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elements      | `addPhoto(src, w, h, photoId?, opts?)`, `addText()`, `addSticker(emoji)`, `addDrawing(points, stroke, width)`, `addShape(shapeType, fill?, custom?)`, `updateElement(id, patch)`, `updateElements(patches, label?)`, `updateFilters`, `updateFilterStack`, `duplicateElement`, `removeElement`, `removeElements` |
| Selection     | `select(id \| null)`, `toggleMultiSelect`, `selectMany`, `clearMultiSelect`, `selected()`                                                                                                                                                                                                                        |
| Order, layers | `bringForward`, `sendBackward`, `bringToFront`, `sendToBack`, `setElements`, `setElementHidden`, `setElementLocked`, `groupElements(ids)`, `ungroupElements(groupId)`                                                                                                                                            |
| Board         | `setBackground`, `setFrame`, `setBoardSize`, `setMode`, `applyLayout(layoutId, opts?)`, `applyTemplate`, `setGrid`, `setGridGap`, `setGridMargin`, `setGridRadius`, `applyShapeToAll`, `setWatermark`, `setPrint`, `clearAll`                                                                                    |
| Custom layout | `splitCustomLayout(pts, snapStep?)`, `circleCustomLayout(pts, overlay)`, `mergeCustomLayoutCell(index)`, `undoCustomLayout`, `setCustomLayoutMode(v, cells?)`                                                                                                                                                    |
| History       | `undo`, `redo`, `travel(steps)`, `copyStyle(id)`, `pasteStyle(ids)`                                                                                                                                                                                                                                              |
| Load          | `loadDocument(doc: LoadedDocument)` — replaces the document and clears undo                                                                                                                                                                                                                                      |

Undo keeps the last 60 labelled entries (`HISTORY_LIMIT`).

`removeElement` / `clearAll` revoke a photo's `blob:` URL only when no other
element still uses it (duplicates share it).

`LoadedDocument` is the serialisable shape of one page: the document fields
listed above.

### `useProjects` (`store/projectsStore.ts`)

Named projects and their pages.

- State: `projects: ProjectMeta[]` (`id`, `name`, `createdAt`, `updatedAt`),
  `activeProjectId`, `isLoading`, `pages: LoadedDocument[]`, `activePage`.
- Projects: `loadProjectList`, `createProject(name) → id`, `openProject(id)`,
  `renameProject`, `duplicateProject(id) → id`, `deleteProject(id) → Project |
null` (for undo), `restoreProject(project, documentId?)`, `saveActiveProject`,
  `closeProject`.
- Pages: `addPage`, `duplicatePage(index?)`, `deletePage(index) →
LoadedDocument | null` (for undo), `restorePage(index, page)`,
  `reorderPages(from, to)`, `setActivePage(index)`.
- `defaultProjectName()` returns `Collage <date>`.

`pages[activePage]` is the stored copy and lags the editor until the next save.
Every page action first folds the live editor document back into `pages`.

While a project is open, editor changes are autosaved after
`useSettings.autosaveDelay`. A pending save is flushed when the tab is hidden.
Each save also records a version snapshot. No save runs once `hasCrashed()` is
true (`lib/crashState.ts`).

Projects are stored in IndexedDB `pic-collage-db`, store `projects`
(`services/localProjects.ts`), as `{ id, name, createdAt, updatedAt, data }`,
where `data` is a `ProjectDocument`.

### `useVersionStore` (`store/versionStore.ts`)

- `getSnapshots(projectId) → SnapshotMeta[]` (`id`, `timestamp`,
  `elementCount`)
- `saveSnapshot(projectId, elements, background)`
- `restoreSnapshot(id) → { elements, background } | null`
- `deleteSnapshot(id)`

Up to `MAX_SNAPSHOTS = 20` per project, deduplicated. A snapshot holds only the
elements and background of the active page, with photo URLs stripped. Stored in
IndexedDB `piccollage-snapshots`, store `snapshots`.

### `useSettings` (`store/settingsStore.ts`)

Persisted to localStorage under `pic-collage-settings`. Fields: `units`
(`px | mm | in`), `exportFormat` (`png | jpg`), `autosaveDelay` (one of
`AUTOSAVE_DELAYS = [1500, 5000, 15000, 30000]` ms), `analyticsOptOut`,
`keepLocation`. Invalid saved values fall back to defaults.
`formatLength(px, units)` converts at 300 DPI.

### Other stores

- `useWorkspace` (`store/workspaceStore.ts`): panel layout and saved workspace
  presets.
- `useGuides` (`store/guidesStore.ts`): `rulers`, `centerLines`, `printArea`,
  `spacing`; persisted under `pic-collage-guides`.
- `useToast` (`store/toastStore.ts`): toasts; `addUndoToast(message, label,
onUndo)` adds one with an undo button.
- `useLang` (`i18n/useLang.ts`): see [i18n](#i18n).

## Project schema (`lib/projectSchema.ts`)

```ts
const PROJECT_SCHEMA = 2

interface ProjectDocument {
  schema: 2
  pages: LoadedDocument[]
  activePage: number
}
```

- `toProjectDocument(data)` reads a stored record. A schema-1 record (a bare
  `LoadedDocument`) becomes a one-page project. Pages without a numeric board
  size and an `elements` array are dropped, and `activePage` is clamped. It
  returns `null` when nothing usable is left. Old records are rewritten in the
  new shape on their next save.
- `singlePage(doc)`, `activeDocument(project)`, and
  `withActivePage(project, page)` are small helpers.

## Photo persistence

Photo pixels are never stored inside a document. On import (`lib/importPhotos.ts`)
each photo gets a `photoId` and three blobs in IndexedDB `piccollage`, store
`photos` (`lib/persistence.ts`):

| Key               | Content                            |
| ----------------- | ---------------------------------- |
| `<photoId>:orig`  | the original file                  |
| `<photoId>:prev`  | preview, max 1080 px, quality 0.92 |
| `<photoId>:thumb` | thumbnail, 256 px, quality 0.85    |
| `<photoId>:bg`    | a background photo                 |

At runtime, elements hold `blob:` object URLs for these (`src` / `previewSrc`,
`originalSrc`, `thumbSrc`). Those URLs only live as long as the page.

Rules:

- **Before saving any document**, call `stripPhotoUrls(elements)` and
  `stripBackgroundUrl(background)` (`lib/photoRehydrate.ts`).
- **After loading one**, call `rehydratePhotos(elements)` and
  `rehydrateBackground(background)`. A photo whose preview blob is missing is
  dropped.
- Wire both halves at every save and load site, and test with a real page
  reload.
- The canvas draws the preview. While `useEditor.exporting` is true, nodes
  switch to `originalSrc` for full-resolution export.

The unsaved board is saved separately in the same database (store `doc`, key
`current`) through `saveDoc` / `loadDoc`, and restored on startup.
`prunePhotos(keepIds)` deletes blobs nothing references.

## `.piccollage` file format (`lib/projectFile.ts`)

A JSON file:

```ts
interface PicCollageFile {
  version: 1
  project: { name: string; createdAt: number; updatedAt: number }
  doc: LoadedDocument // photo URLs stripped
  photos: Record<string, string> // store key → data:image/… base64 URL
}
```

- `packProject(name, doc) → Blob` embeds the `orig`, `prev` and `thumb` blobs
  of every photo the document references, plus its background photo.
- `unpackProject(blob) → { name, doc }` throws on invalid input. It checks that
  `version` is 1, that `project.name`, `photos`, `doc.elements` and
  `doc.background` exist, and that every photo is a `data:image/` URL. It only
  imports photos whose keys the document references. Those blobs are written to
  the photo store, and then the document is rehydrated.
- The format holds one `LoadedDocument`, not a `ProjectDocument`. The header
  export currently packs only the active page.

The installed PWA registers itself as a handler for `.piccollage` and image
files (`file_handlers` in `vite.config.ts`).

## i18n

English lives in `i18n/translations.ts`. The other languages (`de`, `es`, `fr`,
`it`, `pt`) are in `i18n/locales/*.ts` and are loaded on demand.

- `useLang`: the current `lang`. The starting language comes from localStorage
  `lang`, then a prefix match on `navigator.languages`, then English.
  `setLang(lang)` loads the locale first, saves the choice and sets
  `<html lang>`.
- `langReady`: a promise for the detected language's map. `main.tsx` awaits it
  before the first render.
- `useT() → t(key, vars?)`:
  - Placeholders use single braces, `{name}`. Numbers are formatted for the
    locale.
  - A numeric `vars.count` selects `key.<plural category>` via
    `Intl.PluralRules`, falling back to `key.other`.
  - Missing keys fall back to English, then to the key itself.
- `translate(lang, dict, key, vars?)` is the same logic outside React.

To add a string, add the key to all six maps.

## Dev-only test seams

These are exposed on `window` only when `import.meta.env.DEV` is set. The e2e
suite uses them, especially for flows that survive a reload.

| Global          | Value                                                    |
| --------------- | -------------------------------------------------------- |
| `__editor`      | `useEditor`                                              |
| `__projects`    | `useProjects`                                            |
| `__versions`    | `useVersionStore`                                        |
| `__boardRect()` | the board's on-screen rect (`canvas/useExportHandle.ts`) |
