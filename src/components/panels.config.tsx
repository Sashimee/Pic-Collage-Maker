import { lazy, Suspense } from 'react'
import { useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import {
  Image as ImageIcon,
  LayoutGrid,
  Type,
  Brush,
  Smile,
  Palette,
  Wand2,
  Layers,
  History,
  Settings,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { useWorkspace } from '../store/workspaceStore'
import { usePanelTips } from './TipToast'

// Lazy-load panels to reduce initial bundle
const PhotosPanel = lazy(() => import('./panels/PhotosPanel').then((m) => ({ default: m.PhotosPanel })))
const LayoutPanel = lazy(() => import('./panels/LayoutPanel').then((m) => ({ default: m.LayoutPanel })))
const TextPanel = lazy(() => import('./panels/TextPanel').then((m) => ({ default: m.TextPanel })))
const DrawPanel = lazy(() => import('./panels/DrawPanel').then((m) => ({ default: m.DrawPanel })))
const StickerPanel = lazy(() => import('./panels/StickerPanel').then((m) => ({ default: m.StickerPanel })))
const BackgroundPanel = lazy(() => import('./panels/BackgroundPanel').then((m) => ({ default: m.BackgroundPanel })))
const FilterPanel = lazy(() => import('./FilterPanel').then((m) => ({ default: m.FilterPanel })))
const SettingsPanel = lazy(() => import('./WatermarkPanel').then((m) => ({ default: m.SettingsPanel })))
const LayerPanel = lazy(() => import('./LayerPanel'))
const VersionHistoryPanel = lazy(() => import('./VersionHistoryPanel'))

function PanelFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  )
}

export interface PanelTab {
  id: string
  labelKey: string
  Icon: ComponentType<LucideProps>
  panel: ReactNode
}

export const PANEL_TABS: PanelTab[] = [
  { id: 'photos', labelKey: 'tab.photos', Icon: ImageIcon, panel: <Suspense fallback={<PanelFallback />}><PhotosPanel /></Suspense> },
  { id: 'layout', labelKey: 'tab.layout', Icon: LayoutGrid, panel: <Suspense fallback={<PanelFallback />}><LayoutPanel /></Suspense> },
  { id: 'text', labelKey: 'tab.text', Icon: Type, panel: <Suspense fallback={<PanelFallback />}><TextPanel /></Suspense> },
  { id: 'draw', labelKey: 'tab.draw', Icon: Brush, panel: <Suspense fallback={<PanelFallback />}><DrawPanel /></Suspense> },
  { id: 'stickers', labelKey: 'tab.stickers', Icon: Smile, panel: <Suspense fallback={<PanelFallback />}><StickerPanel /></Suspense> },
  { id: 'bg', labelKey: 'tab.background', Icon: Palette, panel: <Suspense fallback={<PanelFallback />}><BackgroundPanel /></Suspense> },
  { id: 'filters', labelKey: 'tab.filters', Icon: Wand2, panel: <Suspense fallback={<PanelFallback />}><FilterPanel /></Suspense> },
  { id: 'layers', labelKey: 'tab.layers', Icon: Layers, panel: <Suspense fallback={<PanelFallback />}><LayerPanel /></Suspense> },
  { id: 'history', labelKey: 'tab.history', Icon: History, panel: <Suspense fallback={<PanelFallback />}><VersionHistoryPanel /></Suspense> },
  { id: 'settings', labelKey: 'tab.settings', Icon: Settings, panel: <Suspense fallback={<PanelFallback />}><SettingsPanel /></Suspense> },
]

// Shared active-tab state + selection logic (arms the brush on the Draw tab,
// returns to select mode otherwise). One instance drives whichever shell is
// mounted for the current breakpoint.
export function usePanels(initial: string | null = 'photos') {
  const [active, setActive] = useState<string | null>(initial)
  const setTool = useEditor((s) => s.setTool)

  const workspaceActive = useWorkspace((s) => s.activeTab)
  const setWorkspaceActive = useWorkspace((s) => s.setActiveTab)
  const panelSizes = useWorkspace((s) => s.panelSizes)

  // Hydrate from the workspace store on mount — but only when the caller
  // actually wants a panel open. Mobile passes `null` on purpose so the sheet
  // doesn't cover the first-run layout gallery, and the store's default
  // ('photos') used to override that and re-open it anyway.
  useEffect(() => {
    if (initial !== null && workspaceActive !== undefined) {
      setActive(workspaceActive)
    }
  }, [])

  // React runs a setState updater during the render phase, so writing to other
  // stores from inside one updates them mid-render — that was the source of
  // "Cannot update a component while rendering a different component". It is
  // also a correctness hazard: React may invoke an updater twice (StrictMode
  // does in dev), which would double-fire both side effects. Derive `next`
  // first, then call the setters, the way close() below already does.
  const select = (id: string) => {
    const next = active === id ? null : id
    setActive(next)
    setTool(next === 'draw' ? 'draw' : 'select')
    setWorkspaceActive(next)
  }

  const close = () => {
    setActive(null)
    setTool('select')
    setWorkspaceActive(null)
  }

  // Gesture demos for the two panels whose real interaction is a drag, fired
  // from the one place a panel becomes active. `select` toggles, so this keys
  // on the resulting `active` rather than on every call.
  usePanelTips(active)

  const current = PANEL_TABS.find((tab) => tab.id === active) ?? null

  // Filter out tabs hidden via workspace panelVisibility — always keep Settings visible
  const visibleTabs = PANEL_TABS.filter((tab) => {
    if (tab.id === 'settings') return true
    const vis = useWorkspace.getState().panelVisibility[tab.id]
    return vis !== false
  })

  return { tabs: visibleTabs, active, select, close, current, panelSizes }
}

export type PanelsApi = ReturnType<typeof usePanels>
