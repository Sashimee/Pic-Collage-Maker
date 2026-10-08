import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const UNITS = ['px', 'mm', 'in'] as const
export type Units = (typeof UNITS)[number]
export type DefaultExportFormat = 'png' | 'jpg'

export const AUTOSAVE_DELAYS = [1500, 5000, 15000, 30000] as const
export type AutosaveDelay = (typeof AUTOSAVE_DELAYS)[number]

/** Print resolution the mm/in readouts assume, the same one the photo book prints at. */
const DPI = 300
const MM_PER_INCH = 25.4

interface SettingsState {
  units: Units
  exportFormat: DefaultExportFormat
  autosaveDelay: AutosaveDelay
  analyticsOptOut: boolean
  keepLocation: boolean
  setUnits: (units: Units) => void
  setExportFormat: (format: DefaultExportFormat) => void
  setAutosaveDelay: (ms: AutosaveDelay) => void
  setAnalyticsOptOut: (optOut: boolean) => void
  setKeepLocation: (keep: boolean) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      units: 'px',
      exportFormat: 'png',
      autosaveDelay: 1500,
      analyticsOptOut: false,
      keepLocation: false,
      setUnits: (units) => set({ units }),
      setExportFormat: (exportFormat) => set({ exportFormat }),
      setAutosaveDelay: (autosaveDelay) => set({ autosaveDelay }),
      setAnalyticsOptOut: (analyticsOptOut) => set({ analyticsOptOut }),
      setKeepLocation: (keepLocation) => set({ keepLocation }),
    }),
    {
      name: 'pic-collage-settings',
      // A hand-edited or older record must not put an unknown unit or delay into the app.
      merge: (persisted, current) => {
        const saved: Record<string, unknown> =
          typeof persisted === 'object' && persisted
            ? Object.fromEntries(Object.entries(persisted))
            : {}
        return {
          ...current,
          units: UNITS.find((u) => u === saved.units) ?? current.units,
          exportFormat: saved.exportFormat === 'jpg' ? 'jpg' : current.exportFormat,
          autosaveDelay:
            AUTOSAVE_DELAYS.find((d) => d === saved.autosaveDelay) ?? current.autosaveDelay,
          analyticsOptOut: saved.analyticsOptOut === true,
          keepLocation: saved.keepLocation === true,
        }
      },
    },
  ),
)

/** A board length in design pixels, in the chosen units. */
export function formatLength(px: number, units: Units): string {
  if (units === 'px') return `${Math.round(px)}`
  const inches = px / DPI
  return units === 'in' ? inches.toFixed(2) : `${Math.round(inches * MM_PER_INCH)}`
}
