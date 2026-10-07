// Portable .piccollage file format — a single JSON blob with embedded base64 photos.
// This keeps the format dependency-free and human-readable (unlike binary zip).

import type { LoadedDocument } from '../store/editorStore'
import { listProjects, loadProject, saveProject } from '../services/localProjects'
import { getPhoto, putPhoto } from './persistence'
import { toProjectDocument, type ProjectDocument } from './projectSchema'
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

/** Every saved project, with the photos they use, in one file. */
export interface BackupFile {
  format: 'piccollage-backup'
  version: 1
  createdAt: number
  projects: { name: string; createdAt: number; updatedAt: number; data: ProjectDocument }[]
  photos: Record<string, string> // photo store key → base64 data URL
}

const stripPage = (page: LoadedDocument): LoadedDocument => ({
  ...page,
  elements: stripPhotoUrls(page.elements),
  background: stripBackgroundUrl(page.background),
})

const backupKeys = (projects: BackupFile['projects']) =>
  new Set(projects.flatMap((p) => p.data.pages.flatMap((page) => [...photoKeys(page)])))

export async function packBackup(): Promise<{ blob: Blob; count: number }> {
  const projects: BackupFile['projects'] = []
  for (const id of await listProjects()) {
    const project = await loadProject(id)
    const data = project && toProjectDocument(project.data)
    // Unreadable records can't be opened in the app either; there is nothing to back up.
    if (!project || !data) continue
    projects.push({
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      data: { ...data, pages: data.pages.map(stripPage) },
    })
  }

  const head: Omit<BackupFile, 'photos'> = {
    format: 'piccollage-backup',
    version: 1,
    createdAt: Date.now(),
    projects,
  }
  // One Blob part per photo, so the whole backup never has to exist as a single string.
  const parts: BlobPart[] = [JSON.stringify(head).slice(0, -1), ',"photos":{']
  let first = true
  for (const key of backupKeys(projects)) {
    const blob = await getPhoto(key)
    if (!blob) continue
    const typed = blob.type.startsWith('image/') ? blob : new Blob([blob], { type: 'image/jpeg' })
    const entry = `${JSON.stringify(key)}:${JSON.stringify(await blobToBase64(typed))}`
    parts.push(new Blob([first ? entry : `,${entry}`]))
    first = false
  }
  parts.push('}}')
  return { blob: new Blob(parts, { type: 'application/json' }), count: projects.length }
}

/** The file isn't a backup this version can read. */
export class InvalidBackupError extends Error {}
/** The device ran out of room while the backup's photos were being stored. */
export class BackupStorageError extends Error {}

function validateBackup(raw: unknown): BackupFile {
  if (!isPlainObject(raw) || raw.format !== 'piccollage-backup') {
    throw new InvalidBackupError('Not a Pic Collage backup file')
  }
  if (raw.version !== 1) throw new InvalidBackupError(`Unsupported backup version: ${raw.version}`)
  if (!Array.isArray(raw.projects)) throw new InvalidBackupError('Invalid backup: missing projects')
  if (!isPlainObject(raw.photos)) throw new InvalidBackupError('Invalid backup: missing photos map')

  const projects = raw.projects.map((p: unknown, i): BackupFile['projects'][number] => {
    if (!isPlainObject(p) || typeof p.name !== 'string') {
      throw new InvalidBackupError(`Invalid backup: project ${i + 1} has no name`)
    }
    const data = toProjectDocument(p.data)
    if (!data) throw new InvalidBackupError(`Invalid backup: project "${p.name}" has no pages`)
    const now = Date.now()
    return {
      name: p.name,
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : now,
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : now,
      data: { ...data, pages: data.pages.map(stripPage) },
    }
  })

  const photos: Record<string, string> = {}
  for (const [key, dataUrl] of Object.entries(raw.photos)) {
    // Only data: images, so a crafted file can't make the app fetch anything remote.
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      throw new InvalidBackupError(`Invalid backup: photo "${key}" is not a data:image/ URL`)
    }
    photos[key] = dataUrl
  }
  return { format: 'piccollage-backup', version: 1, createdAt: 0, projects, photos }
}

/**
 * Adds every project in a backup as a new project; nothing already saved is overwritten.
 * The whole file is checked before anything is written. Returns how many were added.
 */
export async function restoreBackup(blob: Blob): Promise<number> {
  const text = await blob.text()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new InvalidBackupError('Not a Pic Collage backup file')
  }
  const backup = validateBackup(raw)

  for (const key of backupKeys(backup.projects)) {
    const dataUrl = backup.photos[key]
    if (!dataUrl) continue
    await putPhoto(key, await (await fetch(dataUrl)).blob())
    // putPhoto swallows its errors; a full disk would otherwise restore projects without photos.
    if (!(await getPhoto(key))) {
      throw new BackupStorageError(
        "Could not store the backup's photos. Free up space on the device and try again.",
      )
    }
  }

  for (const p of backup.projects) {
    await saveProject({ id: crypto.randomUUID(), ...p })
  }
  return backup.projects.length
}
