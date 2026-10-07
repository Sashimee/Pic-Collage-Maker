import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import type { EditorHandle } from './components/EditorCanvas'
import type { CanvasElement } from './types'

/*
 * The canvas is deferred, not because it is optional but because it is
 * expensive: react-konva pulls in Konva, the single largest chunk, and the
 * first thing a user sees is the layout gallery — plain DOM that needs none of
 * it. Loading it eagerly put ~2s of script evaluation on the critical path and
 * was the main contributor to Lighthouse's 1.1s total blocking time.
 */
const EditorCanvas = lazy(() =>
  import('./components/EditorCanvas').then((m) => ({ default: m.EditorCanvas })),
)
// Also react-konva, and only on screen while cropping.
const CropOverlay = lazy(() =>
  import('./components/CropOverlay').then((m) => ({ default: m.CropOverlay })),
)
import { HeaderBar, type ExportKind } from './components/HeaderBar'
import { SelectionBar } from './components/SelectionBar'
import { MobileSheet, MobileTabBar, ToolRail, SidePanel } from './components/Docks'
import { EmptyState } from './components/EmptyState'
import { usePanels } from './components/panels.config'
import { MotionProvider } from './components/motion'
import { useIsDesktop } from './hooks/useMediaQuery'
import { useVersionCheck } from './hooks/useVersionCheck'
import { useMemoryPressure } from './hooks/useMemoryPressure'
import { useShortcuts } from './hooks/useShortcuts'
import { UpdateBanner } from './components/UpdateBanner'
import { ZoomControls } from './components/ZoomControls'
import { StatusBar } from './components/StatusBar'
import { PageStrip } from './components/PageStrip'
const PhotoBookSheet = lazy(() =>
  import('./components/PhotoBookSheet').then((m) => ({ default: m.PhotoBookSheet })),
)
import { useEditor, type LoadedDocument } from './store/editorStore'
import { useT } from './i18n/useLang'
import { useProjects, defaultProjectName } from './store/projectsStore'
import { useWorkspace } from './store/workspaceStore'
import {
  downloadDataURL,
  shareFileName,
  shareImages,
  type ExportFormat,
} from './lib/exportImage'
import { exportSVG, downloadSVG } from './lib/exportSVG'
import { fireConfetti } from './lib/confetti'
import { track } from './lib/analytics'
import { InstallSheet } from './components/InstallSheet'
import { useInstall } from './lib/pwaInstall'
import { ToastContainer, useToasts } from './components/ToastContainer'
import { OnboardingOverlay } from './components/Onboarding'
import { restoreCustomFonts } from './lib/fonts'
import { extractFirstExif, injectExifIntoJpeg } from './lib/exifHelpers'
import { loadDoc, saveDoc, type StoredDoc } from './lib/persistence'
import { hasCrashed } from './lib/crashState'
import {
  rehydrateBackground,
  rehydratePhotos,
  stripBackgroundUrl,
  stripPhotoUrls,
} from './lib/photoRehydrate'

const INSTALL_NUDGE_KEY = 'pic-collage-install-nudged'

/** True at most once ever, and never when installing is impossible or done. */
function shouldNudgeInstall(): boolean {
  const { standalone, platform } = useInstall.getState()
  if (standalone || platform === 'unsupported') return false
  try {
    if (localStorage.getItem(INSTALL_NUDGE_KEY)) return false
    localStorage.setItem(INSTALL_NUDGE_KEY, '1')
  } catch {
    return false
  }
  return true
}

const nextFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )

// Build the persistable snapshot: photo blobs live in IndexedDB by photoId, so
// the JSON keeps only the id (object URLs are transient and must not be saved).
function toStoredDoc(): StoredDoc {
  const s = useEditor.getState()
  return {
    boardWidth: s.boardWidth,
    boardHeight: s.boardHeight,
    background: stripBackgroundUrl(s.background),
    mode: s.mode,
    gridId: s.gridId,
    gridGap: s.gridGap,
    gridRadius: s.gridRadius,
    gridMargin: s.gridMargin,
    frame: s.frame,
    watermark: s.watermark,
    print: s.print,
    elements: stripPhotoUrls(s.elements),
  }
}

export default function App() {
  const editorRef = useRef<EditorHandle>(null)
  const measure = (ids: string[]) => editorRef.current?.measure(ids) ?? {}
  const [installOpen, setInstallOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [bookPages, setBookPages] = useState<LoadedDocument[]>([])
  const select = useEditor((s) => s.select)
  const loadDocument = useEditor((s) => s.loadDocument)
  const [hydrated, setHydrated] = useState(false)
  const isDesktop = useIsDesktop()
  // Desktop keeps the docked side panel populated; mobile starts with the
  // sheet closed so the first-run hero isn't covered.
  const activeWorkspaceTab = useWorkspace((s) => s.activeTab)
  const panelSizes = useWorkspace((s) => s.panelSizes)
  const isDesktopInitial = isDesktop ? (activeWorkspaceTab ?? 'photos') : null
  const panels = usePanels(isDesktopInitial)
  const sidePanelWidth = panelSizes['side'] ?? 336
  const t = useT()
  const toast = useToasts()

  useVersionCheck()
  useMemoryPressure()

  // Restore custom fonts on startup
  useEffect(() => {
    restoreCustomFonts().catch(() => { /* ignore font errors */ })
  }, [])

  // Restore persisted work on startup: rebuild object URLs from stored blobs
  // (one URL per photoId, so duplicates keep sharing a src). Photos whose blob
  // is missing are dropped.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const stored = await loadDoc()
      if (stored && !cancelled && stored.elements.length) {
        const elements = await rehydratePhotos(stored.elements)
        const background = await rehydrateBackground(stored.background)
        if (!cancelled) loadDocument({ ...stored, elements, background })
      }
      if (!cancelled) setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [loadDocument])

  // Debounced autosave once the initial restore has run.
  useEffect(() => {
    if (!hydrated) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = useEditor.subscribe(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!hasCrashed()) void saveDoc(toStoredDoc())
      }, 500)
    })
    return () => {
      unsub()
      clearTimeout(timer)
    }
  }, [hydrated])

  const activeProjectId = useProjects((s) => s.activeProjectId)
  const saveActiveProject = useProjects((s) => s.saveActiveProject)
  const [_projectManagerOpen, setProjectManagerOpen] = useState(false)

  const handleSave = async () => {
    if (activeProjectId) {
      await saveActiveProject()
      window.alert(t('project.saved'))
    } else {
      setProjectManagerOpen(true)
    }
  }

  useShortcuts({
    onExport: () => handleExport('png'),
    onSave: handleSave,
    onOpenProject: () => setProjectManagerOpen(true),
  })

  // Release any leftover object URLs when the page is torn down.
  useEffect(() => {
    const cleanup = () => {
      for (const el of useEditor.getState().elements) {
        if (el.type === 'photo') {
          if (el.src?.startsWith('blob:')) URL.revokeObjectURL(el.src)
          if (el.previewSrc?.startsWith('blob:')) URL.revokeObjectURL(el.previewSrc)
          if (el.originalSrc?.startsWith('blob:')) URL.revokeObjectURL(el.originalSrc)
          if (el.thumbSrc?.startsWith('blob:')) URL.revokeObjectURL(el.thumbSrc)
        }
      }
    }
    window.addEventListener('beforeunload', cleanup)
    return () => window.removeEventListener('beforeunload', cleanup)
  }, [])

  /**
   * Persist the current work before an action that hands the user off to
   * another app. The existing debounced autosave only runs once a project
   * exists, so with no active project there is nothing to save into — create
   * one, silently, rather than leaving the work unprotected.
   */
  /** The board on screen as a page document, for a book with no project. */
  const liveDocument = (): LoadedDocument => {
    const s = useEditor.getState()
    return {
      boardWidth: s.boardWidth,
      boardHeight: s.boardHeight,
      background: s.background,
      mode: s.mode,
      gridId: s.gridId,
      gridGap: s.gridGap,
      gridRadius: s.gridRadius,
      gridMargin: s.gridMargin,
      frame: s.frame,
      elements: s.elements,
    }
  }

  const ensureProjectSaved = async () => {
    const projects = useProjects.getState()
    try {
      if (projects.activeProjectId) await projects.saveActiveProject()
      else await projects.createProject(defaultProjectName())
    } catch {
      // Saving is a courtesy here; never let it block the share.
    }
  }

  const handleExport = async (kind: ExportKind) => {
    // Drop the selection so transform handles / grid highlight aren't captured,
    // then wait a frame for the canvas to redraw before snapshotting.
    select(null)
    await nextFrame()
    if (kind === 'svg') {
      // SVG export handled separately via onExportSVG
      return
    }
    if (kind === 'batch') {
      // Handled by HeaderBar's handleBatchExport
      return
    }
    if (kind === 'book') {
      track('export-book')
      // Fold the live page into the page list first — the store's copy of the
      // page being edited lags until a save, so a book built without this
      // would print the last saved version of whatever is on screen.
      await ensureProjectSaved()
      const stored = useProjects.getState().pages
      // With no IndexedDB there is no page list; the board on screen is still
      // a perfectly good one-page book.
      setBookPages(stored.length ? stored : [liveDocument()])
      setBookOpen(true)
      return
    }
    if (kind === 'pdf') {
      track('export-pdf')
      const { exportPDF, downloadPDF } = await import('./lib/exportPDF')
      const url = await editorRef.current?.exportImage('png')
      if (url) {
        const pdf = await exportPDF([{ dataUrl: url }])
        downloadPDF(pdf, `collage-${Date.now()}.pdf`)
        fireConfetti()
        maybeNudgeInstall()
      }
      return
    }
    // Share as JPEG: it is a fraction of the size and Android share targets
    // accept it far more reliably — several reject a large PNG outright.
    const format: ExportFormat =
      kind === 'jpg' || kind === 'share' || kind === 'share-page' ? 'jpg' : 'png'
    const sharing = kind === 'share' || kind === 'share-page'
    const wholeProject = kind === 'share' || kind === 'png' || kind === 'jpg'
    // Sharing takes the user out of the app, so get their work on disk first.
    // It also folds the live page into the page list, which is what makes the
    // other pages readable below.
    if (sharing) await ensureProjectSaved()

    const urls = wholeProject
      ? await renderAllPages(format)
      : await oneUrl(await editorRef.current?.exportImage(format), format)

    if (urls.length) {
      track(sharing ? 'export-share' : `export-${format}`)
      if (sharing) {
        const outcome = await shareImages(urls, format, t('share.title'), t('share.text'))
        // Cancelling is a decision, not a failure: no file, no confetti, no
        // toast. Downloading anyway is what put an unwanted "open in Preview"
        // sheet in front of testers who had changed their mind.
        if (outcome === 'cancelled') {
          track('share-cancelled')
          return
        }
        if (outcome === 'unsupported') {
          // Including "this target will not take five files at once" — save
          // them all rather than quietly sharing one.
          saveAll(urls, format)
        } else {
          // `navigator.share()` resolving only means the target *accepted* the
          // intent. Facebook accepts it and then opens its composer without the
          // file, so a resolved share is no guarantee the picture went
          // anywhere. Leave the user a one-tap way to keep it.
          const saved = urls
          toast.action(t('share.maybeFailed'), {
            label: t('share.saveInstead'),
            onClick: () => saveAll(saved, format),
          })
        }
      } else {
        saveAll(urls, format)
      }
      // Celebrate the outcome, not the button press.
      fireConfetti()
      maybeNudgeInstall()
    }
  }

  /** EXIF is only meaningful on JPEG, and only from that page's own photos. */
  const withExif = async (url: string, format: ExportFormat, elements: CanvasElement[]) => {
    if (format !== 'jpg') return url
    const exif = await extractFirstExif(elements)
    return exif ? injectExifIntoJpeg(url, exif) : url
  }

  const oneUrl = async (url: string | null | undefined, format: ExportFormat) =>
    url ? [await withExif(url, format, useEditor.getState().elements)] : []

  /**
   * Every page of the project as a bitmap.
   *
   * The single live Konva stage can only ever draw the page you are looking at,
   * which is why sharing a multi-page project used to send one image. The
   * off-screen renderer draws the rest without disturbing the editor.
   */
  const renderAllPages = async (format: ExportFormat): Promise<string[]> => {
    const pages = pagesForExport()
    // One page is the overwhelmingly common case, and the live stage is already
    // rendered — no reason to spin up a second one for it.
    if (pages.length <= 1) return oneUrl(await editorRef.current?.exportImage(format), format)

    const progress = toast.progress(`${t('export.rendering')} 1/${pages.length}`)
    try {
      const { renderPages } = await import('./lib/renderPages')
      const editor = useEditor.getState()
      const urls = await renderPages(pages, {
        // The same resolution the single-page export produces.
        pixelRatio: 2,
        format: format === 'png' ? 'png' : 'jpeg',
        watermark: editor.watermark,
        print: editor.print,
        onProgress: (done, total) =>
          progress.update(`${t('export.rendering')} ${Math.min(done + 1, total)}/${total}`),
      })
      return Promise.all(urls.map((url, i) => withExif(url, format, pages[i].elements)))
    } finally {
      progress.done()
    }
  }

  /** Save one file per page, numbered when there is more than one. */
  const saveAll = (urls: string[], format: ExportFormat) => {
    urls.forEach((url, i) => {
      const name = shareFileName(format, i, urls.length)
      // Browsers throttle (and prompt about) a burst of downloads; give each
      // one its own tick so they are not treated as one runaway page.
      if (i === 0) downloadDataURL(url, format, name)
      else setTimeout(() => downloadDataURL(url, format, name), i * 350)
    })
  }

  /**
   * The pages to export. `ensureProjectSaved()` has folded the live document
   * into the list by this point; with no list at all — private mode, where the
   * project cannot be written — the board on screen is still one good page.
   */
  const pagesForExport = (): LoadedDocument[] => {
    const stored = useProjects.getState().pages
    return stored.length ? stored : [liveDocument()]
  }

  // Let the confetti and the download land before asking for anything.
  const maybeNudgeInstall = () => {
    if (!shouldNudgeInstall()) return
    setTimeout(() => {
      track('install-shown')
      setInstallOpen(true)
    }, 1400)
  }

  const handleExportSVG = () => {
    track('export-svg')
    select(null)
    const s = useEditor.getState()
    const svg = exportSVG(s.elements, s.boardWidth, s.boardHeight, s.background)
    downloadSVG(svg)
  }

  return (
    <MotionProvider>
      <div className="flex h-full flex-col bg-surface text-text">
        <HeaderBar
          onExport={handleExport}
          onExportSVG={handleExportSVG}
          onInstall={() => {
            track('install-shown')
            setInstallOpen(true)
          }}
        />
        {isDesktop ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1">
              <ToolRail panels={panels} />
              <div className="relative min-h-0 flex-1 overflow-hidden bg-bg">
                {/* Subtle dot grid on empty canvas */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage: 'radial-gradient(circle, var(--text) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <Suspense fallback={null}>
                  <EditorCanvas ref={editorRef} />
                </Suspense>
                <SelectionBar measure={measure} />
                <EmptyState />
                <Suspense fallback={null}><CropOverlay /></Suspense>
                <ZoomControls />
              </div>
              <SidePanel panels={panels} width={sidePanelWidth} />
            </div>
            <PageStrip />
            <StatusBar />
          </div>
        ) : (
          <>
            {/* Mobile: canvas area with insets for header overlay + bottom controls */}
            <div className="relative min-h-0 flex-1 overflow-hidden bg-bg">
              {/* Subtle dot grid on empty canvas */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: 'radial-gradient(circle, var(--text) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              {/* The sheet overlays the stage at 46% of this box (BottomSheet's
                  collapsed snap point) with no scrim, so tell the canvas to fit
                  the board above it. Dragging it up to 86% is left alone — that
                  is a deliberate "show me more panel" gesture. */}
              <Suspense fallback={null}>
                <EditorCanvas ref={editorRef} bottomInset={panels.current ? 0.46 : 0} />
              </Suspense>
              <SelectionBar measure={measure} />
              <EmptyState />
              <MobileSheet panels={panels} />
              <Suspense fallback={null}><CropOverlay /></Suspense>
              <ZoomControls />
            </div>
            <PageStrip />
            <MobileTabBar panels={panels} />
          </>
        )}
        <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
        {bookOpen && (
          <Suspense fallback={null}>
            <PhotoBookSheet
              open={bookOpen}
              pages={bookPages}
              onClose={() => setBookOpen(false)}
              onDone={async (pdf) => {
                const { downloadPDF } = await import('./lib/exportPDF')
                downloadPDF(pdf, `photo-book-${Date.now()}.pdf`)
                setBookOpen(false)
                fireConfetti()
                maybeNudgeInstall()
              }}
            />
          </Suspense>
        )}
        <UpdateBanner />
        <ToastContainer />
        <OnboardingOverlay />
      </div>
    </MotionProvider>
  )
}
