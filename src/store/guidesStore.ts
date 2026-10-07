import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Editor-only aids drawn over the board. None of them is ever exported. */
export interface Guides {
  rulers: boolean
  centerLines: boolean
  printArea: boolean
  spacing: boolean
}

interface GuidesState extends Guides {
  toggle: (key: keyof Guides) => void
}

export const useGuides = create<GuidesState>()(
  persist(
    (set) => ({
      rulers: false,
      centerLines: false,
      printArea: false,
      spacing: true,
      toggle: (key) => set((s) => ({ [key]: !s[key] })),
    }),
    {
      name: 'pic-collage-guides',
      partialize: ({ rulers, centerLines, printArea, spacing }) => ({
        rulers,
        centerLines,
        printArea,
        spacing,
      }),
    },
  ),
)
