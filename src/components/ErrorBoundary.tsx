import { Component, useState, type ReactNode } from 'react'
import { useT } from '../i18n/useLang'
import { buildDiagnostics } from '../lib/diagnostics'
import { crashedRightAfterRecovery, markCrashed, noteRecovery } from '../lib/crashState'
import { PrimaryButton } from './ui'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  componentStack?: string | null
  recoveryLooped?: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    markCrashed()
    this.setState({
      componentStack: errorInfo.componentStack,
      recoveryLooped: crashedRightAfterRecovery(),
    })
  }

  // markCrashed() stops every autosave, so the stored board predates the state
  // that crashed; a reload restores it.
  handleRecover = () => {
    noteRecovery()
    window.location.reload()
  }

  handleReset = () => {
    try {
      localStorage.clear()
    } catch {
      // ignore
    }
    try {
      const req = indexedDB.deleteDatabase('piccollage')
      req.onsuccess = () => window.location.reload()
      req.onerror = () => window.location.reload()
      setTimeout(() => window.location.reload(), 300)
    } catch {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          diagnostics={buildDiagnostics(this.state.error, this.state.componentStack)}
          onRecover={this.state.recoveryLooped ? undefined : this.handleRecover}
          onReset={this.handleReset}
        />
      )
    }
    return this.props.children
  }
}

function ErrorFallback({
  error,
  diagnostics,
  onRecover,
  onReset,
}: {
  error?: Error
  diagnostics: string
  onRecover?: () => void
  onReset: () => void
}) {
  const t = useT()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(diagnostics)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 overflow-auto bg-surface px-6 text-center">
      <h2 className="text-xl font-bold text-text">{t('error.title')}</h2>
      <p className="max-w-md text-sm text-muted">
        {onRecover ? t('error.message') : t('error.recoverFailed')}
      </p>
      {error && (
        <pre className="max-w-md overflow-auto rounded-lg bg-surface-2 p-3 text-xs text-text/70">
          {error.message}
        </pre>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {onRecover && <PrimaryButton onClick={onRecover}>{t('error.recover')}</PrimaryButton>}
        <PrimaryButton onClick={copy}>
          {copyState === 'copied' ? t('error.copied') : t('error.copyDiagnostics')}
        </PrimaryButton>
        <PrimaryButton onClick={onReset}>{t('error.reset')}</PrimaryButton>
      </div>
      {copyState === 'failed' && (
        <p role="alert" className="text-sm text-muted">
          {t('error.copyFailed')}
        </p>
      )}
      <details className="w-full max-w-md text-left" open={copyState === 'failed'}>
        <summary className="cursor-pointer text-sm text-muted">{t('error.details')}</summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-surface-2 p-3 text-xs whitespace-pre-wrap text-text/70 select-all">
          {diagnostics}
        </pre>
        <p className="mt-2 text-xs text-muted">{t('error.privacy')}</p>
      </details>
    </div>
  )
}
