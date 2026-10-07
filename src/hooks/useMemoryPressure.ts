import { useEffect, useRef } from 'react'
import { useToasts } from '../components/ToastContainer'
import { useT } from '../i18n/useLang'

interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

declare global {
  interface Performance {
    memory?: MemoryInfo
  }
}

const INTERVAL_MS = 30_000
const THRESHOLD = 0.8

export function useMemoryPressure() {
  const toast = useToasts()
  const t = useT()
  // Both are new functions every render; as effect deps they re-armed the check, and the
  // warning, on every render of the app.
  const latest = useRef({ warn: toast.warn, t })
  useEffect(() => {
    latest.current = { warn: toast.warn, t }
  })

  useEffect(() => {
    if (!performance.memory) return
    // Once per spell of pressure: the same warning every 30 s would bury every other toast.
    let warned = false

    const check = () => {
      const mem = performance.memory!
      const ratio = mem.usedJSHeapSize / mem.jsHeapSizeLimit
      if (ratio <= THRESHOLD) warned = false
      else if (!warned) {
        warned = true
        const { warn, t } = latest.current
        warn(`${t('memory.low')} (${(ratio * 100).toFixed(0)}%)`)
      }
    }

    check()
    const id = setInterval(check, INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
