import { useEffect, useState } from 'react'
import { useEditor } from '../../store/editorStore'
import { useT } from '../../i18n/useLang'
import { Section } from '../ui'
import type { ShapePack } from '../../lib/stickers/library'

const FILL = '#6366f1'

export function ShapeLibrary() {
  const t = useT()
  const addShape = useEditor((s) => s.addShape)
  const [packs, setPacks] = useState<ShapePack[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    import('../../lib/stickers/library').then(
      (m) => live && setPacks(m.SHAPE_PACKS),
      (err) => {
        console.error('Shape library failed to load', err)
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [])

  if (failed) {
    // A failed dynamic import stays cached for the page's lifetime, so only a reload retries it.
    return (
      <div role="alert" className="flex items-center gap-2 text-sm text-muted">
        <p>{t('library.failed')}</p>
        <button
          onClick={() => location.reload()}
          className="min-h-[44px] shrink-0 rounded-lg bg-surface-2 px-3 font-medium text-text hover:bg-surface-3"
        >
          {t('common.refresh')}
        </button>
      </div>
    )
  }
  if (!packs) {
    return (
      <p role="status" className="min-h-[44px] text-sm text-muted">
        {t('library.loading')}
      </p>
    )
  }

  return (
    <>
      {packs.map((pack) => (
        <Section key={pack.id} title={t(pack.labelKey)}>
          <div
            role="group"
            aria-label={t(pack.labelKey)}
            className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1"
          >
            {pack.shapes.map((shape) => {
              const name = t(`library.${shape.id}`)
              return (
                <button
                  key={shape.id}
                  onClick={() => addShape('custom', FILL, { path: shape.d, libraryId: shape.id })}
                  aria-label={name}
                  title={name}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 transition hover:bg-surface-2 active:scale-90"
                >
                  <svg viewBox="-4 -4 128 128" className="h-8 w-8" aria-hidden="true">
                    <path d={shape.d} fill="currentColor" className="text-accent" />
                  </svg>
                </button>
              )
            })}
          </div>
        </Section>
      ))}
    </>
  )
}
