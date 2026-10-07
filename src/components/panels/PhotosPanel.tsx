import { ImagePlus, Camera, ClipboardPaste } from 'lucide-react'
import { useEditor } from '../../store/editorStore'
import { useImportFiles } from '../../hooks/useImportFiles'
import { PrimaryButton } from '../ui'
import { useT } from '../../i18n/useLang'
import { useToasts } from '../ToastContainer'

const PANEL_GALLERY_ID = 'panel-gallery-input'
const PANEL_CAMERA_ID = 'panel-camera-input'

// Phones have no Ctrl+V, and a long-press only offers Paste on a text field.
const canReadClipboard = () =>
  typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function'

async function clipboardImages(): Promise<FileList> {
  const files = new DataTransfer()
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (!type) continue
    const blob = await item.getType(type)
    files.items.add(new File([blob], `pasted.${type.slice(6)}`, { type }))
  }
  return files.files
}

export function PhotosPanel() {
  const t = useT()
  const importFiles = useImportFiles()
  const addPhoto = useEditor((s) => s.addPhoto)
  const toast = useToasts()

  const handlePaste = async () => {
    let files: FileList
    try {
      files = await clipboardImages()
    } catch (err) {
      console.error('[paste]', err)
      toast.error(
        t(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'clipboard.denied'
            : 'clipboard.noImage',
        ),
      )
      return
    }
    if (!files.length) {
      toast.info(t('clipboard.noImage'))
      return
    }
    try {
      const { added } = await importFiles(files, addPhoto)
      if (added) toast.success(t('clipboard.pasted'))
    } catch (err) {
      console.error('[paste]', err)
      toast.error(t('error.loadImages'))
    }
  }

  const handleGalleryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Capture before awaiting — `currentTarget` is nulled once the handler
    // returns, so reading it after the await can throw.
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

  return (
    <div className="flex gap-3">
      <input
        id={PANEL_GALLERY_ID}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleGalleryChange}
      />
      <input
        id={PANEL_CAMERA_ID}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleCameraChange}
      />
      <PrimaryButton as="label" htmlFor={PANEL_GALLERY_ID}>
        <span className="flex items-center gap-2">
          <ImagePlus size={16} strokeWidth={2.5} />
          {t('photos.add')}
        </span>
      </PrimaryButton>
      <PrimaryButton as="label" htmlFor={PANEL_CAMERA_ID}>
        <span className="flex items-center gap-2">
          <Camera size={16} strokeWidth={2.5} />
          {t('photos.camera')}
        </span>
      </PrimaryButton>
      {canReadClipboard() && (
        <PrimaryButton onClick={handlePaste}>
          <span className="flex items-center gap-2">
            <ClipboardPaste size={16} strokeWidth={2.5} />
            {t('clipboard.paste')}
          </span>
        </PrimaryButton>
      )}
    </div>
  )
}
