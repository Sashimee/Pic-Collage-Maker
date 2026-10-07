import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Undo2, Redo2, Sun, Moon, Trash2, Download,
  Share2, FileImage, Image as ImageIcon,
  RefreshCcw, Menu, FolderOpen, Save, Upload,
  ChevronDown, FileCode, Maximize, FileText, Package, Smartphone,
  Plus, BookOpen,
} from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { useProjects } from '../store/projectsStore'
import { canShareImage } from '../lib/exportImage'
import { clearPersisted } from '../lib/persistence'
import { useT } from '../i18n/useLang'
import { useTheme } from '../i18n/useTheme'
import { useLang } from '../i18n/useLang'
import { LangDropdown } from './LangSwitcher'
import { IconButton } from './ui'
import ProjectManager from './ProjectManager'
import { ActionSheet, ActionItem, ActionDivider, ActionCancel } from './ActionSheet'
import { m, AnimatePresence } from './motion'
import { useToasts } from './ToastContainer'
import { FullScreenButton } from './FullScreen'
import { useInstall } from '../lib/pwaInstall'

/**
 * `share` / `png` / `jpg` cover the whole project — every page. The `-page`
 * variants are the deliberate "just the one I am looking at" escape hatch, and
 * only appear in the menu when there is more than one page.
 */
export type ExportKind =
  | 'png'
  | 'jpg'
  | 'share'
  | 'share-page'
  | 'png-page'
  | 'svg'
  | 'pdf'
  | 'book'
  | 'batch'

/**
 * The app mark — the same photo-stack as public/favicon.svg, simplified for
 * header sizes (no soft-shadow plates, which vanish below ~32px anyway).
 * Keep it in step with favicon.svg and scripts/generate-icons.mjs.
 */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="brand-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset=".55" stopColor="#a855f7" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <clipPath id="brand-shot">
          <rect x="187" y="173" width="198" height="198" rx="16" />
        </clipPath>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#brand-tile)" />
      <g transform="rotate(-12 222 246)">
        <rect x="117" y="141" width="210" height="210" rx="26" fill="#fff" opacity=".5" />
      </g>
      <g transform="rotate(9 286 272)">
        <rect x="167" y="153" width="238" height="238" rx="30" fill="#fff" />
        <g clipPath="url(#brand-shot)">
          <rect x="187" y="173" width="198" height="198" fill="#eef2ff" />
          <circle cx="240" cy="228" r="25" fill="#fbbf24" />
          <path d="M187 371 V330 L245 262 L282 300 L312 258 L385 330 V371 Z" fill="#6ee7b7" />
          <path d="M187 371 V352 L268 300 L385 352 V371 Z" fill="#10b981" />
        </g>
      </g>
    </svg>
  )
}

export function HeaderBar({
  onExport,
  onExportSVG,
  onInstall,
}: {
  onExport: (kind: ExportKind) => void
  onExportSVG?: () => void
  onInstall?: () => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [projectManagerOpen, setProjectManagerOpen] = useState(false)
  const t = useT()
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)
  const clearAll = useEditor((s) => s.clearAll)
  const hasElements = useEditor((s) => s.elements.length > 0)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const theme = useTheme((s) => s.theme)
  const toggleTheme = useTheme((s) => s.toggleTheme)
  // Name the mode the button switches *to*, matching the icon it shows.
  const themeLabel = t(theme === 'dark' ? 'header.dayMode' : 'header.nightMode')
  const activeProjectId = useProjects((s) => s.activeProjectId)
  // The plain Share / Download entries cover the whole project, so the
  // single-page ones only earn their space when there is more than one page.
  const multiPage = useProjects((s) => s.pages.length) > 1
  const saveActiveProject = useProjects((s) => s.saveActiveProject)
  const toast = useToasts()
  // Hidden once installed, and on browsers with no install route at all
  // (Firefox), where an entry point would only lead nowhere.
  const canInstall = useInstall((s) => !s.standalone && s.platform !== 'unsupported')

  const handleSaveAsFile = async () => {
    const { packProject } = await import('../lib/projectFile')
    const doc = {
      boardWidth: useEditor.getState().boardWidth,
      boardHeight: useEditor.getState().boardHeight,
      background: useEditor.getState().background,
      mode: useEditor.getState().mode,
      gridId: useEditor.getState().gridId,
      gridGap: useEditor.getState().gridGap,
      gridRadius: useEditor.getState().gridRadius,
      frame: useEditor.getState().frame,
      elements: useEditor.getState().elements,
    }
    const blob = await packProject(activeProjectId ? 'Project' : 'Collage', doc)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `collage-${Date.now()}.piccollage`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(t('toast.projectSavedFile'))
  }

  const handleOpenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { unpackProject } = await import('../lib/projectFile')
      const { doc } = await unpackProject(file)
      useEditor.getState().loadDocument(doc)
      e.target.value = ''
      toast.success(t('toast.projectOpened'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.loadImage'))
      e.target.value = ''
    }
  }

  const handleExport = async (kind: ExportKind) => {
    setExportOpen(false)
    onExport(kind)
  }

  const handleBatchExport = async () => {
    const { batchExport } = await import('../lib/batchExport')
    const s = useEditor.getState()
    const elements = s.elements.filter((e) => e.type === 'photo')
    if (!elements.length) {
      toast.info(t('toast.noPhotosExport'))
      return
    }
    const files: { name: string; dataUrl: string }[] = []
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]
      const dataUrl = el.src
      if (dataUrl && dataUrl.startsWith('data:')) {
        files.push({ name: `photo-${i + 1}.png`, dataUrl })
      } else if (dataUrl && dataUrl.startsWith('blob:')) {
        // Convert blob URL to data URL
        try {
          const res = await fetch(dataUrl)
          const blob = await res.blob()
          const reader = new FileReader()
          const dataUrlPromise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          const durl = await dataUrlPromise
          files.push({ name: `photo-${i + 1}.png`, dataUrl: durl })
        } catch { /* skip */ }
      }
    }
    if (!files.length) {
      toast.info(t('toast.noExportablePhotos'))
      return
    }
    const zip = await batchExport(files)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(zip)
    a.download = `collage-batch-${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(t('toast.batchExportDone'))
  }

  /*
   * There is deliberately no Facebook button. `sharer.php?u=` can only post a
   * *link*, never an image, and on a phone it deep-links into the Facebook app
   * — which usually just lands on the feed. A tester reported it as "opens
   * Facebook and nothing more", which is exactly what it does. The system share
   * sheet plus the Save fallback covers the real need honestly.
   */

  const handleRefresh = async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    window.location.reload()
  }

  const handleNew = () => {
    if (hasElements && window.confirm(t('header.clearConfirm'))) {
      clearAll()
      void clearPersisted()
      toast.info(t('toast.canvasCleared'))
    }
  }

  const handleSave = async () => {
    if (activeProjectId) {
      await saveActiveProject()
      toast.success(t('project.saved'))
    } else {
      setProjectManagerOpen(true)
    }
  }

  const accentBtn =
    'bg-grad-accent flex min-h-[36px] sm:min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-[var(--shadow-accent)] transition hover:brightness-110 active:scale-95 cursor-pointer'

  return (
    <>
      {/* `relative z-50` is load-bearing: backdrop-blur makes this header its own
          stacking context, so without it the absolutely-positioned Export
          dropdown paints *below* the canvas area that follows it in the DOM and
          becomes invisible on desktop. */}
      <header className="relative z-50 flex items-center justify-between gap-2 border-b border-border/60 bg-surface/80 px-3 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-xl select-none">
        {/* Brand */}
        <h1 className="flex items-center gap-2 shrink-0 min-w-0">
          <BrandMark className="h-8 w-8 shrink-0 rounded-xl shadow-[var(--shadow-accent)]" />
          <span className="text-grad-accent hidden sm:inline text-sm font-bold truncate">
            Pic Collage
          </span>
        </h1>

        {/* Desktop Actions */}
        <div className="hidden sm:flex items-center gap-1">
          <IconButton onClick={undo} disabled={!canUndo} label={t('header.undo')}>
            <Undo2 size={18} />
          </IconButton>
          <IconButton onClick={redo} disabled={!canRedo} label={t('header.redo')}>
            <Redo2 size={18} />
          </IconButton>
          <span className="mx-0.5 h-6 w-px bg-border" />
          <IconButton onClick={toggleTheme} label={themeLabel}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
          <LangDropdown />
          {canInstall && onInstall && (
            <IconButton onClick={onInstall} label={t('install.menu')}>
              <Smartphone size={18} />
            </IconButton>
          )}
          <FullScreenButton />
          <span className="mx-0.5 h-6 w-px bg-border" />
          <IconButton onClick={() => setProjectManagerOpen(true)} label={t('header.projects')}>
            <FolderOpen size={18} />
          </IconButton>
          <IconButton onClick={handleSave} label={t('project.save')}>
            <Save size={18} />
          </IconButton>
          <IconButton onClick={handleNew} disabled={!hasElements} label={t('header.new')}>
            <Trash2 size={18} />
          </IconButton>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Export dropdown (desktop) */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setExportOpen((v) => !v)}
              className={accentBtn}
              aria-expanded={exportOpen}
              aria-haspopup="menu"
            >
              <Download size={16} strokeWidth={2.5} />
              <span>{t('header.export')}</span>
              <ChevronDown size={14} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {exportOpen && (
                <>
                  <m.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface-2 shadow-2xl"
                    role="menu"
                  >
                    {canShareImage() && (
                      <MenuItem onClick={() => handleExport('share')} icon={<Share2 size={16} />}>
                        {t('export.share')}
                      </MenuItem>
                    )}
                    <MenuItem onClick={() => handleExport('png')} icon={<ImageIcon size={16} />}>
                      {t('export.png')}
                    </MenuItem>
                    <MenuItem onClick={() => handleExport('jpg')} icon={<FileImage size={16} />}>
                      {t('export.jpg')}
                    </MenuItem>
                    <MenuItem onClick={() => { setExportOpen(false); onExportSVG?.() }} icon={<FileCode size={16} />}>
                      {t('export.svg')}
                    </MenuItem>
                    <MenuItem onClick={() => handleExport('pdf')} icon={<FileText size={16} />}>
                      {t('export.pdf')}
                    </MenuItem>
                    <MenuItem onClick={() => handleExport('book')} icon={<BookOpen size={16} />}>
                      {t('export.book')}
                    </MenuItem>
                    {multiPage && (
                      <>
                        <div className="mx-3 my-1 h-px bg-border" />
                        {canShareImage() && (
                          <MenuItem
                            onClick={() => handleExport('share-page')}
                            icon={<Share2 size={16} />}
                          >
                            {t('export.sharePage')}
                          </MenuItem>
                        )}
                        <MenuItem
                          onClick={() => handleExport('png-page')}
                          icon={<ImageIcon size={16} />}
                        >
                          {t('export.pngPage')}
                        </MenuItem>
                      </>
                    )}
                    <MenuItem onClick={() => { setExportOpen(false); handleBatchExport() }} icon={<Package size={16} />}>
                      {t('export.batch')}
                    </MenuItem>
                    <div className="mx-3 my-1 h-px bg-border" />
                    <MenuItem onClick={handleSaveAsFile} icon={<Upload size={16} />}>
                      {t('export.saveProject')}
                    </MenuItem>
                    <label className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left text-sm text-text/90 transition hover:bg-surface-3">
                      <Upload size={16} className="text-muted" />
                      <span>{t('export.openProject')}</span>
                      <input
                        type="file"
                        accept=".piccollage,application/json"
                        onChange={handleOpenFile}
                        className="sr-only"
                      />
                    </label>
                  </m.div>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-30" aria-hidden="true" onClick={() => setExportOpen(false)} />
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setSheetOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-text/80 transition hover:bg-surface-3 active:scale-95 sm:hidden"
            aria-label={t('menu.more')}
            title={t('menu.more')}
          >
            <Menu size={18} strokeWidth={2.5} />
          </button>

          {/* Mobile share — the action most testers reach for, and it was
              buried in a 20-row menu. Only useful where Web Share exists. */}
          {canShareImage() && (
            <button
              onClick={() => handleExport('share')}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-text/80 transition hover:bg-surface-3 active:scale-95 sm:hidden"
              aria-label={t('export.share')}
              title={t('export.share')}
            >
              <Share2 size={18} strokeWidth={2.5} />
            </button>
          )}

          {/* Mobile export (compact icon-only) */}
          <button
            onClick={() => handleExport('png')}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white shadow transition hover:brightness-110 active:scale-95 sm:hidden"
            aria-label={t('header.export')}
          >
            <Download size={16} strokeWidth={2.5} />
          </button>

          {/* Refresh — desktop only */}
          <button onClick={handleRefresh} className="hidden sm:flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-text/80 transition hover:bg-surface-3 active:scale-95" aria-label={t('header.refresh')} title={t('header.refresh')}>
            <RefreshCcw size={16} strokeWidth={2.5} />
            <span>{t('header.refresh')}</span>
          </button>
          {/* New Canvas button (desktop) */}
          <button onClick={handleNew} className="hidden sm:flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-text/80 transition hover:bg-surface-3 active:scale-95" aria-label={t('header.newCanvas')} title={t('header.newCanvas')}>
            <Plus size={16} strokeWidth={2.5} />
            <span>{t('header.newCanvas')}</span>
          </button>
        </div>
      </header>

      {/* Mobile Action Sheet */}
      <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('menu.more')}>
        <ActionItem
          onClick={() => { setSheetOpen(false); undo() }}
          icon={<Undo2 size={18} />}
          label={t('header.undo')}
          disabled={!canUndo}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); redo() }}
          icon={<Redo2 size={18} />}
          label={t('header.redo')}
          disabled={!canRedo}
        />
        <ActionDivider />
        <ActionItem
          onClick={() => { setSheetOpen(false); toggleTheme() }}
          icon={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          label={themeLabel}
        />
        {canInstall && onInstall && (
          <ActionItem
            onClick={() => { setSheetOpen(false); onInstall() }}
            icon={<Smartphone size={18} />}
            label={t('install.menu')}
          />
        )}
        <ActionItem
          onClick={() => { setSheetOpen(false); document.documentElement.requestFullscreen().catch(() => {}) }}
          icon={<Maximize size={18} />}
          label={t('fullscreen.enter')}
        />
        <ActionDivider />
        <ActionItem
          onClick={() => { setSheetOpen(false); setLang('de') }}
          icon={<span className="text-lg">🇩🇪</span>}
          label={t('lang.de')}
          active={lang === 'de'}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); setLang('en') }}
          icon={<span className="text-lg">🇬🇧</span>}
          label={t('lang.en')}
          active={lang === 'en'}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); setLang('es') }}
          icon={<span className="text-lg">🇪🇸</span>}
          label={t('lang.es')}
          active={lang === 'es'}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); setLang('fr') }}
          icon={<span className="text-lg">🇫🇷</span>}
          label={t('lang.fr')}
          active={lang === 'fr'}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); setLang('it') }}
          icon={<span className="text-lg">🇮🇹</span>}
          label={t('lang.it')}
          active={lang === 'it'}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); setLang('pt') }}
          icon={<span className="text-lg">🇧🇷</span>}
          label={t('lang.pt')}
          active={lang === 'pt'}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); setProjectManagerOpen(true) }}
          icon={<FolderOpen size={18} />}
          label={t('header.projects')}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); handleSave() }}
          icon={<Save size={18} />}
          label={t('project.save')}
        />
        <ActionDivider />
        <ActionItem
          onClick={() => { setSheetOpen(false); handleNew() }}
          icon={<Trash2 size={18} />}
          label={t('header.new')}
          disabled={!hasElements}
          danger
        />
        <ActionDivider />
        {/* Share lives in the top bar on mobile; no row for it here. */}
        <ActionItem
          onClick={() => { setSheetOpen(false); handleExport('png') }}
          icon={<ImageIcon size={18} />}
          label={t('export.png')}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); handleExport('jpg') }}
          icon={<FileImage size={18} />}
          label={t('export.jpg')}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); onExportSVG?.() }}
          icon={<FileCode size={18} />}
          label={t('export.svg')}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); handleExport('pdf') }}
          icon={<FileText size={18} />}
          label={t('export.pdf')}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); handleExport('book') }}
          icon={<BookOpen size={18} />}
          label={t('export.book')}
        />
        {multiPage && (
          <ActionItem
            onClick={() => { setSheetOpen(false); handleExport('share-page') }}
            icon={<Share2 size={18} />}
            label={t('export.sharePage')}
          />
        )}
        <ActionItem
          onClick={() => { setSheetOpen(false); handleBatchExport() }}
          icon={<Package size={18} />}
          label={t('export.batch')}
        />
        <ActionItem
          onClick={() => { setSheetOpen(false); handleSaveAsFile() }}
          icon={<Upload size={18} />}
          label={t('export.saveProject')}
        />
        <label className="flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-text transition hover:bg-surface-3 active:scale-[0.98]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-muted">
            <Upload size={18} />
          </span>
          <span>{t('export.openProject')}</span>
          <input
            type="file"
            accept=".piccollage,application/json"
            onChange={(e) => { setSheetOpen(false); handleOpenFile(e) }}
            className="sr-only"
          />
        </label>

        <ActionCancel onClick={() => setSheetOpen(false)} label={t('menu.cancel')} />
      </ActionSheet>

      <ProjectManager open={projectManagerOpen} onClose={() => setProjectManagerOpen(false)} />
    </>
  )
}

function MenuItem({
  onClick,
  children,
  icon,
  disabled,
}: {
  onClick?: () => void
  children: ReactNode
  icon?: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
      className={`flex min-h-[44px] w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-text/90 transition hover:bg-surface-3 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {icon && <span className="text-muted">{icon}</span>}
      {children}
    </button>
  )
}
