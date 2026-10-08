import { useRef, useState, type ReactNode } from 'react'
import { BookOpen, Printer, X } from 'lucide-react'
import { useT } from '../i18n/useLang'
import {
  BOOK_PAGE_SIZES,
  DEFAULT_BOOK_OPTIONS,
  bookSizeById,
  buildPhotoBook,
  renderBook,
  type BookOptions,
} from '../lib/photoBook'
import { useEditor, type LoadedDocument } from '../store/editorStore'

type BookTask = 'pdf' | 'print'

/**
 * Options for the photo book, and the progress of building it.
 *
 * A book is tens of seconds of work — every page is re-rendered at 300 DPI —
 * so it reports where it is and can be stopped. Without that it looks like the
 * app has hung.
 */
export function PhotoBookSheet({
  open,
  pages,
  onClose,
  onDone,
  onError,
}: {
  open: boolean
  /** Fully-committed page documents; the caller saves first. */
  pages: LoadedDocument[]
  onClose: () => void
  onDone: (pdf: Uint8Array) => void
  onError: () => void
}) {
  const t = useT()
  const [options, setOptions] = useState<BookOptions>(DEFAULT_BOOK_OPTIONS)
  const [progress, setProgress] = useState<{
    task: BookTask
    done: number
    total: number
  } | null>(null)
  const signal = useRef({ cancelled: false })
  const buttons = useRef<Partial<Record<BookTask, HTMLButtonElement | null>>>({})

  if (!open) return null

  const busy = progress !== null

  const close = () => {
    signal.current.cancelled = true
    setProgress(null)
    onClose()
  }

  const run = async (task: BookTask) => {
    signal.current = { cancelled: false }
    setProgress({ task, done: 0, total: pages.length })
    try {
      const editor = useEditor.getState()
      const hooks = {
        onProgress: (done: number, total: number) => setProgress({ task, done, total }),
        signal: signal.current,
        // A book that silently dropped the user's watermark would only be
        // noticed once it was printed.
        watermark: editor.watermark,
        print: editor.print,
      }
      if (task === 'pdf') {
        const pdf = await buildPhotoBook(pages, options, hooks)
        if (pdf) onDone(pdf)
        return
      }
      const book = await renderBook(pages, options, hooks)
      if (!book) return
      const { printBook } = await import('../lib/printBook')
      if (signal.current.cancelled) return
      await printBook(book, bookSizeById(options.sizeId))
    } catch (err) {
      console.error('[PhotoBookSheet] building the book failed', err)
      onError()
    } finally {
      setProgress(null)
      // The button was disabled while it worked, which drops keyboard focus to the page.
      if (!signal.current.cancelled) requestAnimationFrame(() => buttons.current[task]?.focus())
    }
  }

  const label = (task: BookTask, idle: ReactNode) =>
    progress?.task === task ? (
      <>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        {t('book.rendering')} {progress.done + 1}/{progress.total}
      </>
    ) : (
      idle
    )

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" onClick={busy ? undefined : close} />
      <div className="fixed inset-x-4 top-[12vh] z-50 mx-auto max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <BookOpen size={18} /> {t('book.title')}
          </h2>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-text"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-muted">
            {t('book.pageCount', { count: pages.length })}
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
              {t('book.size')}
            </span>
            <div className="flex flex-wrap gap-2">
              {BOOK_PAGE_SIZES.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setOptions((o) => ({ ...o, sizeId: size.id }))}
                  disabled={busy}
                  aria-pressed={options.sizeId === size.id}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition active:scale-95 disabled:opacity-50 ${
                    options.sizeId === size.id
                      ? 'bg-accent text-accent-fg'
                      : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                  }`}
                >
                  {t(size.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-text/80">
            <input
              type="checkbox"
              checked={options.cover}
              disabled={busy}
              onChange={(e) => setOptions((o) => ({ ...o, cover: e.target.checked }))}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {t('book.cover')}
          </label>

          <label className="flex items-center gap-2 text-sm text-text/80">
            <input
              type="checkbox"
              checked={options.pageNumbers}
              disabled={busy}
              onChange={(e) => setOptions((o) => ({ ...o, pageNumbers: e.target.checked }))}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {t('book.pageNumbers')}
          </label>

          <p className="text-[0.7rem] leading-relaxed text-muted">{t('book.hint')}</p>

          <button
            ref={(el) => void (buttons.current.pdf = el)}
            onClick={() => run('pdf')}
            disabled={busy || pages.length === 0}
            data-book-create
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
          >
            {label(
              'pdf',
              <>
                <BookOpen size={16} /> {t('book.create')}
              </>,
            )}
          </button>

          <button
            ref={(el) => void (buttons.current.print = el)}
            onClick={() => run('print')}
            disabled={busy || pages.length === 0}
            data-book-print
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-text transition hover:bg-surface-3 active:scale-[0.99] disabled:opacity-60"
          >
            {label(
              'print',
              <>
                <Printer size={16} /> {t('book.print')}
              </>,
            )}
          </button>
          <p role="status" className="sr-only">
            {progress ? `${t('book.rendering')} ${progress.done + 1}/${progress.total}` : ''}
          </p>
        </div>
      </div>
    </>
  )
}
