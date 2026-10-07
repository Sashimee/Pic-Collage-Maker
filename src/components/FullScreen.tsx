import { useEffect, useState } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import { useT } from '../i18n/useLang'

// Older Safari only has the webkit-prefixed API, and its methods return
// undefined rather than a promise.
type VendorCall = () => Promise<void> | void
type VendorDocument = Document & {
  webkitFullscreenElement?: Element | null
  mozFullScreenElement?: Element | null
  msFullscreenElement?: Element | null
  webkitExitFullscreen?: VendorCall
  mozCancelFullScreen?: VendorCall
  msExitFullscreen?: VendorCall
}
type VendorElement = HTMLElement & {
  webkitRequestFullscreen?: VendorCall
  mozRequestFullScreen?: VendorCall
  msRequestFullscreen?: VendorCall
}

export function useFullScreen() {
  const [isFullScreen, setIsFullScreen] = useState(false)

  const getFullScreenElement = (): Element | null => {
    const d = document as VendorDocument
    return (
      d.fullscreenElement ??
      d.webkitFullscreenElement ??
      d.mozFullScreenElement ??
      d.msFullscreenElement ??
      null
    )
  }

  useEffect(() => {
    const handler = () => setIsFullScreen(!!getFullScreenElement())
    document.addEventListener('fullscreenchange', handler)
    document.addEventListener('webkitfullscreenchange', handler)
    return () => {
      document.removeEventListener('fullscreenchange', handler)
      document.removeEventListener('webkitfullscreenchange', handler)
    }
  }, [])

  const toggle = () => {
    const d = document as VendorDocument
    const de = document.documentElement as VendorElement
    if (!getFullScreenElement()) {
      const req =
        de.requestFullscreen ??
        de.webkitRequestFullscreen ??
        de.mozRequestFullScreen ??
        de.msRequestFullscreen
      if (req) Promise.resolve(req.call(de)).catch(() => {})
    } else {
      const exit =
        d.exitFullscreen ??
        d.webkitExitFullscreen ??
        d.mozCancelFullScreen ??
        d.msExitFullscreen
      if (exit) Promise.resolve(exit.call(d)).catch(() => {})
    }
  }

  return { isFullScreen, toggle }
}

export function FullScreenButton() {
  const t = useT()
  const { isFullScreen, toggle } = useFullScreen()

  return (
    <button
      onClick={toggle}
      className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-text/80 transition hover:bg-surface-3"
      aria-label={isFullScreen ? t('fullscreen.exit') : t('fullscreen.enter')}
      title={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
    >
      {isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
    </button>
  )
}
