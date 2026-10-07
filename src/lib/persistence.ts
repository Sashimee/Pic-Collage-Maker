import type {
  Background,
  CanvasElement,
  EditorMode,
  Frame,
  WatermarkSettings,
  PrintSettings,
} from '../types'

// Client-side persistence: the whole editable document is saved to IndexedDB
// (nothing leaves the device). Photo bitmaps are stored as blobs keyed by
// `photoId`; the document JSON references those keys instead of transient
// object URLs, so work survives a reload.

const DB_NAME = 'piccollage'
const DB_VERSION = 1
const PHOTO_STORE = 'photos'
const DOC_STORE = 'doc'
const DOC_KEY = 'current'

export interface StoredDoc {
  boardWidth: number
  boardHeight: number
  background: Background
  mode: EditorMode
  gridId: string | null
  gridGap: number
  gridRadius: number
  gridMargin?: number
  frame: Frame
  watermark?: WatermarkSettings
  print?: PrintSettings
  elements: CanvasElement[] // photo elements carry photoId; src is blanked
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE)
      if (!db.objectStoreNames.contains(DOC_STORE)) db.createObjectStore(DOC_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = run(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

const available = () => typeof indexedDB !== 'undefined'

export async function putPhoto(id: string, blob: Blob): Promise<void> {
  if (!available()) return
  try {
    await tx(PHOTO_STORE, 'readwrite', (s) => s.put(blob, id))
  } catch {
    /* persistence is best-effort */
  }
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  if (!available()) return undefined
  try {
    return await tx<Blob | undefined>(PHOTO_STORE, 'readonly', (s) => s.get(id))
  } catch {
    return undefined
  }
}

export async function saveDoc(doc: StoredDoc): Promise<void> {
  if (!available()) return
  try {
    await tx(DOC_STORE, 'readwrite', (s) => s.put(doc, DOC_KEY))
  } catch {
    /* ignore */
  }
}

export async function loadDoc(): Promise<StoredDoc | undefined> {
  if (!available()) return undefined
  try {
    return await tx<StoredDoc | undefined>(DOC_STORE, 'readonly', (s) => s.get(DOC_KEY))
  } catch {
    return undefined
  }
}

// Wipe everything (used by "New"). Also drops all stored photo blobs.
export async function clearPersisted(): Promise<void> {
  if (!available()) return
  try {
    await tx(DOC_STORE, 'readwrite', (s) => s.delete(DOC_KEY))
    await tx(PHOTO_STORE, 'readwrite', (s) => s.clear())
  } catch {
    /* ignore */
  }
}

// Drop blobs no longer referenced by the current document.
export async function prunePhotos(keepIds: Set<string>): Promise<void> {
  if (!available()) return
  try {
    const keys = await tx<IDBValidKey[]>(PHOTO_STORE, 'readonly', (s) => s.getAllKeys())
    for (const k of keys) {
      if (typeof k === 'string' && !keepIds.has(k)) {
        await tx(PHOTO_STORE, 'readwrite', (s) => s.delete(k))
      }
    }
  } catch {
    /* ignore */
  }
}
