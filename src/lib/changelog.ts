export interface Release {
  /** Bump to a new id to show the sheet again; it is the first-use id's suffix. */
  id: string
  /** i18n keys, one line each. */
  items: string[]
}

/** Newest first. Only the newest is ever shown. */
export const RELEASES: Release[] = [
  {
    id: '2026-10',
    items: [
      'whatsNew.2026-10.samples',
      'whatsNew.2026-10.settings',
      'whatsNew.2026-10.undoDelete',
      'whatsNew.2026-10.palette',
    ],
  },
]

export const WHATS_NEW_TIP = `whatsNew:${RELEASES[0].id}`
