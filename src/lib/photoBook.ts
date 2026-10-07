/**
 * Physical page sizes for the photo book.
 *
 * Nothing else in the app records a physical dimension: `exportPresets.ts` is
 * bare pixel counts that happen to be 300 DPI sizes, and its only consumer
 * treats them as *board* pixels. A book is the first thing here that has to
 * come out of a printer at a known size, so sizes are kept in millimetres and
 * converted at the edges.
 */

/** Print resolution the book renders at. */
export const BOOK_DPI = 300

const MM_PER_INCH = 25.4

/** Millimetres → PDF points (1pt = 1/72 inch). */
export const mmToPt = (mm: number) => (mm / MM_PER_INCH) * 72

/** Millimetres → pixels at the book's print resolution. */
export const mmToPx = (mm: number, dpi = BOOK_DPI) => Math.round((mm / MM_PER_INCH) * dpi)

export interface BookPageSize {
  id: string
  labelKey: string
  widthMm: number
  heightMm: number
}

export const BOOK_PAGE_SIZES: BookPageSize[] = [
  { id: 'square-21', labelKey: 'book.sizeSquare', widthMm: 210, heightMm: 210 },
  { id: 'a4-portrait', labelKey: 'book.sizeA4Portrait', widthMm: 210, heightMm: 297 },
  { id: 'a4-landscape', labelKey: 'book.sizeA4Landscape', widthMm: 297, heightMm: 210 },
]

export const DEFAULT_BOOK_SIZE = BOOK_PAGE_SIZES[0]

export function bookSizeById(id: string): BookPageSize {
  return BOOK_PAGE_SIZES.find((s) => s.id === id) ?? DEFAULT_BOOK_SIZE
}

/** The sheet in PDF points. */
export const pageSizePt = (size: BookPageSize) => ({
  widthPt: mmToPt(size.widthMm),
  heightPt: mmToPt(size.heightMm),
})

/** The bitmap to render for that sheet, at print resolution. */
export const pageSizePx = (size: BookPageSize, dpi = BOOK_DPI) => ({
  width: mmToPx(size.widthMm, dpi),
  height: mmToPx(size.heightMm, dpi),
})

export interface FittedRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Fit a montage onto the sheet, centred, without cropping it.
 *
 * Pages in a project are *not* guaranteed to share a board size — `setBoardSize`
 * only touches the page you are on — so a book has to cope with a portrait
 * montage on a landscape sheet. Containing it leaves margins; filling it would
 * silently cut someone's photo off the edge of a printed page, which is not a
 * trade to make on their behalf.
 */
export function containRect(
  contentW: number,
  contentH: number,
  pageW: number,
  pageH: number,
): FittedRect {
  if (contentW <= 0 || contentH <= 0) return { x: 0, y: 0, width: pageW, height: pageH }
  const scale = Math.min(pageW / contentW, pageH / contentH)
  const width = contentW * scale
  const height = contentH * scale
  return { x: (pageW - width) / 2, y: (pageH - height) / 2, width, height }
}

export interface BookOptions {
  /** Page size id from BOOK_PAGE_SIZES. */
  sizeId: string
  /** Treat the first page as a cover: no page number on it. */
  cover: boolean
  pageNumbers: boolean
}

export const DEFAULT_BOOK_OPTIONS: BookOptions = {
  sizeId: DEFAULT_BOOK_SIZE.id,
  cover: true,
  pageNumbers: true,
}

/**
 * The number printed on a page, or null for none.
 *
 * With a cover, numbering starts at 1 on the page *after* it — a book's cover
 * is not page 1.
 */
export function pageNumberFor(index: number, options: BookOptions): number | null {
  if (!options.pageNumbers) return null
  if (options.cover) return index === 0 ? null : index
  return index + 1
}

type BookHooks = {
  onProgress?: (done: number, total: number) => void
  signal?: { cancelled: boolean }
  /** The user's watermark / print marks, so a printed book carries them. */
  watermark?: import('../types').WatermarkSettings
  print?: import('../types').PrintSettings
}

export interface BookPage {
  dataUrl: string
  pageNumber: number | null
}

/**
 * Render every page at print resolution for the chosen sheet, with its page number.
 *
 * The off-screen renderer is imported lazily: it pulls in react-konva, which
 * does not belong in the bundle someone downloads to look at the layout gallery.
 */
export async function renderBook(
  pages: import('../store/editorStore').LoadedDocument[],
  options: BookOptions,
  hooks: BookHooks = {},
): Promise<BookPage[] | null> {
  if (!pages.length) return null
  const { renderPages } = await import('./renderPages')
  const bitmaps = await renderPages(pages, {
    ...pageSizePx(bookSizeById(options.sizeId)),
    format: 'jpeg',
    watermark: hooks.watermark,
    print: hooks.print,
    onProgress: hooks.onProgress,
    signal: hooks.signal,
  })
  if (!bitmaps.length || hooks.signal?.cancelled) return null
  return bitmaps.map((dataUrl, i) => ({ dataUrl, pageNumber: pageNumberFor(i, options) }))
}

/** Render every page and bind them into a PDF at the chosen physical size. pdf-lib (~420 KB) loads lazily. */
export async function buildPhotoBook(
  pages: import('../store/editorStore').LoadedDocument[],
  options: BookOptions,
  hooks: BookHooks = {},
): Promise<Uint8Array | null> {
  const [book, { exportPDF }] = await Promise.all([
    renderBook(pages, options, hooks),
    import('./exportPDF'),
  ])
  if (!book) return null
  return exportPDF(book, { page: pageSizePt(bookSizeById(options.sizeId)), title: 'Photo Book' })
}
