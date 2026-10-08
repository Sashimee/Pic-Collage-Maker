import { useEffect, useId, useRef, useState } from 'react'
import { Clapperboard, Music, X } from 'lucide-react'
import { useT } from '../i18n/useLang'
import {
  DEFAULT_SLIDESHOW,
  SECONDS_PER_PAGE,
  buildSlideshow,
  decodeMusic,
  type SlideshowOptions,
  type SlideshowProgress,
  type VideoFormat,
} from '../lib/exportVideo'
import { useEditor, type LoadedDocument } from '../store/editorStore'

/**
 * Options for the slideshow video, and its progress. Recording runs in real
 * time — a twelve-page show at three seconds a page takes thirty-six seconds —
 * so, like the photo book, it shows where it is and can be stopped.
 */
export function SlideshowSheet({
  pages,
  onClose,
  onDone,
  onError,
}: {
  /** Fully-committed page documents; the caller saves first. */
  pages: LoadedDocument[]
  onClose: () => void
  onDone: (video: Blob, format: VideoFormat) => void
  onError: () => void
}) {
  const t = useT()
  const [options, setOptions] = useState<SlideshowOptions>(DEFAULT_SLIDESHOW)
  const [progress, setProgress] = useState<SlideshowProgress | null>(null)
  const [musicName, setMusicName] = useState<string | null>(null)
  const [musicFailed, setMusicFailed] = useState(false)
  const [decoding, setDecoding] = useState(false)
  const musicInput = useRef<HTMLInputElement>(null)
  const musicRemove = useRef<HTMLButtonElement>(null)
  const musicPick = useRef(0)
  const focusMusic = useRef(false)
  const musicNameId = useId()
  const musicErrorId = useId()
  const signal = useRef({ cancelled: false })
  const createButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const perPageLabel = useId()
  // Read during the first render, before the close button takes focus: the
  // control that opened the sheet, so closing can hand focus back to it.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )
  const busy = progress !== null

  // Choosing or removing a song swaps the input for the remove button (or back)
  // while it holds focus, so focus follows once the swap has rendered.
  useEffect(() => {
    if (!focusMusic.current) return
    focusMusic.current = false
    ;(musicName ? musicRemove.current : musicInput.current)?.focus()
  }, [musicName])

  const returnFocus = () => {
    if (opener?.isConnected) opener.focus()
  }

  const close = () => {
    signal.current.cancelled = true
    setProgress(null)
    onClose()
    returnFocus()
  }
  const closeRef = useRef(close)
  closeRef.current = close

  // Capture phase, so the editor's shortcuts never see a key meant for the
  // sheet: Delete or an arrow would otherwise edit the board behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const stops = [
          ...(dialog.current?.querySelectorAll<HTMLElement>('button:enabled, input:enabled') ?? []),
        ]
        const at = stops.findIndex((stop) => stop === document.activeElement)
        stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const run = async () => {
    signal.current = { cancelled: false }
    setProgress({ phase: 'render', done: 0, total: pages.length })
    try {
      const editor = useEditor.getState()
      const video = await buildSlideshow(pages, options, {
        onProgress: setProgress,
        signal: signal.current,
        watermark: editor.watermark,
      })
      if (video) {
        onDone(video.blob, video.format)
        returnFocus()
        return
      }
    } catch (err) {
      console.error('[SlideshowSheet] recording the slideshow failed', err)
      onError()
    } finally {
      setProgress(null)
      // The button was disabled while it worked, which drops keyboard focus to the page.
      if (!signal.current.cancelled) requestAnimationFrame(() => createButton.current?.focus())
    }
  }

  const pickMusic = async (file: File | undefined) => {
    if (!file) return
    const pick = ++musicPick.current
    setMusicFailed(false)
    setDecoding(true)
    try {
      const music = await decodeMusic(file)
      if (pick !== musicPick.current) return
      setOptions((o) => ({ ...o, music }))
      focusMusic.current = true
      setMusicName(file.name)
    } catch (err) {
      if (pick !== musicPick.current) return
      console.warn('[SlideshowSheet] the chosen song does not decode', err)
      setOptions((o) => ({ ...o, music: null }))
      setMusicName(null)
      setMusicFailed(true)
    } finally {
      if (pick === musicPick.current) setDecoding(false)
    }
  }

  const removeMusic = () => {
    musicPick.current++
    setOptions((o) => ({ ...o, music: null }))
    focusMusic.current = true
    setMusicName(null)
  }

  const status =
    progress?.phase === 'render'
      ? `${t('book.rendering')} ${Math.min(progress.done + 1, progress.total)}/${progress.total}`
      : progress
        ? `${t('video.recording')} ${progress.done}/${progress.total} s`
        : ''
  // The visible count ticks every second; announcing each tick would talk over
  // everything else for the whole recording, so the live region names the phase.
  const announcement = progress?.phase === 'record' ? t('video.recording') : status

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden="true"
        onClick={busy ? undefined : close}
      />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideshow-title"
        className="fixed inset-x-4 top-[12vh] z-50 mx-auto max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2
            id="slideshow-title"
            className="flex items-center gap-2 text-base font-semibold text-text"
          >
            <Clapperboard size={18} /> {t('video.title')}
          </h2>
          <button
            autoFocus
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-text"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-muted">{t('book.pageCount', { count: pages.length })}</p>

          <div className="flex flex-col gap-2">
            <span
              id={perPageLabel}
              className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted"
            >
              {t('video.perPage')}
            </span>
            <div role="group" aria-labelledby={perPageLabel} className="flex flex-wrap gap-2">
              {SECONDS_PER_PAGE.map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => setOptions((o) => ({ ...o, secondsPerPage: seconds }))}
                  disabled={busy}
                  aria-pressed={options.secondsPerPage === seconds}
                  aria-label={t('video.seconds', { count: seconds })}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition active:scale-95 disabled:opacity-50 ${
                    options.secondsPerPage === seconds
                      ? 'bg-accent text-accent-fg'
                      : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                  }`}
                >
                  {seconds} s
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-text/80">
            <input
              type="checkbox"
              checked={options.fadeSeconds > 0}
              disabled={busy}
              onChange={(e) =>
                setOptions((o) => ({
                  ...o,
                  fadeSeconds: e.target.checked ? DEFAULT_SLIDESHOW.fadeSeconds : 0,
                }))
              }
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {t('video.fade')}
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
              {t('video.music')}
            </span>
            {musicName ? (
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-text/80">
                <Music size={14} className="shrink-0" />
                <span id={musicNameId} className="min-w-0 flex-1 truncate">
                  {musicName}
                </span>
                <button
                  ref={musicRemove}
                  onClick={removeMusic}
                  disabled={busy}
                  aria-label={t('video.musicRemove')}
                  aria-describedby={musicNameId}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface-3 hover:text-text disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 self-start rounded-lg bg-surface-2 px-3 py-1.5 text-[0.75rem] font-medium text-text/80 transition hover:bg-surface-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2">
                <Music size={14} />
                {t('video.musicPick')}
                <input
                  ref={musicInput}
                  type="file"
                  accept="audio/*"
                  disabled={busy}
                  aria-invalid={musicFailed || undefined}
                  aria-describedby={musicFailed ? musicErrorId : undefined}
                  className="sr-only"
                  onChange={(e) => {
                    void pickMusic(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            )}
            {musicFailed && (
              <p id={musicErrorId} role="alert" className="text-[0.75rem] text-danger">
                {t('video.musicFailed')}
              </p>
            )}
          </div>

          <p className="text-[0.7rem] leading-relaxed text-muted">{t('video.hint')}</p>

          <button
            ref={createButton}
            onClick={() => void run()}
            disabled={busy || decoding || pages.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {status}
              </>
            ) : (
              <>
                <Clapperboard size={16} /> {t('video.create')}
              </>
            )}
          </button>
          <p role="status" className="sr-only">
            {announcement}
          </p>
        </div>
      </div>
    </>
  )
}
