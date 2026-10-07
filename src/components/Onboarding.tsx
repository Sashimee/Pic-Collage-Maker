import { useEffect, useState } from 'react'
import { useT } from '../i18n/useLang'
import { m, AnimatePresence, SPRING } from './motion'
import { ImagePlus, Download, X, ChevronRight } from 'lucide-react'
import { hasSeen, markSeen } from '../lib/firstUse'

/*
 * The welcome carousel orients someone who has just arrived. It deliberately
 * no longer covers text: that is taught by a tip at the moment the tool is
 * opened, and being taught the same thing twice is worse than not at all.
 *
 * `Step.target` used to hold a `[data-tab="…"]` selector for a coach mark that
 * was never built — nothing read it, and no element in the app ever carried a
 * `data-tab` attribute. The per-tool tips are the spotlight now, so it is gone
 * rather than left looking implemented.
 */
interface Step {
  id: string
  title: string
  body: string
  icon: React.ReactNode
}

export function useOnboarding() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!hasSeen('welcome')) setShow(true)
  }, [])

  const dismiss = () => {
    setShow(false)
    markSeen('welcome')
  }

  return { show, dismiss }
}

export function OnboardingOverlay() {
  const t = useT()
  const { show, dismiss } = useOnboarding()
  const [step, setStep] = useState(0)

  const steps: Step[] = [
    {
      id: 'welcome',
      title: t('onboard.welcomeTitle'),
      body: t('onboard.welcomeBody'),
      icon: <span className="text-4xl">🎨</span>,
    },
    {
      id: 'photos',
      title: t('onboard.photosTitle'),
      body: t('onboard.photosBody'),
      icon: <ImagePlus size={40} className="text-accent" />,
    },
    {
      id: 'export',
      title: t('onboard.exportTitle'),
      body: t('onboard.exportBody'),
      icon: <Download size={40} className="text-accent" />,
    },
  ]

  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <AnimatePresence>
      {show && current && (
        <>
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Card */}
          <m.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={SPRING.pop}
            className="fixed left-1/2 top-1/2 z-[100] w-[min(22rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboard-title"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="mb-4">{current.icon}</div>
              <button
                onClick={dismiss}
                className="rounded-lg p-1 text-muted transition hover:bg-surface-2 hover:text-text"
                aria-label={t('aria.skipOnboarding')}
              >
                <X size={18} />
              </button>
            </div>

            <h2 id="onboard-title" className="text-lg font-bold text-text">{current.title}</h2>
            <p className="mt-1.5 text-sm text-muted">{current.body}</p>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition ${
                      i === step ? 'w-5 bg-accent' : 'w-1.5 bg-surface-3'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={() => {
                  if (isLast) dismiss()
                  else setStep((s) => s + 1)
                }}
                className="bg-grad-accent flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-accent transition hover:brightness-110 active:scale-95"
              >
                {isLast ? (t('onboard.done')) : (t('onboard.next'))}
                <ChevronRight size={16} />
              </button>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
