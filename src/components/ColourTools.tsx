import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, Pipette } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useEditor } from '../store/editorStore'
import { useT } from '../i18n/useLang'
import { eyeDropper, normalizeColour, paletteOf, useColours } from '../lib/palette'
import { useToast } from '../store/toastStore'

const MAX_PHOTO_SWATCHES = 8
const PHOTOS_SAMPLED = 4

function usePhotoPalette(): string[] {
  const srcs = useEditor(
    useShallow((s) =>
      s.elements
        .filter((e) => e.type === 'photo')
        .slice(0, PHOTOS_SAMPLED)
        .map((e) => (e.type === 'photo' ? e.src : '')),
    ),
  )
  const [palette, setPalette] = useState<string[]>([])
  useEffect(() => {
    let live = true
    Promise.allSettled(srcs.map(paletteOf)).then((results) => {
      if (!live) return
      const colours = results.flatMap((r) => {
        if (r.status === 'fulfilled') return r.value
        console.error(r.reason)
        return []
      })
      setPalette([...new Set(colours)].slice(0, MAX_PHOTO_SWATCHES))
    })
    return () => {
      live = false
    }
  }, [srcs])
  return palette
}

const SWATCH_EDGE = 'inset 0 0 0 1px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.6)'

function Swatches({
  label,
  colours,
  value,
  onPick,
}: {
  label: string
  colours: string[]
  value: string
  onPick: (hex: string) => void
}) {
  const t = useT()
  const labelId = useId()
  if (!colours.length) return null
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1">
      <span id={labelId} className="text-[11px] font-medium text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {colours.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${t('common.color')} ${c.toUpperCase()}`}
            title={c}
            aria-pressed={c === value}
            onClick={() => onPick(c)}
            style={{ background: c, boxShadow: SWATCH_EDGE }}
            className={`h-11 w-11 rounded-lg transition active:scale-90 ${
              c === value ? 'outline-2 outline-offset-2 outline-accent' : ''
            }`}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Arms the tap-the-board picker until a colour is picked, Escape is pressed,
 * or its toast goes away — by Cancel, ✕ or timing out — so the board is never
 * left in a mode nothing on screen explains.
 */
function armBoardPick(message: string, cancel: string, onPick: (hex: string) => void) {
  const { startBoardPick, endBoardPick } = useColours.getState()
  const toastId = useToast
    .getState()
    .add(message, 'info', 15000, { label: cancel, onClick: endBoardPick })
  startBoardPick(onPick)
  const stopWatchingToast = useToast.subscribe((s) => {
    if (!s.toasts.some((x) => x.id === toastId)) endBoardPick()
  })
  const stopWatchingPick = useColours.subscribe((s) => {
    if (s.boardPick) return
    stopWatchingPick()
    stopWatchingToast()
    useToast.getState().remove(toastId)
  })
}

/** Eyedropper, photo palette, recent colours and saved swatches for one colour field. */
export function ColourTools({
  id,
  value,
  onPick,
  openNativePicker,
}: {
  id: string
  value: string
  onPick: (hex: string) => void
  /** Keyboard route where there is no EyeDropper API: the browser's own picker. */
  openNativePicker: () => void
}) {
  const t = useT()
  const recent = useColours((s) => s.recent)
  const saved = useColours((s) => s.saved)
  const armed = useColours((s) => !!s.boardPick)
  const photoPalette = usePhotoPalette()
  const current = normalizeColour(value) ?? value
  const isSaved = saved.includes(current)
  const hasEyeDropper = !!eyeDropper()
  const choose = (hex: string) => {
    onPick(hex)
    useColours.getState().remember(hex)
  }
  const latestChoose = useRef(choose)
  useEffect(() => {
    latestChoose.current = choose
  })
  const boardPick = useRef((hex: string) => latestChoose.current(hex))
  useEffect(() => {
    const ownPick = boardPick.current
    return () => {
      if (useColours.getState().boardPick === ownPick) useColours.getState().endBoardPick()
    }
  }, [])

  const pick = async (fromKeyboard: boolean) => {
    const EyeDropper = eyeDropper()
    if (!EyeDropper) {
      if (armed) useColours.getState().endBoardPick()
      else if (fromKeyboard) openNativePicker()
      else armBoardPick(t('color.tapBoard'), t('menu.cancel'), boardPick.current)
      return
    }
    try {
      const hex = normalizeColour((await new EyeDropper().open()).sRGBHex)
      if (hex) choose(hex)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      throw err
    }
  }

  const photoSwatches = useMemo(
    () => photoPalette.filter((c) => !recent.includes(c)),
    [photoPalette, recent],
  )

  return (
    <div id={id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-2">
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={hasEyeDropper ? undefined : armed}
          onClick={(e) => void pick(e.detail === 0)}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-text/80 transition hover:bg-surface-3 active:scale-95"
        >
          <Pipette size={16} aria-hidden />
          {t('color.eyedropper')}
        </button>
        <button
          type="button"
          aria-pressed={isSaved}
          onClick={() => useColours.getState().toggleSaved(current)}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-text/80 transition hover:bg-surface-3 active:scale-95"
        >
          {isSaved ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
          {t('color.save')}
        </button>
      </div>
      <Swatches label={t('color.recent')} colours={recent} value={current} onPick={choose} />
      <Swatches
        label={t('color.fromPhotos')}
        colours={photoSwatches}
        value={current}
        onPick={choose}
      />
      <Swatches label={t('color.saved')} colours={saved} value={current} onPick={choose} />
    </div>
  )
}
