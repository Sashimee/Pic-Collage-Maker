import { useEffect, useState } from 'react'
import { useVersionStore, type SnapshotMeta } from '../store/versionStore'
import { useEditor } from '../store/editorStore'
import { useProjects } from '../store/projectsStore'
import { useT } from '../i18n/useLang'
import { useToasts } from './ToastContainer'
import { Clock, RotateCcw, Trash2 } from 'lucide-react'
import { StepHistory } from './StepHistory'

function formatDate(ts: number) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function VersionHistoryPanel() {
  const t = useT()
  const toast = useToasts()
  const activeProjectId = useProjects((s) => s.activeProjectId)
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loading, setLoading] = useState(false)

  const loadSnapshots = async () => {
    const pid = activeProjectId ?? '__default__'
    setLoading(true)
    const rows = await useVersionStore.getState().getSnapshots(pid)
    setSnapshots(rows)
    setLoading(false)
  }

  // Reload when the project changes *and* when it is saved — a save is what
  // writes a new version, and the panel is usually already open when it lands.
  const savedAt = useProjects(
    (s) => s.projects.find((p) => p.id === s.activeProjectId)?.updatedAt,
  )

  useEffect(() => {
    loadSnapshots()
  }, [activeProjectId, savedAt])

  const handleRestore = async (id: string) => {
    const data = await useVersionStore.getState().restoreSnapshot(id)
    if (!data) {
      toast.error(t('version.restoreFail'))
      return
    }
    useEditor.getState().loadDocument({
      boardWidth: useEditor.getState().boardWidth,
      boardHeight: useEditor.getState().boardHeight,
      background: data.background,
      mode: useEditor.getState().mode,
      gridId: useEditor.getState().gridId,
      gridGap: useEditor.getState().gridGap,
      gridRadius: useEditor.getState().gridRadius,
      gridMargin: useEditor.getState().gridMargin,
      frame: useEditor.getState().frame,
      elements: data.elements,
    })
    toast.success(t('version.restored'))
  }

  const handleDelete = async (id: string) => {
    await useVersionStore.getState().deleteSnapshot(id)
    setSnapshots((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="flex flex-col gap-3">
      <StepHistory />
      <div className="flex items-center justify-between">
        <h3 className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
          {t('version.title')}
        </h3>
        <button
          onClick={loadSnapshots}
          className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-text/70 transition hover:bg-surface-3 hover:text-text"
        >
          {t('common.refresh')}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}

      {!loading && snapshots.length === 0 && (
        <p className="text-sm text-muted">{t('version.empty')}</p>
      )}

      <ul className="flex flex-col gap-2">
        {snapshots.map((snap) => (
          <li
            key={snap.id}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 transition hover:bg-surface-3"
          >
            <Clock size={14} className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">{formatDate(snap.timestamp)}</p>
              <p className="text-xs text-muted">
                {snap.elementCount} {snap.elementCount === 1 ? (t('version.element')) : (t('version.elements'))}
              </p>
            </div>
            <button
              onClick={() => handleRestore(snap.id)}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20"
            >
              <RotateCcw size={13} />
              {t('version.restore')}
            </button>
            <button
              onClick={() => handleDelete(snap.id)}
              className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger"
              aria-label={t('version.delete')}
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
