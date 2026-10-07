import { m, AnimatePresence } from './motion'
import { X, Download, WifiOff, Maximize2, Zap } from 'lucide-react'
import { useT } from '../i18n/useLang'
import { useInstall } from '../lib/pwaInstall'
import { track } from '../lib/analytics'
import { BrandMark } from './header/BrandMark'

/*
 * Illustrations are inline SVG rather than screenshots: they stay sharp at any
 * size, follow the theme, keep their labels translatable, and won't look wrong
 * the next time Apple or Google restyles their browser chrome.
 */

const StepFrame = ({ children }: { children: React.ReactNode }) => (
  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-text">
    {children}
  </span>
)

/** iOS Safari's share glyph: a box with an arrow leaving the top. */
const ShareGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
    <path
      d="M12 3v11M12 3l-3.2 3.2M12 3l3.2 3.2"
      stroke="#0a84ff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 10H5.6A1.6 1.6 0 0 0 4 11.6v7.8A1.6 1.6 0 0 0 5.6 21h12.8a1.6 1.6 0 0 0 1.6-1.6v-7.8A1.6 1.6 0 0 0 18.4 10H17"
      stroke="#0a84ff"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
)

/** The "Add to Home Screen" row as it appears in the iOS share sheet. */
const AddRowGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

/** Chrome's overflow menu. */
const KebabGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
    <circle cx="12" cy="5" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="19" r="1.7" fill="currentColor" />
  </svg>
)

function Step({ n, glyph, text }: { n: number; glyph: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[0.65rem] font-bold text-accent-fg">
        {n}
      </span>
      <StepFrame>{glyph}</StepFrame>
      <span className="text-sm text-text">{text}</span>
    </li>
  )
}

function Benefit({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2 text-xs text-muted">
      <span className="text-accent">{icon}</span>
      {text}
    </li>
  )
}

export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const canPrompt = useInstall((s) => s.canPrompt)
  const platform = useInstall((s) => s.platform)
  const promptInstall = useInstall((s) => s.promptInstall)

  const handleInstall = async () => {
    const outcome = await promptInstall()
    track(outcome === 'accepted' ? 'install-accepted' : 'install-dismissed')
    if (outcome !== 'dismissed') onClose()
  }

  const dismiss = () => {
    track('install-dismissed')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={dismiss}
          />

          <m.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-[100] max-h-[88vh] w-[min(23rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
          >
            <div className="flex items-start justify-between gap-3">
              <BrandMark className="h-12 w-12 shrink-0 rounded-xl" />
              <button
                onClick={dismiss}
                className="rounded-lg p-1 text-muted transition hover:bg-surface-2 hover:text-text"
                aria-label={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            <h2 id="install-title" className="mt-3 text-lg font-bold text-text">
              {t('install.title')}
            </h2>
            <p className="mt-1 text-sm text-muted">{t('install.subtitle')}</p>

            <ul className="mt-4 flex flex-col gap-1.5">
              <Benefit icon={<WifiOff size={14} />} text={t('install.benefitOffline')} />
              <Benefit icon={<Maximize2 size={14} />} text={t('install.benefitFullscreen')} />
              <Benefit icon={<Zap size={14} />} text={t('install.benefitFast')} />
            </ul>

            {canPrompt ? (
              <button
                onClick={handleInstall}
                className="bg-grad-accent mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-[var(--shadow-accent)] transition hover:brightness-110 active:scale-95"
              >
                <Download size={17} strokeWidth={2.5} />
                {t('install.cta')}
              </button>
            ) : (
              <ol className="mt-5 flex flex-col gap-3">
                {platform === 'ios' ? (
                  <>
                    <Step n={1} glyph={<ShareGlyph />} text={t('install.iosStep1')} />
                    <Step n={2} glyph={<AddRowGlyph />} text={t('install.iosStep2')} />
                    <Step n={3} glyph={<BrandMark className="h-6 w-6 rounded-md" />} text={t('install.iosStep3')} />
                  </>
                ) : (
                  <>
                    <Step n={1} glyph={<KebabGlyph />} text={t('install.androidStep1')} />
                    <Step n={2} glyph={<AddRowGlyph />} text={t('install.androidStep2')} />
                  </>
                )}
              </ol>
            )}

            <button
              onClick={dismiss}
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2"
            >
              {t('install.later')}
            </button>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
