import { useState, useEffect, useId } from 'react'
import {
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Pencil,
  X,
  Save,
  ChevronRight,
} from 'lucide-react'
import { useProjects } from '../store/projectsStore'
import { useEditor } from '../store/editorStore'
import { addUndoToast } from '../store/toastStore'
import { useLang, useT } from '../i18n/useLang'
import {
  formatBytes,
  requestPersistentStorage,
  storageStatus,
  type StorageStatus,
} from '../lib/storage'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ProjectManager({ open, onClose }: Props) {
  const t = useT()
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [storage, setStorage] = useState<StorageStatus | null>(null)
  const [storageCheck, setStorageCheck] = useState(0)
  const lang = useLang((s) => s.lang)
  const titleId = useId()

  const {
    projects,
    isLoading,
    activeProjectId,
    loadProjectList,
    createProject,
    openProject,
    renameProject,
    duplicateProject,
    deleteProject,
    restoreProject,
  } = useProjects()

  useEffect(() => {
    if (open) loadProjectList()
  }, [open])

  useEffect(() => {
    if (!open) return
    let live = true
    storageStatus()
      .then((status) => {
        if (live) setStorage(status)
      })
      .catch((err: unknown) => console.error('Could not read how much storage is in use', err))
    return () => {
      live = false
    }
  }, [open, projects.length, storageCheck])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleCreate = async () => {
    const name = newName.trim() || t('project.untitled')
    await createProject(name)
    setNewName('')
    setCreateOpen(false)
    requestPersistentStorage()
      .catch((err: unknown) =>
        console.error('Could not ask the browser to keep the saved projects', err),
      )
      .finally(() => setStorageCheck((n) => n + 1))
  }

  const handleRename = async (id: string) => {
    const name = renameValue.trim()
    if (!name) return
    await renameProject(id, name)
    setRenameId(null)
    setRenameValue('')
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold text-text">
            <FolderOpen size={18} /> {t('project.title')}
          </h2>
          <button
            autoFocus
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-3">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {createOpen ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder={t('project.namePlaceholder')}
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
              />
              <button
                onClick={handleCreate}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white hover:brightness-110"
              >
                <Save size={16} />
              </button>
              <button
                onClick={() => setCreateOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-3"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-medium text-accent transition hover:bg-surface-2">
              <Plus size={16} /> {t('project.new')}
            </button>
          )}

          {isLoading && (
            <p className="py-4 text-center text-sm text-muted">{t('project.loading')}</p>
          )}

          {projects.length === 0 && !isLoading && (
            <p className="py-6 text-center text-sm text-muted">{t('project.empty')}</p>
          )}

          <ul className="mt-2 space-y-1">
            {projects.map((p) => (
              <li
                key={p.id}
                className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
                  activeProjectId === p.id
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-surface-2 hover:bg-surface-3'
                }`}
              >
                <button
                  onClick={() => { openProject(p.id); onClose() }}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <ChevronRight
                    size={14}
                    className={activeProjectId === p.id ? 'text-accent' : 'text-muted'}
                  />
                  {renameId === p.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(p.id)
                        if (e.key === 'Escape') setRenameId(null)
                      }}
                      onBlur={() => handleRename(p.id)}
                      className="flex-1 rounded border border-accent bg-surface px-2 py-1 text-sm text-text outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-medium text-text">{p.name}</span>
                  )}
                  <span className="text-xs text-muted">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </span>
                </button>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setRenameId(p.id)
                      setRenameValue(p.name)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-text"
                    title={t('project.rename')}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void duplicateProject(p.id)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-text"
                    title={t('project.duplicate')}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const reattach =
                        p.id === activeProjectId ? useEditor.getState().documentId : undefined
                      void deleteProject(p.id).then((deleted) => {
                        if (!deleted) return
                        addUndoToast(t('project.deleted'), t('header.undo'), () =>
                          restoreProject(deleted, reattach).catch((err: unknown) =>
                            console.error('Restoring the deleted project failed', err),
                          ),
                        )
                      })
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                    title={t('project.delete')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {storage && storage.quota > 0 && (
          <div className="border-t border-border px-4 py-3 text-xs text-muted">
            <div className="flex items-center justify-between gap-2">
              <span id="storage-used-label">{t('project.storageUsed')}</span>
              <span aria-hidden="true">
                {formatBytes(storage.usage, lang)} / {formatBytes(storage.quota, lang)}
              </span>
            </div>
            <div
              role="meter"
              aria-labelledby="storage-used-label"
              aria-valuemin={0}
              aria-valuemax={storage.quota}
              aria-valuenow={Math.min(storage.usage, storage.quota)}
              aria-valuetext={`${formatBytes(storage.usage, lang)} / ${formatBytes(storage.quota, lang)}`}
              className="mt-1.5 h-1.5 overflow-hidden rounded-full border border-border bg-surface-3"
            >
              <div
                className={`h-full rounded-full bg-accent ${storage.usage > 0 ? 'min-w-1' : ''}`}
                style={{ width: `${Math.min(100, (storage.usage / storage.quota) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5">
              {t(storage.persisted ? 'project.storagePersistent' : 'project.storageBestEffort')}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
