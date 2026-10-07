import { ImagePlus, Camera } from 'lucide-react'
import { useEditor } from '../../store/editorStore'
import { importFiles } from '../../lib/importFiles'
import { PrimaryButton } from '../ui'
import { useT } from '../../i18n/useLang'

const PANEL_GALLERY_ID = 'panel-gallery-input'
const PANEL_CAMERA_ID = 'panel-camera-input'

export function PhotosPanel() {
  const t = useT()
  const addPhoto = useEditor((s) => s.addPhoto)

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
    </div>
  )
}
