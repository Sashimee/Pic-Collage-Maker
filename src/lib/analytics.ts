/**
 * Anonymous usage counting via GoatCounter.
 *
 * The app's whole pitch is that photos never leave the device, so this is
 * deliberately the thinnest thing that can answer "did anyone show up, and did
 * they actually finish a collage": no cookies, no identifiers, no personal
 * data — GoatCounter records a path, a country and a referrer, and nothing that
 * could be tied back to a person. That is also why no consent banner is needed.
 *
 * Hard rule: **this module must never throw and never block the editor.** Every
 * entry point is wrapped, and a blocked or failed script is a silent no-op.
 */

import { useSettings } from '../store/settingsStore'

// Both are public — they show up in the script URL on every page load.
const ENDPOINT = 'https://sashimee.goatcounter.com/count'
const SCRIPT = 'https://gc.zgo.at/count.js'

/** Events fired before count.js finishes loading wait here. */
const pending: string[] = []
const MAX_PENDING = 20

let started = false
let ready = false

interface GoatCounter {
  count: (vars: { path: string; title?: string; event?: boolean }) => void
  /** Set by count.js once it has initialised. */
  no_onload?: boolean
}

declare global {
  interface Window {
    goatcounter?: GoatCounter
    doNotTrack?: string
  }
  interface Navigator {
    globalPrivacyControl?: boolean
    /** Non-standard, still present in Safari and older Firefox. */
    msDoNotTrack?: string
  }
}

/**
 * Respect every opt-out signal the browser offers. Checked before the script is
 * even requested, so an opted-out visitor makes no third-party request at all.
 */
function optedOut(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return true
  if (useSettings.getState().analyticsOptOut) return true
  if (navigator.globalPrivacyControl) return true
  const dnt = navigator.doNotTrack ?? window.doNotTrack ?? navigator.msDoNotTrack
  return dnt === '1' || dnt === 'yes'
}

/** Dev sessions must not pollute the numbers. */
function isLocal(): boolean {
  const h = window.location.hostname
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h === '' ||
    h.endsWith('.local')
  )
}

function enabled(): boolean {
  return !!ENDPOINT && typeof window !== 'undefined' && !optedOut() && !isLocal()
}

function flush() {
  ready = true
  const gc = window.goatcounter
  if (!gc?.count) return
  for (const path of pending.splice(0)) {
    try {
      gc.count({ path, event: true })
    } catch {
      /* a failed beacon is never worth surfacing */
    }
  }
}

/**
 * Load count.js once, lazily. Called from main.tsx outside the React tree —
 * StrictMode double-invokes effects, and `started` makes that harmless anyway.
 */
export function initAnalytics(): void {
  try {
    if (started || !enabled()) return
    started = true

    const load = () => {
      try {
        const s = document.createElement('script')
        s.src = SCRIPT
        s.defer = true
        s.dataset.goatcounter = ENDPOINT
        // count.js sends the pageview itself on load; flush queued events after.
        s.addEventListener('load', flush)
        s.addEventListener('error', () => {
          // Blocked by an extension or offline — drop everything, stay quiet.
          pending.length = 0
        })
        document.head.appendChild(s)
      } catch {
        /* ignore */
      }
    }

    // Never compete with the editor booting on a slow phone. Feature-detect by
    // type rather than `in`, which TS treats as always-true for a DOM lib member
    // and would narrow the fallback away — Safari only shipped this recently.
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(load, { timeout: 4000 })
    } else {
      window.setTimeout(load, 2000)
    }

    // The clearest signal someone liked it enough to keep it.
    window.addEventListener('appinstalled', () => track('pwa-installed'), { once: true })
  } catch {
    /* ignore */
  }
}

/**
 * Record one funnel event. Safe to call at any time: before init, after a
 * blocked script, or from an opted-out browser — all are silent no-ops.
 */
export function track(event: string): void {
  try {
    if (!enabled()) return
    const gc = window.goatcounter
    if (ready && gc?.count) {
      gc.count({ path: event, event: true })
      return
    }
    if (pending.length < MAX_PENDING) pending.push(event)
  } catch {
    /* ignore */
  }
}

/** Test seam — resets module state between cases. */
export function __resetAnalytics(): void {
  started = false
  ready = false
  pending.length = 0
}
