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

  if (failed) return <p className="text-sm text-muted">{t('library.failed')}</p>
  if (!packs) return null

  return (
    <>
      {packs.map((pack) => (
        <Section key={pack.id} title={t(pack.labelKey)}>
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {pack.shapes.map((shape, i) => {
              const name = `${t(pack.labelKey)} ${i + 1}`
              return (
                <button
                  key={shape.id}
                  onClick={() => addShape('custom', FILL, { path: shape.d, name })}
                  aria-label={name}
                  title={name}
                  className="flex min-h-[44px] items-center justify-center rounded-lg p-1.5 transition hover:bg-surface-2 active:scale-90"
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
