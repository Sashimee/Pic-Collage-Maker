import { lazy, Suspense, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Undo2, Redo2, Sun, Moon, Trash2, Download,
  Share2, FileImage, Image as ImageIcon,
  RefreshCcw, Menu, FolderOpen, Save, Upload,
  ChevronDown, FileCode, FileText, Package, Smartphone,
  Plus, BookOpen, Proportions,
} from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { useProjects } from '../store/projectsStore'
import { canShareImage } from '../lib/exportImage'
import { clearPersisted } from '../lib/persistence'
import { useT } from '../i18n/useLang'
import { useTheme } from '../i18n/useTheme'
import { LangDropdown } from './LangSwitcher'
import { IconButton } from './ui'
import ProjectManager from './ProjectManager'
import { m, AnimatePresence } from './motion'
import { useToasts } from './ToastContainer'
import { FullScreenButton } from './FullScreen'
import { useInstall } from '../lib/pwaInstall'
import { BrandMark } from './header/BrandMark'
import { MobileMenu } from './header/MobileMenu'
import { useProjectFileActions } from './header/useProjectFileActions'
import { ActionSheet } from './ActionSheet'

const SizePresets = lazy(() =>
  import('./SizePresets').then((mod) => ({ default: mod.SizePresets })),
)

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
  const [sizesOpen, setSizesOpen] = useState(false)
  const exportButton = useRef<HTMLButtonElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)
  const closeSizes = () => {
    setSizesOpen(false)
    // The menu item that opened the sheet is gone; hand focus to whichever trigger is on screen.
    const trigger = exportButton.current?.offsetParent ? exportButton : moreButton
    trigger.current?.focus()
  }
  const t = useT()
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
  const closeProject = useProjects((s) => s.closeProject)
  const toast = useToasts()
  // Hidden once installed, and on browsers with no install route at all
  // (Firefox), where an entry point would only lead nowhere.
  const canInstall = useInstall((s) => !s.standalone && s.platform !== 'unsupported')
  const { handleSaveAsFile, handleOpenFile, handleBatchExport } = useProjectFileActions()

  const handleExport = async (kind: ExportKind) => {
    setExportOpen(false)
    onExport(kind)
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

  // A second New while the first awaits its save would clear the canvas before that save reads it.
  const clearing = useRef(false)
  const handleNew = async () => {
    if (clearing.current) return
    if (hasElements && window.confirm(t('header.clearConfirm'))) {
      clearing.current = true
      try {
        // Still attached, the project autosave would write the blank canvas over the open project.
        await closeProject()
      } catch (err) {
        console.error('Saving the project before New failed', err)
        toast.error(t('project.saveFailed'))
        return
      } finally {
        clearing.current = false
      }
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
              ref={exportButton}
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
                    <MenuItem onClick={() => { setExportOpen(false); setSizesOpen(true) }} icon={<Proportions size={16} />}>
                      {t('preset.resizeFor')}
                    </MenuItem>
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
            ref={moreButton}
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
      <MobileMenu
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onExport={handleExport}
        onExportSVG={onExportSVG}
        onInstall={onInstall}
        onOpenProjects={() => setProjectManagerOpen(true)}
        onSave={handleSave}
        onNew={handleNew}
        onBatchExport={handleBatchExport}
        onSaveAsFile={handleSaveAsFile}
        onOpenFile={handleOpenFile}
        onResize={() => setSizesOpen(true)}
      />

      <ActionSheet open={sizesOpen} title={t('preset.resizeFor')} onClose={closeSizes}>
        <Suspense fallback={<p className="min-h-[44px] px-4 text-sm text-muted">{t('common.loading')}</p>}>
          <div className="px-4 pb-4">
            <SizePresets autoFocus onPick={closeSizes} />
          </div>
        </Suspense>
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
