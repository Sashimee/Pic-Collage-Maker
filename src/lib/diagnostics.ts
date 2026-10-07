import { useEditor } from '../store/editorStore'

const MAX_ENTRIES = 20
const recent: string[] = []

/**
 * Keep a short ring buffer of which editor fields changed, for the crash
 * report. Only field names are recorded — never text, colours or photos — so
 * the report is safe to paste into a bug tracker.
 */
export function startActionLog(): () => void {
  return useEditor.subscribe((next, prev) => {
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter(
      (key) => typeof next[key] !== 'function' && next[key] !== prev[key],
    )
    if (!changed.length) return
    recent.push(`${new Date().toISOString()} ${changed.join(', ')}`)
    if (recent.length > MAX_ENTRIES) recent.shift()
  })
}

export function buildDiagnostics(error: Error | undefined, componentStack?: string | null): string {
  const s = useEditor.getState()
  const build = document.querySelector('meta[name="app-build"]')?.getAttribute('content') ?? 'dev'
  return [
    'Pic Collage Maker crash report',
    `build: ${build}`,
    `time: ${new Date().toISOString()}`,
    `path: ${location.pathname}`,
    `userAgent: ${navigator.userAgent}`,
    `language: ${navigator.language}`,
    `viewport: ${innerWidth}x${innerHeight} @${devicePixelRatio}x`,
    `board: ${s.boardWidth}x${s.boardHeight}, ${s.elements.length} elements, mode ${s.mode}, grid ${s.gridId ?? 'none'}`,
    '',
    `error: ${error ? `${error.name}: ${error.message}` : 'unknown'}`,
    error?.stack ?? '',
    '',
    'component stack:',
    componentStack?.trim() ?? '(none)',
    '',
    'recent changes (oldest first):',
    ...(recent.length ? recent : ['(none)']),
  ].join('\n')
}
