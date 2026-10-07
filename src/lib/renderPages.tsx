import { createRoot, type Root } from 'react-dom/client'
import { Layer, Stage } from 'react-konva'
import type Konva from 'konva'
import { BoardScene } from '../components/BoardScene'
import { useEditor, type LoadedDocument } from '../store/editorStore'
import { rehydrateBackground, rehydratePhotos } from './photoRehydrate'
import { assignSlots, resolveLayoutById } from './grids'
import { containRect } from './photoBook'
import { applyPostProcess } from './exportImage'
import { filtersSettled } from './filters'
import type { PhotoElement, PrintSettings, WatermarkSettings } from '../types'

/**
 * Render pages that are not the one being edited.
 *
 * The app has exactly one Konva stage — the live board — and `exportBoard`
 * snapshots it. A photo book needs every page, so this mounts a second stage
 * off-screen and draws each page through `BoardScene`, the same component the
 * editor uses. Nothing here touches the live document: no page switching, no
 * writes to IndexedDB, no undo history cleared.
 *
 * Pages are rendered one at a time on purpose. `rehydratePhotos` mints three
 * object URLs per photo and an A4 page at 300 DPI is a ~35 MB canvas, so
 * holding a whole book at once is how this becomes a crash on a phone.
 */

/** Two rAFs: one for React to commit, one for Konva to redraw. */
const nextFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )

/** How many bitmaps this page will draw once everything has decoded. */
function expectedImageCount(doc: LoadedDocument): number {
  const photos = doc.elements.filter(
    (e): e is PhotoElement => e.type === 'photo' && !e.hidden,
  )
  const layout = doc.gridId ? resolveLayoutById(doc.gridId) : undefined
  const inGrid = doc.mode === 'grid' && !!layout
  const content = inGrid
    ? assignSlots(layout.cells.length, photos).filter(Boolean).length
    : photos.length
  const background =
    doc.background.type === 'photo' && doc.background.photoSrc ? 1 : 0
  return content + background
}

/**
 * Wait until the bitmaps are actually on the nodes.
 *
 * `useImage` decodes asynchronously and hands the image over a render later, so
 * a snapshot taken too early is silently blank or half-drawn — the same failure
 * that made watermarked exports come out empty. Polling the nodes is stronger
 * than preloading the URLs: it checks what will really be drawn, including grid
 * cells, which do not render a node at all until their image is ready.
 */
async function waitForImages(stage: Konva.Stage, expected: number, timeoutMs = 15_000) {
  if (expected === 0) return
  const started = Date.now()
  for (;;) {
    const ready = stage.find('Image').filter((n) => !!(n as Konva.Image).image()).length
    if (ready >= expected) return
    if (Date.now() - started > timeoutMs) return // a missing blob must not hang the export
    await nextFrame()
  }
}

/** Every `blob:` URL currently on a page's photos. */
function pageUrls(elements: LoadedDocument['elements']): Set<string> {
  const urls = new Set<string>()
  for (const el of elements) {
    if (el.type !== 'photo') continue
    for (const url of [el.src, el.previewSrc, el.originalSrc, el.thumbSrc]) {
      if (url?.startsWith('blob:')) urls.add(url)
    }
  }
  return urls
}

/**
 * Release the object URLs this render minted — and *only* those.
 *
 * `rehydratePhotos` passes an already-live photo straight through rather than
 * re-minting it, so a document that is already hydrated comes back carrying the
 * caller's own URLs. Revoking those blanks whoever owns them: feed this the
 * live editor document (which the book does when there is no project to read
 * pages from) and the board on screen loses its photos.
 */
function revokeMinted(elements: LoadedDocument['elements'], keep: Set<string>) {
  for (const url of pageUrls(elements)) {
    if (!keep.has(url)) URL.revokeObjectURL(url)
  }
}

export interface RenderPagesOptions {
  /**
   * Fixed output size in pixels — the sheet, for a book. Every page is fitted
   * into it, so a page whose board has a different aspect gets margins.
   */
  width?: number
  height?: number
  /**
   * Render each page at its **own** board size times this ratio instead of a
   * fixed sheet. Pages need not share a board size, and for sharing or
   * downloading nobody wants a portrait page letterboxed onto a landscape one.
   * 2 matches what the single-page export already produces.
   */
  pixelRatio?: number
  format?: 'jpeg' | 'png'
  quality?: number
  /**
   * Watermark and print marks to paint over each page. Omit and they are left
   * off — but a share or a book that drops the user's watermark is a silent
   * difference, so callers exporting on the user's behalf should pass them.
   */
  watermark?: WatermarkSettings
  print?: PrintSettings
  onProgress?: (done: number, total: number) => void
  /** Set `cancelled` to stop after the page in flight. */
  signal?: { cancelled: boolean }
}

export async function renderPages(
  pages: LoadedDocument[],
  options: RenderPagesOptions,
): Promise<string[]> {
  const {
    pixelRatio,
    format = 'jpeg',
    quality = 0.92,
    watermark,
    print,
    onProgress,
    signal,
  } = options
  if (!pages.length) return []

  const host = document.createElement('div')
  // Off-screen rather than display:none — Konva draws to its own canvas either
  // way, but a laid-out container keeps measurement behaviour predictable.
  host.style.cssText =
    'position:fixed;left:-100000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none'
  document.body.appendChild(host)

  const stageRef: { current: Konva.Stage | null } = { current: null }
  let root: Root | null = null
  const out: string[] = []

  // Full-resolution photo sources, set once for the whole run rather than per
  // page — it is read through a React selector, so each flip costs a render.
  const wasExporting = useEditor.getState().exporting
  useEditor.getState().setExporting(true)

  try {
    root = createRoot(host)
    for (let i = 0; i < pages.length; i++) {
      if (signal?.cancelled) break
      const page = pages[i]
      // What the caller already owned, so it survives the revoke below.
      const owned = pageUrls(page.elements)
      const elements = await rehydratePhotos(page.elements)
      // A photo background is stored the same way and needs the same rebuild,
      // or an exported page comes out on a flat colour.
      const background = await rehydrateBackground(page.background)
      const doc: LoadedDocument = { ...page, elements, background }

      // Either a fixed sheet with the board fitted into it (a book), or the
      // board at its own size times a ratio (a share or a download).
      const ratio = pixelRatio ?? 1
      const width = options.width ?? Math.round(doc.boardWidth * ratio)
      const height = options.height ?? Math.round(doc.boardHeight * ratio)
      // Fit the board onto the sheet the same way the PDF will, so what is
      // rendered is what gets printed rather than something stretched. With a
      // board-sized output this resolves to the whole canvas at `ratio`.
      const box = containRect(doc.boardWidth, doc.boardHeight, width, height)
      const scale = box.width / doc.boardWidth

      root.render(
        <Stage ref={stageRef} width={width} height={height}>
          <Layer>
            <BoardScene doc={doc} />
          </Layer>
        </Stage>,
      )

      await nextFrame()
      const stage = stageRef.current
      if (!stage) break
      // The board group is positioned by the stage rather than by BoardScene,
      // which draws in board units from the origin.
      stage.scale({ x: scale, y: scale })
      stage.position({ x: box.x, y: box.y })

      await waitForImages(stage, expectedImageCount(doc))
      // A text node starts loading its pack font on mount and re-measures once
      // it arrives; until then it draws in the fallback face.
      await document.fonts.ready
      await nextFrame()
      await filtersSettled()
      await nextFrame()

      // Overlays go through the same post-process the live export uses, on a
      // canvas rather than a data URL — an undecoded Image draws nothing, which
      // is how watermarked exports once came out blank.
      const overlaid = watermark?.enabled || print?.enabled
      out.push(
        overlaid
          ? applyPostProcess(
              stage.toCanvas({ pixelRatio: 1 }),
              watermark,
              print,
              format === 'png' ? 'png' : 'jpg',
              quality,
            )
          : stage.toDataURL({
              mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
              quality,
              pixelRatio: 1,
            }),
      )

      // Release this page before touching the next one.
      revokeMinted(elements, owned)
      onProgress?.(i + 1, pages.length)
    }
  } finally {
    useEditor.getState().setExporting(wasExporting)
    root?.unmount()
    host.remove()
  }

  return out
}
