// Portable .piccollage file format — a single JSON blob with embedded base64 photos.
// This keeps the format dependency-free and human-readable (unlike binary zip).

import type { LoadedDocument } from '../store/editorStore'
import { getPhoto, putPhoto } from './persistence'

export interface PicCollageFile {
  version: 1
  project: {
    name: string
    createdAt: number
    updatedAt: number
  }
  doc: LoadedDocument
  photos: Record<string, string> // photoId → base64 data URL
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function packProject(
  name: string,
  doc: LoadedDocument,
): Promise<Blob> {
  // Collect all photoIds referenced in the document
  const photoIds = new Set<string>()
  for (const el of doc.elements) {
    if (el.type === 'photo' && el.photoId) {
      photoIds.add(el.photoId)
    }
  }
  const bg = doc.background
  if (bg.type === 'photo' && bg.photoId) {
    photoIds.add(bg.photoId)
  }

  // Fetch blobs from IndexedDB and encode
  const photos: Record<string, string> = {}
  for (const id of photoIds) {
    const blob = await getPhoto(id)
    if (blob) {
      photos[id] = await blobToBase64(blob)
    }
  }

  const file: PicCollageFile = {
    version: 1,
    project: {
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    doc,
    photos,
  }

  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validatePicCollageFile(raw: unknown): PicCollageFile {
  if (!isPlainObject(raw)) throw new Error('Invalid .piccollage: not an object')
  if (raw.version !== 1) throw new Error(`Unsupported .piccollage version: ${raw.version}`)

  const project = raw.project
  if (!isPlainObject(project) || typeof project.name !== 'string') {
    throw new Error('Invalid .piccollage: missing project.name')
  }

  const photos = raw.photos
  if (!isPlainObject(photos)) {
    throw new Error('Invalid .piccollage: missing photos map')
  }

  const doc = raw.doc
  if (!isPlainObject(doc) || !Array.isArray(doc.elements)) {
    throw new Error('Invalid .piccollage: missing doc.elements')
  }

  // Validate photo URLs are data: images (block HTTP/HTTPS egress)
  for (const [photoId, dataUrl] of Object.entries(photos)) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      throw new Error(`Invalid .piccollage: photo "${photoId}" is not a data:image/ URL`)
    }
  }

  return raw as unknown as PicCollageFile
}

export async function unpackProject(
  blob: Blob,
): Promise<{ name: string; doc: LoadedDocument }> {
  const text = await blob.text()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Invalid .piccollage: not valid JSON')
  }

  const file = validatePicCollageFile(raw)

  // Decode base64 photos and store back into IndexedDB
  for (const [photoId, dataUrl] of Object.entries(file.photos)) {
    const response = await fetch(dataUrl)
    const photoBlob = await response.blob()
    await putPhoto(photoId, photoBlob)
  }

  return { name: file.project.name, doc: file.doc }
}
