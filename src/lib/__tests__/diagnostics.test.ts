import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { useEditor } from '../../store/editorStore'
import { buildDiagnostics, startActionLog } from '../diagnostics'

const recentSection = (report: string) =>
  report.split('recent changes (oldest first):\n')[1].split('\n')

describe('diagnostics', () => {
  let stop: () => void
  beforeAll(() => {
    stop = startActionLog()
  })
  afterAll(() => stop())

  it('reports the build, environment and board shape', () => {
    const meta = document.createElement('meta')
    meta.name = 'app-build'
    meta.content = 'abc1234'
    document.head.append(meta)
    try {
      const report = buildDiagnostics(new TypeError('boom'), '\n    at TextNode')
      expect(report).toContain('build: abc1234')
      expect(report).toContain(`userAgent: ${navigator.userAgent}`)
      expect(report).toMatch(/board: \d+x\d+, \d+ elements, mode \w+/)
      expect(report).toContain('error: TypeError: boom')
      expect(report).toContain('at TextNode')
    } finally {
      meta.remove()
    }
  })

  it('falls back when there is no build stamp, error or component stack', () => {
    const report = buildDiagnostics(undefined)
    expect(report).toContain('build: dev')
    expect(report).toContain('error: unknown')
    expect(report).toContain('component stack:\n(none)')
  })

  it('logs which fields changed, never their contents', () => {
    useEditor.getState().addText()
    const id = useEditor.getState().elements.at(-1)!.id
    useEditor.getState().updateElement(id, { text: 'a secret caption' })
    const report = buildDiagnostics(undefined)
    expect(recentSection(report).at(-1)).toMatch(/^\d{4}-\d\d-\d\dT\S+ .*\belements\b/)
    expect(report).not.toContain('a secret caption')
  })

  it('keeps only the 20 most recent changes', () => {
    for (let i = 0; i < 30; i++) useEditor.getState().select(i % 2 ? null : 'x')
    expect(recentSection(buildDiagnostics(undefined))).toHaveLength(20)
  })
})
