import { ImagePlus, Camera } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useEditor } from '../store/editorStore'
import { useT } from '../i18n/useLang'
import { importFiles } from '../lib/importFiles'
import { resolveLayoutById } from '../lib/grids'
import { track } from '../lib/analytics'
import { LayoutGallery } from './LayoutGallery'
import { TemplateGallery } from './TemplateGallery'
import { Section } from './ui'
import { PhotoAssignmentSheet } from './PhotoAssignmentSheet'
import { m, AnimatePresence } from './motion'

const GALLERY_ID = 'empty-gallery-input'
const CAMERA_ID = 'empty-camera-input'

export function EmptyState() {
  const t = useT()
  const isEmpty = useEditor((s) => s.elements.length === 0)
  const mode = useEditor((s) => s.mode)
  const addPhoto = useEditor((s) => s.addPhoto)
  const setMode = useEditor((s) => s.setMode)
  const setCustomLayoutMode = useEditor((s) => s.setCustomLayoutMode)
  const galleryDismissed = useEditor((s) => s.galleryDismissed)
  const setGalleryDismissed = useEditor((s) => s.setGalleryDismissed)
  const applyLayout = useEditor((s) => s.applyLayout)
  // Set by the layout gallery *and* by the custom-layout editor's Apply, so
  // both paths land on the same "fill your zones" sheet.
  const assignLayoutId = useEditor((s) => s.assignLayoutId)
  const setAssignLayoutId = useEditor((s) => s.setAssignLayoutId)
  const [showAssignment, setShowAssignment] = useState(false)

  // resolveLayoutById (not getGridById) so custom layouts saved to
  // localStorage resolve too — their ids are uuids, not preset names.
  const selectedLayout = assignLayoutId ? resolveLayoutById(assignLayoutId) : null

  // Don't show the gallery overlay while drawing a custom layout, or while the
  // photo-assignment sheet is up — it would sit on top of the sheet.
  const showGallery =
    isEmpty && mode !== 'custom-layout' && !galleryDismissed && !assignLayoutId

  // The custom-layout editor's Apply sets `assignLayoutId` from outside this
  // component; open the sheet whenever a layout asks to be filled.
  useEffect(() => {
    if (assignLayoutId) setShowAssignment(true)
  }, [assignLayoutId])

  const handleGalleryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Capture the input before awaiting: adding a photo unmounts this overlay,
    // so `e.currentTarget` is null by the time the promise resolves.
    const input = e.target
    if (input.files && input.files.length > 0) {
      try {
        await importFiles(input.files, addPhoto)
      } catch {
        window.alert(t('error.loadImage'))
      }
    }
    input.value = ''
  }

  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    if (input.files && input.files.length > 0) {
      try {
        await importFiles(input.files, addPhoto)
      } catch {
        window.alert(t('error.loadCamera'))
      }
    }
    input.value = ''
  }

  const handleSelectLayout = (layoutId: string) => {
    track('layout-preset')
    applyLayout(layoutId)
    setAssignLayoutId(layoutId)
    setShowAssignment(true)
  }

  const handleCustomLayout = () => {
    setAssignLayoutId(null)
    setShowAssignment(false)
    // setCustomLayoutMode also resets the drawing to a single full-board zone.
    setCustomLayoutMode(true)
  }

  const handleSkip = () => {
    setMode('free')
    setGalleryDismissed(true)
  }

  const handleAssign = async (files: File[]) => {
    if (files.length > 0) {
      const dataTransfer = new DataTransfer()
      files.forEach((f) => dataTransfer.items.add(f))
      const input = document.createElement('input')
      input.type = 'file'
      input.files = dataTransfer.files
      await importFiles(input.files, addPhoto).catch(() => {
        window.alert(t('error.loadImages'))
      })
    }
    // Sheet stays open so user can fill remaining slots
  }

  const closeAssignment = () => {
    // A layout the user drew themselves shouldn't bounce them back to the
    // gallery — they already built what they wanted.
    if (selectedLayout?.isCustom) setGalleryDismissed(true)
    setShowAssignment(false)
    // Unmount after the exit animation completes (~300ms for the spring).
    setTimeout(() => setAssignLayoutId(null), 350)
  }

  return (
    <>
      {/* Gallery overlay — only when gallery should be visible */}
      <AnimatePresence>
        {showGallery && (
          <m.div
            className="absolute inset-0 z-20 flex overflow-y-auto overscroll-contain p-3 bg-surface/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <input
              id={GALLERY_ID}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleGalleryChange}
            />
            <input
              id={CAMERA_ID}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleCameraChange}
            />

            <m.div
              className="m-auto flex w-full max-w-lg shrink-0 flex-col gap-4 py-1"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            >
              {/* Layout Gallery */}
              <LayoutGallery
                onSelectLayout={handleSelectLayout}
                onCustomLayout={handleCustomLayout}
                onSkip={handleSkip}
              />

              <Section
                title={t('tpl.title')}
                className="rounded-2xl border border-border/30 bg-surface-2/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm"
              >
                <TemplateGallery />
              </Section>

              {/* Secondary: direct photo add buttons */}
              <div className="flex justify-center gap-3">
                <label
                  htmlFor={GALLERY_ID}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-surface-3 active:scale-95"
                >
                  <ImagePlus size={17} strokeWidth={2.5} />
                  {t('photos.add')}
                </label>
                <label
                  htmlFor={CAMERA_ID}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-surface-3 active:scale-95"
                >
                  <Camera size={17} strokeWidth={2.5} />
                  {t('photos.camera')}
                </label>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Photo Assignment Sheet — sibling to gallery, NOT nested inside overlay */}
      <AnimatePresence>
        {selectedLayout && (
          <PhotoAssignmentSheet
            layout={selectedLayout}
            open={showAssignment}
            onClose={closeAssignment}
            onAssign={handleAssign}
            onSkip={closeAssignment}
            onDone={closeAssignment}
          />
        )}
      </AnimatePresence>
    </>
  )
}
