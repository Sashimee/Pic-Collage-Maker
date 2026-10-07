import { m, AnimatePresence, SPRING } from './motion'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useToast, type ToastAction } from '../store/toastStore'
import type { ReactNode } from 'react'
import { useT } from '../i18n/useLang'

const ICONS: Record<string, ReactNode> = {
  success: <CheckCircle size={18} className="text-emerald-400" />,
  error: <AlertCircle size={18} className="text-danger" />,
  info: <Info size={18} className="text-accent" />,
}

export function ToastContainer() {
  const t = useT()
  const toasts = useToast((s) => s.toasts)
  const remove = useToast((s) => s.remove)

  return (
    // A live region: toasts announce results (and now carry actions), so screen
    // readers need to hear them without the focus moving.
    <div
      role="status"
      aria-live="polite"
      // A progress toast rewrites its count per item; atomic would re-read every toast and button each time.
      aria-atomic="false"
      className="pointer-events-none fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <m.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={SPRING.pop}
            className="pointer-events-auto flex min-w-[12rem] max-w-md items-center gap-2.5 rounded-xl border border-border bg-surface/95 px-4 py-2.5 text-sm font-medium text-text shadow-card backdrop-blur"
          >
            {ICONS[toast.type]}
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="shrink-0 rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent/25 active:scale-95"
              >
                {toast.action.label}
              </button>
            )}
            {/* Hiding a running job would leave it going with no way left to stop it. */}
            {!(toast.duration === 0 && toast.action) && (
              <button
                onClick={() => remove(toast.id)}
                className="ml-1 rounded-md p-1 text-muted transition hover:text-text hover:bg-surface-2"
                aria-label={t('aria.dismiss')}
              >
                ✕
              </button>
            )}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Convenience hook for firing toasts from components. */
export function useToasts() {
  const addToast = useToast((s) => s.add)
  const updateToast = useToast((s) => s.update)
  const removeToast = useToast((s) => s.remove)
  return {
    success: (msg: string) => addToast(msg, 'success', 3000),
    error: (msg: string) => addToast(msg, 'error', 4000),
    info: (msg: string) => addToast(msg, 'info', 3000),
    /** A toast whose message is markup — used by the gesture tips. */
    rich: (node: ReactNode, duration = 6000) => addToast(node, 'info', duration),
    warn: (msg: string) => addToast(msg, 'error', 5000),
    /** A toast that offers a way out — e.g. "save the file the share ate". */
    action: (msg: string, action: ToastAction, duration = 8000) =>
      addToast(msg, 'info', duration, action),
    /**
     * A toast that stays until the work finishes. Rendering several pages is
     * seconds of silence otherwise, which reads as the app having hung.
     */
    progress: (msg: string, cancel?: ToastAction) => {
      const id = addToast(msg, 'info', 0, cancel)
      return {
        update: (next: string) => updateToast(id, next),
        done: () => removeToast(id),
      }
    },
  }
}
