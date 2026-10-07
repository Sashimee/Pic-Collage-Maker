import { openDB, type IDBPDatabase } from 'idb'
import type { TemplateDocument } from '../lib/templates'

/** Bump when `TemplateDocument` changes shape, and migrate older records in `readTemplate`. */
const SCHEMA = 1

export interface UserTemplate {
  schema?: number
  id: string
  name: string
  createdAt: number
  doc: TemplateDocument
}

// Its own database rather than a second store in the projects one: adding a store means a version
// bump, and an upgrade waits on every open tab still holding the old version.
const DB_NAME = 'pic-collage-templates'
const STORE_NAME = 'templates'
let dbPromise: Promise<IDBPDatabase> | null = null

function db() {
  if (typeof indexedDB === 'undefined') throw new Error('indexedDB not available')
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore(STORE_NAME, { keyPath: 'id' })
    },
  })
  return dbPromise
}

export async function saveUserTemplate(tpl: UserTemplate) {
  await (await db()).put(STORE_NAME, { ...tpl, schema: SCHEMA })
}

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

/** A stored record is data from an earlier build, or a hand-edited database; only a well-formed one reaches the editor. */
function readTemplate(raw: unknown): UserTemplate | null {
  const r = raw as Partial<UserTemplate> | null
  const d = r?.doc
  const ok =
    r?.schema === SCHEMA &&
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    isNum(r.createdAt) &&
    !!d &&
    typeof d.gridId === 'string' &&
    [d.boardWidth, d.boardHeight, d.gridGap, d.gridRadius, d.gridMargin].every(isNum) &&
    d.boardWidth > 0 &&
    d.boardHeight > 0 &&
    typeof d.background === 'object' &&
    typeof d.frame === 'object' &&
    Array.isArray(d.elements) &&
    d.elements.every((e) => e?.type === 'text' || e?.type === 'sticker')
  if (!ok) console.warn('Skipping a saved template that does not match this version', raw)
  return ok ? (r as UserTemplate) : null
}

export async function createUserTemplate(name: string, doc: TemplateDocument) {
  const tpl: UserTemplate = {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    name,
    createdAt: Date.now(),
    doc,
  }
  await saveUserTemplate(tpl)
  return tpl
}

/** Newest first. */
export async function listUserTemplates(): Promise<UserTemplate[]> {
  const all = (await (await db()).getAll(STORE_NAME)) as unknown[]
  return all
    .map(readTemplate)
    .filter((t): t is UserTemplate => t !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteUserTemplate(id: string) {
  await (await db()).delete(STORE_NAME, id)
}
