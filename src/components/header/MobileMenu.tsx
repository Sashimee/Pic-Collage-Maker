import {
  Undo2, Redo2, Sun, Moon, Trash2,
  Share2, FileImage, Image as ImageIcon,
  FolderOpen, Save, Upload,
  FileCode, Maximize, FileText, Package, Smartphone,
  BookOpen, Proportions, Copy, ShieldCheck,
} from 'lucide-react'
import { useRef } from 'react'
import { useEditor } from '../../store/editorStore'
import { useProjects } from '../../store/projectsStore'
import { useT, useLang } from '../../i18n/useLang'
import { useTheme } from '../../i18n/useTheme'
import { useInstall } from '../../lib/pwaInstall'
import { canPickFiles, useLinkedFileName } from '../../lib/linkedFile'
import { ActionSheet, ActionItem, ActionDivider, ActionCancel } from '../ActionSheet'
import type { ExportKind } from '../HeaderBar'
import { canCopyImage } from '../../lib/exportImage'

interface Props {
  open: boolean
  onClose: () => void
  onExport: (kind: ExportKind) => void
  onExportSVG?: () => void
  onInstall?: () => void
  onOpenProjects: () => void
  onSave: () => void
  onNew: () => void
  onBatchExport: () => void
  onSaveAsFile: () => void
  onSaveAsNewFile: () => void
  onOpenFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPickFile: () => void
  onResize: () => void
}

/** The mobile "more" sheet: history, theme, language, projects and export. */
export function MobileMenu({
  open,
  onClose,
  onExport,
  onExportSVG,
  onInstall,
  onOpenProjects,
  onSave,
  onNew,
  onBatchExport,
  onSaveAsFile,
  onSaveAsNewFile,
  onOpenFile,
  onPickFile,
  onResize,
}: Props) {
  const t = useT()
  const linkedName = useLinkedFileName()
  const openInput = useRef<HTMLInputElement>(null)
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)
  const hasElements = useEditor((s) => s.elements.length > 0)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const theme = useTheme((s) => s.theme)
  const toggleTheme = useTheme((s) => s.toggleTheme)
  const themeLabel = t(theme === 'dark' ? 'header.dayMode' : 'header.nightMode')
  const multiPage = useProjects((s) => s.pages.length) > 1
  const canInstall = useInstall((s) => !s.standalone && s.platform !== 'unsupported')

  return (
    <ActionSheet open={open} onClose={onClose} title={t('menu.more')}>
      <ActionItem
        onClick={() => { onClose(); undo() }}
        icon={<Undo2 size={18} />}
        label={t('header.undo')}
        disabled={!canUndo}
      />
      <ActionItem
        onClick={() => { onClose(); redo() }}
        icon={<Redo2 size={18} />}
        label={t('header.redo')}
        disabled={!canRedo}
      />
      <ActionDivider />
      <ActionItem
        onClick={() => { onClose(); toggleTheme() }}
        icon={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        label={themeLabel}
      />
      {canInstall && onInstall && (
        <ActionItem
          onClick={() => { onClose(); onInstall() }}
          icon={<Smartphone size={18} />}
          label={t('install.menu')}
        />
      )}
      <ActionItem
        onClick={() => { onClose(); document.documentElement.requestFullscreen().catch(() => {}) }}
        icon={<Maximize size={18} />}
        label={t('fullscreen.enter')}
      />
      <ActionDivider />
      <ActionItem
        onClick={() => { onClose(); setLang('de') }}
        icon={<span className="text-lg">🇩🇪</span>}
        label={t('lang.de')}
        active={lang === 'de'}
      />
      <ActionItem
        onClick={() => { onClose(); setLang('en') }}
        icon={<span className="text-lg">🇬🇧</span>}
        label={t('lang.en')}
        active={lang === 'en'}
      />
      <ActionItem
        onClick={() => { onClose(); setLang('es') }}
        icon={<span className="text-lg">🇪🇸</span>}
        label={t('lang.es')}
        active={lang === 'es'}
      />
      <ActionItem
        onClick={() => { onClose(); setLang('fr') }}
        icon={<span className="text-lg">🇫🇷</span>}
        label={t('lang.fr')}
        active={lang === 'fr'}
      />
      <ActionItem
        onClick={() => { onClose(); setLang('it') }}
        icon={<span className="text-lg">🇮🇹</span>}
        label={t('lang.it')}
        active={lang === 'it'}
      />
      <ActionItem
        onClick={() => { onClose(); setLang('pt') }}
        icon={<span className="text-lg">🇧🇷</span>}
        label={t('lang.pt')}
        active={lang === 'pt'}
      />
      <ActionItem
        onClick={() => { onClose(); onOpenProjects() }}
        icon={<FolderOpen size={18} />}
        label={t('header.projects')}
      />
      <ActionItem
        onClick={() => { onClose(); onSave() }}
        icon={<Save size={18} />}
        label={t('project.save')}
      />
      <ActionDivider />
      <ActionItem
        onClick={() => { onClose(); onNew() }}
        icon={<Trash2 size={18} />}
        label={t('header.new')}
        disabled={!hasElements}
        danger
      />
      <ActionDivider />
      {/* Share lives in the top bar on mobile; no row for it here. */}
      <ActionItem
        onClick={() => { onClose(); onExport('png') }}
        icon={<ImageIcon size={18} />}
        label={t('export.png')}
      />
      <ActionItem
        onClick={() => { onClose(); onExport('jpg') }}
        icon={<FileImage size={18} />}
        label={t('export.jpg')}
      />
      {canCopyImage() && (
        <ActionItem
          onClick={() => { onClose(); onExport('copy') }}
          icon={<Copy size={18} />}
          label={t('export.copy')}
        />
      )}
      <ActionItem
        onClick={() => { onClose(); onExportSVG?.() }}
        icon={<FileCode size={18} />}
        label={t('export.svg')}
      />
      <ActionItem
        onClick={() => { onClose(); onExport('pdf') }}
        icon={<FileText size={18} />}
        label={t('export.pdf')}
      />
      <ActionItem
        onClick={() => { onClose(); onExport('book') }}
        icon={<BookOpen size={18} />}
        label={t('export.book')}
      />
      {multiPage && (
        <ActionItem
          onClick={() => { onClose(); onExport('share-page') }}
          icon={<Share2 size={18} />}
          label={t('export.sharePage')}
        />
      )}
      <ActionItem
        onClick={() => { onClose(); onResize() }}
        icon={<Proportions size={18} />}
        label={t('preset.resizeFor')}
      />
      <ActionItem
        onClick={() => { onClose(); onBatchExport() }}
        icon={<Package size={18} />}
        label={t('export.batch')}
      />
      <ActionItem
        onClick={() => { onClose(); onSaveAsFile() }}
        icon={<Upload size={18} />}
        label={linkedName ? `${t('file.saveTo')} ${linkedName}` : t('export.saveProject')}
      />
      {linkedName && (
        <ActionItem
          onClick={() => { onClose(); onSaveAsNewFile() }}
          icon={<Upload size={18} />}
          label={t('file.saveAsNew')}
        />
      )}
      <ActionItem
        onClick={() => {
          if (canPickFiles()) {
            onClose()
            onPickFile()
          } else openInput.current?.click()
        }}
        icon={<Upload size={18} />}
        label={t('export.openProject')}
      />
      <input
        ref={openInput}
        type="file"
        accept=".piccollage,application/json"
        onChange={(e) => { onClose(); onOpenFile(e) }}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />

      <ActionDivider />
      <ActionItem
        onClick={() => { onClose(); window.open(`${import.meta.env.BASE_URL}privacy.html`, '_blank', 'noopener') }}
        icon={<ShieldCheck size={18} />}
        label={t('header.privacy')}
      />

      <ActionCancel onClick={onClose} label={t('menu.cancel')} />
    </ActionSheet>
  )
}
