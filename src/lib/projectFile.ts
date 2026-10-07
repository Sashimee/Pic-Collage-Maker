// Portable .piccollage file format — a single JSON blob with embedded base64 photos.
// This keeps the format dependency-free and human-readable (unlike binary zip).

import type { LoadedDocument } from '../store/editorStore'
import { getPhoto, putPhoto } from './persistence'
import {
  backgroundKey,
  rehydrateBackground,
  rehydratePhotos,
  stripBackgroundUrl,
  stripPhotoUrls,
} from './photoRehydrate'

export interface PicCollageFile {
  version: 1
  project: {
    name: string
    createdAt: number
    updatedAt: number
  }
  doc: LoadedDocument
  photos: Record<string, string> // photo store key → base64 data URL
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
  // Fetch blobs from IndexedDB and encode
  const photos: Record<string, string> = {}
  for (const key of photoKeys(doc)) {
    const blob = await getPhoto(key)
    if (blob) {
      // Imports keep untyped originals as they came; unpack only accepts data:image/ URLs.
      const typed = blob.type.startsWith('image/') ? blob : new Blob([blob], { type: 'image/jpeg' })
      photos[key] = await blobToBase64(typed)
    }
  }

  const file: PicCollageFile = {
    version: 1,
    project: {
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    doc: {
      ...doc,
      elements: stripPhotoUrls(doc.elements),
      background: stripBackgroundUrl(doc.background),
    },
    photos,
  }

  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

/** The photo-store keys a document's pixels live under (see photoRehydrate.ts). */
function photoKeys(doc: LoadedDocument): Set<string> {
  // Collect all photoIds referenced in the document
  const keys = new Set<string>()
  for (const el of doc.elements) {
    if (el.type === 'photo' && el.photoId) {
      for (const variant of ['orig', 'prev', 'thumb']) keys.add(`${el.photoId}:${variant}`)
    }
  }
  const bg = doc.background
  if (bg.type === 'photo' && bg.photoId) keys.add(backgroundKey(bg.photoId))
  return keys
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
  if (!isPlainObject(doc.background)) {
    throw new Error('Invalid .piccollage: missing doc.background')
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

  // Only the keys of photos the document itself names; anything else in the file is ignored.
  const wanted = photoKeys(file.doc)
  // Decode base64 photos and store back into IndexedDB
  for (const [key, dataUrl] of Object.entries(file.photos)) {
    if (!wanted.has(key)) continue
    const response = await fetch(dataUrl)
    const photoBlob = await response.blob()
    await putPhoto(key, photoBlob)
  }

  // Files saved before #137 carry the saving session's dead blob: URLs.
  const elements = await rehydratePhotos(stripPhotoUrls(file.doc.elements))
  const background = await rehydrateBackground(stripBackgroundUrl(file.doc.background))
  return { name: file.project.name, doc: { ...file.doc, elements, background } }
}
