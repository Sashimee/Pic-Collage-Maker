const RECOVERED_AT_KEY = 'pcm-recovered-at'
// A crash this soon after a recovery reload means the saved board itself is
// what crashes, so recovering again would only loop.
const RECOVERY_WINDOW_MS = 15_000

let crashed = false

/**
 * Set by the root ErrorBoundary. Every autosave checks it: once the app has
 * crashed, the state in memory is the state that crashed, and writing it would
 * turn the last good autosave into one that crashes on load.
 */
export function markCrashed(): void {
  crashed = true
}

export function hasCrashed(): boolean {
  return crashed
}

export function noteRecovery(): void {
  try {
    sessionStorage.setItem(RECOVERED_AT_KEY, String(Date.now()))
  } catch {
    // Storage blocked (private mode): loop detection is lost, recovery still works.
  }
}

export function crashedRightAfterRecovery(now = Date.now()): boolean {
  try {
    const at = Number(sessionStorage.getItem(RECOVERED_AT_KEY))
    return at > 0 && now - at < RECOVERY_WINDOW_MS
  } catch {
    return false
  }
}
