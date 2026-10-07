import { useEffect, useId, useRef } from 'react'
import { Check } from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { useT } from '../i18n/useLang'
import { useToasts } from './ToastContainer'

/**
 * The undo stack as a list of named steps, oldest first. Picking a step undoes
 * or redoes everything after or up to it in one go.
 */
export function StepHistory() {
  const t = useT()
  const toast = useToasts()
  const titleId = useId()
  const past = useEditor((s) => s.past)
  const future = useEditor((s) => s.future)
  const travel = useEditor((s) => s.travel)
  const currentRef = useRef<HTMLButtonElement>(null)

  const steps = [
    t('history.start'),
    ...past.map((e) => t(e.label)),
    ...future.map((e) => t(e.label)),
  ]
  const current = past.length

  useEffect(() => {
    currentRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [current])

  const jump = (i: number) => {
    if (i === current) return
    travel(i - current)
    toast.info(`${t('history.jumped')} ${steps[i]}`)
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 id={titleId} className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
        {t('history.title')}
      </h3>
      {steps.length === 1 ? (
        <p className="text-sm text-muted">{t('history.empty')}</p>
      ) : (
        <ol aria-labelledby={titleId} className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {steps.map((label, i) => (
            <li key={i}>
              <button
                ref={i === current ? currentRef : undefined}
                onClick={() => jump(i)}
                aria-current={i === current ? 'step' : undefined}
                aria-disabled={i === current || undefined}
                className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-3 ${
                  i === current
                    ? 'bg-accent/10 font-semibold text-text'
                    : i > current
                      ? 'text-muted'
                      : 'text-text/90'
                }`}
              >
                <span className="w-4 shrink-0">
                  {i === current && <Check size={14} aria-hidden="true" />}
                </span>
                {label}
                {i > current && <span className="sr-only">, {t('history.undone')}</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
