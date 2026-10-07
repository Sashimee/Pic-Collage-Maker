export interface StorageStatus {
  usage: number
  quota: number
  persisted: boolean
}

/** What the app's data takes up on the device, or null where the browser can't say. */
export async function storageStatus(): Promise<StorageStatus | null> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!storage?.estimate) return null
  const [{ usage = 0, quota = 0 }, persisted] = await Promise.all([
    storage.estimate(),
    storage.persisted ? storage.persisted() : Promise.resolve(false),
  ])
  return { usage, quota, persisted }
}

let asked = false

/**
 * Asks, once per session, for the app's data to be kept out of the browser's automatic
 * cleanup. Chrome decides silently, but Firefox shows a prompt, so this is asked only when
 * the user saves a project themselves — not on every visit, and not from exports or page
 * actions that save one on their behalf.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
  if (asked || !storage?.persist) return false
  asked = true
  if (await storage.persisted?.()) return true
  return storage.persist()
}

/** Test-only: forget that this session already asked. */
export function resetPersistRequest() {
  asked = false
}

const GB = 1024 ** 3
const MB = 1024 ** 2

export function formatBytes(bytes: number, locale: string): string {
  const [value, unit] = bytes >= GB ? [bytes / GB, 'gigabyte'] : [bytes / MB, 'megabyte']
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value)
}
