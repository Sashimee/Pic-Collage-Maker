import { create } from 'zustand'
import { useEditor } from '../store/editorStore'

interface FilePickerType {
  description: string
  accept: Record<string, string[]>
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: FilePickerType[]
    }) => Promise<FileSystemFileHandle>
    showOpenFilePicker?: (options?: {
      types?: FilePickerType[]
      multiple?: boolean
    }) => Promise<FileSystemFileHandle[]>
  }
}

export const PROJECT_FILE_TYPES: FilePickerType[] = [
  { description: 'Pic Collage project', accept: { 'application/x-piccollage': ['.piccollage'] } },
]

export const canPickFiles = () =>
  typeof window !== 'undefined' &&
  typeof window.showSaveFilePicker === 'function' &&
  typeof window.showOpenFilePicker === 'function'

/** The `.piccollage` file the board was opened from or last saved to, and which document that was. */
export const useLinkedFile = create<{ handle: FileSystemFileHandle | null; documentId: number }>(
  () => ({ handle: null, documentId: -1 }),
)

export function linkFile(handle: FileSystemFileHandle) {
  useLinkedFile.setState({ handle, documentId: useEditor.getState().documentId })
}

export function unlinkFile() {
  useLinkedFile.setState({ handle: null, documentId: -1 })
}

/** The linked file, unless another document has replaced the board since — saving there would overwrite it. */
export function linkedHandle(): FileSystemFileHandle | null {
  const { handle, documentId } = useLinkedFile.getState()
  return handle && documentId === useEditor.getState().documentId ? handle : null
}

export function useLinkedFileName(): string | null {
  const documentId = useEditor((s) => s.documentId)
  const linked = useLinkedFile()
  return linked.handle && linked.documentId === documentId ? linked.handle.name : null
}

/**
 * Opens the file for writing before producing what goes in it: opening may ask for
 * permission, and that prompt needs the click's user activation, which a slow pack outlasts.
 */
export async function writeFile(handle: FileSystemFileHandle, contents: () => Promise<Blob>) {
  const writable = await handle.createWritable()
  try {
    await writable.write(await contents())
  } catch (err) {
    await writable
      .abort()
      .catch((abortErr: unknown) =>
        console.error('[linkedFile] aborting the write failed', abortErr),
      )
    throw err
  }
  await writable.close()
}

export const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError'
