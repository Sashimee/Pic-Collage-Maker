import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { langReady } from './i18n/useLang'
import { initAnalytics } from './lib/analytics'
import { startActionLog } from './lib/diagnostics'
import { initPwaInstall } from './lib/pwaInstall'
import './index.css'

// Outside the React tree on purpose: StrictMode double-invokes effects, and
// these must fire exactly once per page load. `beforeinstallprompt` in
// particular often fires before React mounts — a listener added from an effect
// misses it for the rest of the page's life.
initAnalytics()
initPwaInstall()
startActionLog()

// A visitor whose language isn't English would otherwise see English flash
// first; index.html's shell stays on screen while their strings load.
void langReady.then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  ),
)
