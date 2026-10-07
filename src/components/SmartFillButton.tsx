import { useId, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { useT } from '../i18n/useLang'
import { useToasts } from './ToastContainer'
import { assignSlots, cellRect, resolveLayoutById } from '../lib/grids'
import type { CanvasElement, PhotoElement } from '../types'

/** Re-seats the grid's photos so each lands in the cell that crops it, and its faces, least. */
export function SmartFillButton() {
  const t = useT()
  const toast = useToasts()
  const [busy, setBusy] = useState(false)
  const hintId = useId()
  const gridId = useEditor((s) => s.gridId)
  const mode = useEditor((s) => s.mode)
  const photoCount = useEditor(
    (s) => s.elements.filter((e) => e.type === 'photo' && !e.hidden).length,
  )
  const layout = gridId ? resolveLayoutById(gridId) : undefined
  if (mode !== 'grid' || !layout || layout.cells.length < 2) return null

  const run = async () => {
    if (busy) return
    const s = useEditor.getState()
    const photos = s.elements.filter((e): e is PhotoElement => e.type === 'photo')
    const slots = assignSlots(
      layout.cells.length,
      photos.filter((p) => !p.hidden),
    )
    const placed = slots.flatMap((p, cell) => (p ? [{ photo: p, cell }] : []))
    const cellAspects = layout.cells.map((cell) => {
      const r = cellRect(cell, s.boardWidth, s.boardHeight, s.gridGap, s.gridMargin)
      return r.w / r.h
    })
    setBusy(true)
    try {
      const { facesIn, smartAssign } = await import('../ai/smartFill')
      const measured = await Promise.all(
        placed.map(async ({ photo, cell }) => {
          // A crop's pixels are a window into the source, so its faces would need remapping; it is placed by shape alone.
          if (photo.crop) {
            return { aspect: photo.crop.width / photo.crop.height, faces: [], current: cell }
          }
          try {
            return { ...(await facesIn(photo.thumbSrc ?? photo.src)), current: cell }
          } catch (err) {
            console.warn(`Smart fill: could not read photo ${photo.id}; placing it by shape`, err)
            return { aspect: photo.width / photo.height, faces: [], current: cell }
          }
        }),
      )
      const placements = smartAssign(measured, cellAspects)

      const now = useEditor.getState()
      const unchanged =
        now.mode === 'grid' &&
        now.gridId === s.gridId &&
        placed.every(({ photo }) => now.elements.some((e) => e.id === photo.id))
      if (!unchanged) return

      const patches: Record<string, Partial<CanvasElement>> = {}
      // Hidden photos lose their pins too, or unhiding one would reclaim a cell from a placed photo.
      for (const p of photos) patches[p.id] = { cellIndex: undefined }
      placed.forEach(({ photo }, i) => {
        const at = placements[i]
        if (at) patches[photo.id] = { cellIndex: at.cell, cellPan: at.pan, cellZoom: 1 }
      })
      now.updateElements(patches, 'history.smartFill')
      toast.success(t('layout.smartFillDone'))
    } catch (err) {
      console.error('Smart fill failed', err)
      toast.error(t('layout.smartFillFailed'))
    } finally {
      setBusy(false)
    }
  }

  const needsPhotos = photoCount < 2

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={run}
        // Native `disabled` while busy would drop keyboard focus to <body>.
        disabled={needsPhotos}
        aria-disabled={busy || needsPhotos}
        aria-busy={busy}
        aria-describedby={needsPhotos ? hintId : undefined}
        className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-surface-2 px-3 text-sm font-medium text-text transition hover:bg-surface-3 active:scale-95 disabled:opacity-50 aria-disabled:opacity-50"
      >
        <Sparkles size={16} aria-hidden="true" />
        {busy ? t('layout.smartFillBusy') : t('layout.smartFill')}
      </button>
      {needsPhotos && (
        <p id={hintId} className="text-xs text-muted">
          {t('layout.smartFillNeedsPhotos')}
        </p>
      )}
    </div>
  )
}
