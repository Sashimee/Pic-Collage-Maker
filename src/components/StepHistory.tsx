import { Check } from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { useT } from '../i18n/useLang'

/**
 * The undo stack as a list of named steps, oldest first. Picking a step undoes
 * or redoes everything after or up to it in one go.
 */
export function StepHistory() {
  const t = useT()
  const past = useEditor((s) => s.past)
  const future = useEditor((s) => s.future)
  const travel = useEditor((s) => s.travel)

  const steps = [
    t('history.start'),
    ...past.map((e) => t(e.label)),
    ...future.map((e) => t(e.label)),
  ]
  const current = past.length

  return (
    <section className="flex flex-col gap-2" aria-labelledby="step-history-title">
      <h3
        id="step-history-title"
        className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted"
      >
        {t('history.title')}
      </h3>
      {steps.length === 1 ? (
        <p className="text-sm text-muted">{t('history.empty')}</p>
      ) : (
        <ol className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {steps.map((label, i) => (
            <li key={i}>
              <button
                onClick={() => travel(i - current)}
                aria-current={i === current ? 'step' : undefined}
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
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
