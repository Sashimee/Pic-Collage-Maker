import { create } from 'zustand'
import type {
  Background,
  CanvasElement,
  DrawingElement,
  EditorMode,
  FilterOperation,
  Frame,
  GridCell,
  PhotoElement,
  PhotoFilters,
  PhotoShape,
  ShapeElement,
  StickerElement,
  TextElement,
  WatermarkSettings,
  PrintSettings,
} from '../types'
import {
  DEFAULT_FILTERS,
  DEFAULT_FILTER_STACK,
  DEFAULT_WATERMARK,
  DEFAULT_PRINT_SETTINGS,
} from '../types'
import {
  fullZone,
  splitZonesByStroke,
  circleZoneByStroke,
  mergeZoneInto,
  cellsToZones,
  type Zone,
} from '../lib/customLayout'
import { getGridById } from '../lib/grids'
import { styleOf, stylePatch, type ElementStyle } from '../lib/elementStyle'
import { getCustomLayoutById } from '../lib/customLayoutStorage'
import type { TemplateDocument } from '../lib/templates'

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

// ---- Undo/redo history ----------------------------------------------------
// A snapshot is the whole editable "document" (everything except the transient
// selection + the history stacks themselves). Actions push the pre-mutation
// snapshot onto `past` and clear `future`. Rapid edits with the same coalesce
// key (e.g. dragging a slider) collapse into a single undo step.

const HISTORY_LIMIT = 60
let lastKey = ''
let lastAt = 0

interface Snapshot {
  elements: CanvasElement[]
  background: Background
  mode: EditorMode
  gridId: string | null
  gridGap: number
  gridRadius: number
  gridMargin: number
  frame: Frame
  boardWidth: number
  boardHeight: number
  watermark: WatermarkSettings
  print: PrintSettings
}

/** One undo step: the document either side of it, and what the step did (an i18n key). */
export interface HistoryEntry {
  doc: Snapshot
  label: string
}

const snap = (s: EditorState): Snapshot => ({
  elements: s.elements,
  background: s.background,
  mode: s.mode,
  gridId: s.gridId,
  gridGap: s.gridGap,
  gridRadius: s.gridRadius,
  gridMargin: s.gridMargin,
  frame: s.frame,
  boardWidth: s.boardWidth,
  boardHeight: s.boardHeight,
  watermark: s.watermark,
  print: s.print,
})

// Returns the `past`/`future` patch to spread into a mutating `set`. When a
// `key` repeats within the coalesce window the step is merged (no new entry).
const record = (s: EditorState, label: string, key = ''): Partial<EditorState> => {
  const now = Date.now()
  if (key && key === lastKey && now - lastAt < 600) {
    lastAt = now
    return {}
  }
  lastKey = key
  lastAt = now
  return { past: [...s.past, { doc: snap(s), label }].slice(-HISTORY_LIMIT), future: [] }
}

const isMove = (patch: object) => Object.keys(patch).every((k) => k === 'x' || k === 'y')
const TRANSFORM_KEYS = new Set(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'width', 'height'])
const editLabel = (patch: object) =>
  isMove(patch)
    ? 'history.move'
    : Object.keys(patch).every((k) => TRANSFORM_KEYS.has(k))
      ? 'history.transform'
      : 'history.edit'

const undoOnce = (s: EditorState): EditorState => {
  const prev = s.past[s.past.length - 1]
  return {
    ...s,
    ...prev.doc,
    past: s.past.slice(0, -1),
    future: [{ doc: snap(s), label: prev.label }, ...s.future].slice(0, HISTORY_LIMIT),
  }
}

const redoOnce = (s: EditorState): EditorState => {
  const next = s.future[0]
  return {
    ...s,
    ...next.doc,
    past: [...s.past, { doc: snap(s), label: next.label }].slice(-HISTORY_LIMIT),
    future: s.future.slice(1),
  }
}

// A group of one is no group: the survivor stays as the plain selection.
/** Locking or hiding takes an element out of the selection, single or grouped. */
const deselect = (s: EditorState, id: string): Partial<EditorState> =>
  s.multiSelected.length ? withoutFromGroup(s, [id]) : s.selectedId === id ? { selectedId: null } : {}

const withoutFromGroup = (s: EditorState, ids: string[]): Partial<EditorState> => {
  if (!s.multiSelected.length) return {}
  const rest = s.multiSelected.filter((id) => !ids.includes(id))
  const keep = s.selectedId && !ids.includes(s.selectedId)
  return {
    multiSelected: rest.length > 1 ? rest : [],
    selectedId: keep ? s.selectedId : (rest[rest.length - 1] ?? null),
  }
}

// Apply a zone operation and push the previous zones onto the custom-layout
// undo stack. Reports back whether anything changed, so a gesture that did
// nothing can be explained to the user rather than swallowed.
const commitZones = (
  set: (patch: Partial<EditorState>) => void,
  get: () => EditorState,
  op: (zones: Zone[]) => Zone[] | null,
): boolean => {
  const s = get()
  const next = op(s.customLayoutZones)
  if (!next) return false
  set({
    customLayoutZones: next,
    customLayoutPast: [...s.customLayoutPast, s.customLayoutZones].slice(-40),
  })
  return true
}

interface EditorState {
  boardWidth: number
  boardHeight: number
  background: Background
  mode: EditorMode
  /** Freehand custom-layout: current zones + undo stack of previous zone sets. */
  customLayoutZones: Zone[]
  customLayoutPast: Zone[][]
  customLayoutMode: boolean
  gridId: string | null
  gridGap: number
  gridRadius: number
  gridMargin: number
  frame: Frame
  elements: CanvasElement[]
  selectedId: string | null
  multiSelected: string[]
  croppingId: string | null

  // drawing tool (transient — not part of undo history)
  tool: 'select' | 'draw'
  brushColor: string
  brushSize: number

  past: HistoryEntry[]
  future: HistoryEntry[]
  /** The style last copied with "Copy style"; not part of the document. */
  copiedStyle: ElementStyle | null

  watermark: WatermarkSettings
  print: PrintSettings

  // selectors
  selected: () => CanvasElement | undefined

  // multi-select
  toggleMultiSelect: (id: string) => void
  clearMultiSelect: () => void
  /** Select these elements together (locked and hidden ones are skipped). */
  selectMany: (ids: string[]) => void

  // element actions
  addPhoto: (
    src: string,
    naturalWidth: number,
    naturalHeight: number,
    photoId?: string,
    opts?: { originalSrc?: string; previewSrc?: string; thumbSrc?: string },
  ) => void
  addText: () => void
  addSticker: (emoji: string) => void
  addDrawing: (points: number[], stroke: string, strokeWidth: number) => void
  addShape: (
    shapeType: import('../types').ShapeType,
    fill?: string,
    custom?: { path: string; libraryId: string },
  ) => void
  setTool: (tool: 'select' | 'draw') => void
  setBrush: (patch: { color?: string; size?: number }) => void
  updateElement: (id: string, patch: Partial<CanvasElement>) => void
  /** Patch several elements as one undo step (a group move or transform). */
  updateElements: (patches: Record<string, Partial<CanvasElement>>) => void
  updateFilters: (id: string, patch: Partial<PhotoFilters>) => void
  updateFilterStack: (id: string, stack: FilterOperation[]) => void
  duplicateElement: (id: string) => void
  removeElement: (id: string) => void
  removeElements: (ids: string[]) => void
  select: (id: string | null) => void
  setCropping: (id: string | null) => void

  // z-order
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void

  // visibility & lock actions
  setElementHidden: (id: string, hidden: boolean) => void
  setElementLocked: (id: string, locked: boolean) => void

  // grouping
  groupElements: (ids: string[]) => void
  ungroupElements: (groupId: string) => void

  // reorder
  setElements: (elements: CanvasElement[]) => void

  // shape & zoom
  applyShapeToAll: (shape: PhotoShape) => void
  setCanvasZoom: (zoom: number) => void
  canvasZoom: number
  /**
   * Floor for `canvasZoom`. Normally 0.25, so the zoom-out button can't shrink
   * the board to a speck — but a fit can legitimately need less than that (a
   * small phone with a panel open, or a big board), and when it does, a fixed
   * floor overrides the fit and the board spills out from under the chrome.
   * `fitToScreen` lowers it to whatever the fit actually needs.
   */
  minCanvasZoom: number
  setMinCanvasZoom: (v: number) => void
  exporting: boolean
  setExporting: (v: boolean) => void

  // board / background / mode / frame / grid style
  setBackground: (patch: Partial<Background>) => void
  setMode: (mode: EditorMode) => void
  applyLayout: (layoutId: string, opts?: { boardSize?: { w: number; h: number } }) => void
  /** Replace everything but the photos with a template, as one undo step; the photos fill its cells. */
  applyTemplate: (doc: TemplateDocument) => void
  setGrid: (gridId: string | null) => void
  setGridGap: (gap: number) => void
  setGridMargin: (margin: number) => void
  setGridRadius: (radius: number) => void
  setFrame: (patch: Partial<Frame>) => void
  setBoardSize: (width: number, height: number) => void
  clearAll: () => void
  loadDocument: (doc: LoadedDocument) => void

  // start-screen layout gallery
  galleryDismissed: boolean
  setGalleryDismissed: (v: boolean) => void
  /** Layout whose photo-assignment sheet should be open (preset id or custom uuid). */
  assignLayoutId: string | null
  setAssignLayoutId: (id: string | null) => void

  setWatermark: (patch: Partial<WatermarkSettings>) => void
  setPrint: (patch: Partial<PrintSettings>) => void

  // custom layout — the split/merge actions report whether they changed
  // anything so the UI can explain a no-op instead of failing silently.
  splitCustomLayout: (pts: { x: number; y: number }[], snapStep?: number) => boolean
  circleCustomLayout: (pts: { x: number; y: number }[], overlay: boolean) => boolean
  mergeCustomLayoutCell: (index: number) => boolean
  undoCustomLayout: () => void
  setCustomLayoutMode: (v: boolean, cells?: GridCell[]) => void

  // history
  undo: () => void
  redo: () => void
  /** Undo (negative) or redo (positive) this many steps as one jump. */
  travel: (steps: number) => void
  copyStyle: (id: string) => void
  /** Give these elements the copied style, as one undo step. */
  pasteStyle: (ids: string[]) => void
}

// Shape accepted by loadDocument when restoring persisted work.
export interface LoadedDocument {
  boardWidth: number
  boardHeight: number
  background: Background
  mode: EditorMode
  gridId: string | null
  gridGap: number
  gridRadius: number
  /** Outer margin around the whole grid (design units); absent in older documents. */
  gridMargin?: number
  frame: Frame
  elements: CanvasElement[]
  watermark?: WatermarkSettings
  print?: PrintSettings
}

const DEFAULT_BACKGROUND: Background = {
  type: 'solid',
  color: '#ffffff',
  gradientFrom: '#6366f1',
  gradientTo: '#ec4899',
  gradientAngle: 45,
  patternId: 'dots',
  patternColor: '#6366f1',
}

const DEFAULT_FRAME: Frame = {
  style: 'none',
  color: '#ffffff',
  width: 0.04,
}

export const useEditor = create<EditorState>((set, get) => ({
  boardWidth: 1080,
  boardHeight: 1350,
  background: DEFAULT_BACKGROUND,
  mode: 'free',
  galleryDismissed: false,
  assignLayoutId: null,
  customLayoutZones: [fullZone()],
  customLayoutPast: [],
  customLayoutMode: false,
  gridId: null,
  gridGap: 12,
  gridRadius: 0,
  gridMargin: 0,
  frame: DEFAULT_FRAME,
  elements: [],
  selectedId: null,
  multiSelected: [],
  croppingId: null,

  tool: 'select',
  brushColor: '#ef4444',
  brushSize: 8,
  canvasZoom: 1,
  minCanvasZoom: 0.25,
  exporting: false,

  past: [],
  future: [],
  copiedStyle: null,

  watermark: { ...DEFAULT_WATERMARK },
  print: { ...DEFAULT_PRINT_SETTINGS },

  selected: () => get().elements.find((e) => e.id === get().selectedId),

  addPhoto: (src, naturalWidth, naturalHeight, photoId, opts) =>
    set((s) => {
      // Fit the new photo to ~55% of the board's shorter axis, centered.
      const target = Math.min(s.boardWidth, s.boardHeight) * 0.55
      const ratio = naturalWidth / naturalHeight
      let w = target
      let h = target / ratio
      if (h > target) {
        h = target
        w = target * ratio
      }
      const photo: PhotoElement = {
        id: uid(),
        type: 'photo',
        src,
        photoId,
        previewSrc: opts?.previewSrc,
        originalSrc: opts?.originalSrc,
        thumbSrc: opts?.thumbSrc,
        width: w,
        height: h,
        x: s.boardWidth / 2 - w / 2,
        y: s.boardHeight / 2 - h / 2,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        filters: { ...DEFAULT_FILTERS },
        filterStack: [...DEFAULT_FILTER_STACK],
      }
      return { elements: [...s.elements, photo], selectedId: photo.id, ...record(s, 'history.addPhoto') }
    }),

  addText: () =>
    set((s) => {
      const text: TextElement = {
        id: uid(),
        type: 'text',
        text: 'Tap to edit',
        fontFamily: 'Poppins, system-ui, sans-serif',
        fontSize: 72,
        fill: '#111827',
        fontStyle: 'bold',
        x: s.boardWidth / 2 - 200,
        y: s.boardHeight / 2 - 40,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      }
      return { elements: [...s.elements, text], selectedId: text.id, ...record(s, 'history.addText') }
    }),

  addSticker: (emoji) =>
    set((s) => {
      const sticker: StickerElement = {
        id: uid(),
        type: 'sticker',
        emoji,
        fontSize: 160,
        x: s.boardWidth / 2 - 80,
        y: s.boardHeight / 2 - 80,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      }
      return { elements: [...s.elements, sticker], selectedId: sticker.id, ...record(s, 'history.addSticker') }
    }),

  addDrawing: (points, stroke, strokeWidth) =>
    set((s) => {
      const drawing: DrawingElement = {
        id: uid(),
        type: 'drawing',
        points,
        stroke,
        strokeWidth,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      }
      return { elements: [...s.elements, drawing], ...record(s, 'history.draw') }
    }),

  addShape: (shapeType, fill = '#6366f1', custom) =>
    set((s) => {
      const shape: ShapeElement = {
        id: uid(),
        type: 'shape',
        shapeType,
        fill,
        ...custom,
        x: s.boardWidth / 2 - 60,
        y: s.boardHeight / 2 - (custom ? 60 : 40),
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      }
      return { elements: [...s.elements, shape], selectedId: shape.id, ...record(s, 'history.addShape') }
    }),

  setTool: (tool) => set({ tool, selectedId: null, multiSelected: [] }),

  setBrush: (patch) =>
    set((s) => ({
      brushColor: patch.color ?? s.brushColor,
      brushSize: patch.size ?? s.brushSize,
    })),

  updateElements: (patches) =>
    set((s) => ({
      ...record(s, Object.values(patches).every(isMove) ? 'history.move' : 'history.transform'),
      elements: s.elements.map((e) =>
        patches[e.id] ? ({ ...e, ...patches[e.id] } as CanvasElement) : e,
      ),
    })),

  updateElement: (id, patch) =>
    set((s) => {
      const label = editLabel(patch)
      return {
        // Coalesce rapid edits of one kind to the same element (slider drags, live typing).
        ...record(s, label, `${label}:${id}`),
        elements: s.elements.map((e) =>
          e.id === id ? ({ ...e, ...patch } as CanvasElement) : e,
        ),
      }
    }),

  updateFilters: (id, patch) =>
    set((s) => ({
      ...record(s, 'history.filters', 'filters:' + id),
      elements: s.elements.map((e) =>
        e.id === id && e.type === 'photo'
          ? { ...e, filters: { ...e.filters, ...patch } }
          : e,
      ),
    })),

  updateFilterStack: (id, stack) =>
    set((s) => ({
      ...record(s, 'history.filters', 'filterStack:' + id),
      elements: s.elements.map((e) =>
        e.id === id && e.type === 'photo'
          ? { ...e, filterStack: stack }
          : e,
      ),
    })),

  duplicateElement: (id) =>
    set((s) => {
      const el = s.elements.find((e) => e.id === id)
      if (!el) return {}
      const copy = {
        ...el,
        id: uid(),
        x: el.x + 40,
        y: el.y + 40,
        // photos keep the same object URL — it's just another reference.
        ...(el.type === 'photo' ? { filters: { ...el.filters } } : {}),
      } as CanvasElement
      return { elements: [...s.elements, copy], selectedId: copy.id, ...record(s, 'history.duplicate') }
    }),

  removeElement: (id) =>
    set((s) => {
      // Note: we intentionally do NOT revoke the photo's object URL here — undo
      // must be able to bring the element back with its bitmap intact. Blob URLs
      // are released on "New" and on page unload (see App.tsx).
      return {
        elements: s.elements.filter((e) => e.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        ...withoutFromGroup(s, [id]),
        ...record(s, 'history.delete'),
      }
    }),
  removeElements: (ids) =>
    set((s) => {
      if (!ids.length) return {}
      return {
        elements: s.elements.filter((e) => !ids.includes(e.id)),
        selectedId: s.selectedId && ids.includes(s.selectedId) ? null : s.selectedId,
        ...withoutFromGroup(s, ids),
        ...record(s, 'history.delete'),
      }
    }),
  select: (id) =>
    set((s) => {
      // Do not select locked elements
      const el = s.elements.find((e) => e.id === id)
      if (el?.locked) return {}
      return { selectedId: id, multiSelected: [] }
    }),

  toggleMultiSelect: (id) =>
    set((s) => {
      if (s.elements.find((e) => e.id === id)?.locked) return {}
      // Shift-clicking a second element extends the plain selection.
      const current = s.multiSelected.length
        ? s.multiSelected
        : s.selectedId
          ? [s.selectedId]
          : []
      const has = current.includes(id)
      const next = has ? current.filter((x) => x !== id) : [...current, id]
      return {
        multiSelected: next.length > 1 ? next : [],
        selectedId: has ? (next[next.length - 1] ?? null) : id,
      }
    }),

  selectMany: (ids) =>
    set((s) => {
      const picked = ids.filter((id) => {
        const el = s.elements.find((e) => e.id === id)
        return el && !el.locked && !el.hidden
      })
      return {
        multiSelected: picked.length > 1 ? picked : [],
        selectedId: picked[picked.length - 1] ?? null,
      }
    }),

  clearMultiSelect: () => set({ multiSelected: [] }),

  setCropping: (id) => set({ croppingId: id }),

  // z-order
  bringForward: (id) =>
    set((s) => {
      const i = s.elements.findIndex((e) => e.id === id)
      if (i < 0 || i === s.elements.length - 1) return {}
      const els = [...s.elements]
      ;[els[i], els[i + 1]] = [els[i + 1], els[i]]
      return { elements: els, ...record(s, 'history.order') }
    }),

  // move element one step backward
  sendBackward: (id) =>
    set((s) => {
      const i = s.elements.findIndex((e) => e.id === id)
      if (i <= 0) return {}
      const els = [...s.elements]
      ;[els[i - 1], els[i]] = [els[i], els[i - 1]]
      return { elements: els, ...record(s, 'history.order') }
    }),


  bringToFront: (id) =>
    set((s) => {
      const el = s.elements.find((e) => e.id === id)
      if (!el) return {}
      return { elements: [...s.elements.filter((e) => e.id !== id), el], ...record(s, 'history.order') }
    }),

  sendToBack: (id) =>
    set((s) => {
      const el = s.elements.find((e) => e.id === id)
      if (!el) return {}
      return { elements: [el, ...s.elements.filter((e) => e.id !== id)], ...record(s, 'history.order') }
    }),

  // visibility & lock actions
  setElementHidden: (id, hidden) =>
    set((s) => {
      return {
        elements: s.elements.map((e) => (e.id === id ? { ...e, hidden } : e)),
        ...(hidden ? deselect(s, id) : {}),
        ...record(s, 'history.visibility', 'hidden'),
      }
    }),
  setElementLocked: (id, locked) =>
    set((s) => {
      return {
        elements: s.elements.map((e) => (e.id === id ? { ...e, locked } : e)),
        ...(locked ? deselect(s, id) : {}),
        ...record(s, 'history.lock', 'locked'),
      }
    }),

  // grouping
  groupElements: (ids) =>
    set((s) => {
      if (ids.length < 2) return {}
      const groupId = uid()
      return {
        elements: s.elements.map((e) => (ids.includes(e.id) ? { ...e, groupId } : e)),
        ...record(s, 'history.group', 'group'),
      }
    }),
  ungroupElements: (groupId) =>
    set((s) => ({
      elements: s.elements.map((e) => (e.groupId === groupId ? { ...e, groupId: undefined } : e)),
      ...record(s, 'history.ungroup', 'ungroup'),
    })),

  // reorder
  setElements: (elements) =>
    set((s) => ({
      elements,
      ...record(s, 'history.order', 'reorder'),
    })),

  setBackground: (patch: Partial<Background>) =>
    set((s) => ({ background: { ...s.background, ...patch }, ...record(s, 'history.background', 'bg') })),

  setMode: (mode) => set((s) => ({ mode, multiSelected: [], ...record(s, 'history.layout') })),

  applyLayout: (layoutId: string, opts?: { boardSize?: { w: number; h: number } }) => {
    const { setGrid, setBoardSize, setMode } = get()
    // Validate layout exists before applying
    const layout = getGridById(layoutId) || getCustomLayoutById(layoutId)
    if (!layout) {
      console.error(`[applyLayout] Layout not found: ${layoutId}`)
      return
    }
    if (opts?.boardSize) {
      setBoardSize(opts.boardSize.w, opts.boardSize.h)
    }
    setMode('grid')
    setGrid(layoutId)
  },

  applyTemplate: (doc) =>
    set((s) => ({
      boardWidth: doc.boardWidth,
      boardHeight: doc.boardHeight,
      background: { ...DEFAULT_BACKGROUND, ...doc.background },
      mode: 'grid',
      gridId: doc.gridId,
      gridGap: doc.gridGap,
      gridRadius: doc.gridRadius,
      gridMargin: doc.gridMargin,
      frame: doc.frame,
      elements: [
        ...s.elements.filter((e) => e.type === 'photo'),
        ...doc.elements.map((e) => ({ ...e, id: uid() }) as CanvasElement),
      ],
      selectedId: null,
      multiSelected: [],
      galleryDismissed: true,
      ...record(s, 'history.template'),
    })),

  setGrid: (gridId) =>
    set((s) => ({
      gridId,
      mode: gridId ? 'grid' : 'free',
      selectedId: null,
      multiSelected: [],
      ...record(s, 'history.layout'),
    })),

  setGridGap: (gap) => set((s) => ({ gridGap: gap, ...record(s, 'history.spacing', 'gridGap') })),

  setGridMargin: (margin) =>
    set((s) => ({ gridMargin: margin, ...record(s, 'history.spacing', 'gridMargin') })),

  setGridRadius: (radius) =>
    set((s) => ({ gridRadius: radius, ...record(s, 'history.corners', 'gridRadius') })),

  setFrame: (patch) =>
    set((s) => ({ frame: { ...s.frame, ...patch }, ...record(s, 'history.frame', 'frame') })),

  setBoardSize: (width, height) =>
    set((s) => ({ boardWidth: width, boardHeight: height, ...record(s, 'history.boardSize', 'boardSize') })),

  clearAll: () =>
    set((s) => {
      s.elements.forEach((e) => {
        if (e.type === 'photo') {
          if (e.src?.startsWith('blob:')) URL.revokeObjectURL(e.src)
          if (e.previewSrc?.startsWith('blob:')) URL.revokeObjectURL(e.previewSrc)
          if (e.originalSrc?.startsWith('blob:')) URL.revokeObjectURL(e.originalSrc)
          if (e.thumbSrc?.startsWith('blob:')) URL.revokeObjectURL(e.thumbSrc)
        }
      })
      return {
        elements: [],
        selectedId: null,
        multiSelected: [],
        gridId: null,
        mode: 'free',
        galleryDismissed: false,
        frame: DEFAULT_FRAME,
        watermark: { ...DEFAULT_WATERMARK },
        print: { ...DEFAULT_PRINT_SETTINGS },
        past: [],
        future: [],
      }
    }),

  loadDocument: (doc) =>
    set({
      boardWidth: doc.boardWidth,
      boardHeight: doc.boardHeight,
      background: doc.background,
      mode: doc.mode,
      gridId: doc.gridId,
      gridGap: doc.gridGap,
      gridRadius: doc.gridRadius,
      gridMargin:
        typeof doc.gridMargin === 'number' && Number.isFinite(doc.gridMargin) ? doc.gridMargin : 0,
      frame: doc.frame,
      elements: doc.elements,
      selectedId: null,
      multiSelected: [],
      past: [],
      future: [],
      watermark: doc.watermark ? { ...DEFAULT_WATERMARK, ...doc.watermark } : { ...DEFAULT_WATERMARK },
      print: doc.print ? { ...DEFAULT_PRINT_SETTINGS, ...doc.print } : { ...DEFAULT_PRINT_SETTINGS },
    }),

  undo: () => get().travel(-1),
  redo: () => get().travel(1),

  travel: (steps) =>
    set((s) => {
      const n = Math.max(-s.past.length, Math.min(s.future.length, Math.trunc(steps)))
      if (!n) return {}
      lastKey = ''
      let next = s
      for (let i = 0; i < Math.abs(n); i++) next = n < 0 ? undoOnce(next) : redoOnce(next)
      return { ...next, selectedId: null, multiSelected: [] }
    }),

  copyStyle: (id) =>
    set((s) => {
      const el = s.elements.find((e) => e.id === id)
      return el ? { copiedStyle: styleOf(el, s.mode === 'grid') } : {}
    }),

  pasteStyle: (ids) =>
    set((s) => {
      const style = s.copiedStyle
      if (!style || !ids.length) return {}
      return {
        ...record(s, 'history.pasteStyle'),
        elements: s.elements.map((e) =>
          ids.includes(e.id)
            ? ({ ...e, ...stylePatch(style, e, s.mode === 'grid') } as CanvasElement)
            : e,
        ),
      }
    }),

  applyShapeToAll: (shape) =>
    set((s) => ({
      elements: s.elements.map((e) =>
        e.type === 'photo' ? { ...e, shape } : e,
      ),
      ...record(s, 'history.shape', 'shapeAll'),
    })),

  setCanvasZoom: (zoom) =>
    set((s) => ({ canvasZoom: Math.max(s.minCanvasZoom, Math.min(4, zoom)) })),
  setMinCanvasZoom: (v) => set({ minCanvasZoom: Math.min(0.25, Math.max(0.02, v)) }),
  setExporting: (v) => set({ exporting: v }),

  setWatermark: (patch) =>
    set((s) => ({ watermark: { ...s.watermark, ...patch }, ...record(s, 'history.watermark', 'watermark') })),
  setPrint: (patch) =>
    set((s) => ({ print: { ...s.print, ...patch }, ...record(s, 'history.print', 'print') })),

  splitCustomLayout: (pts, snapStep) =>
    commitZones(set, get, (zones) => splitZonesByStroke(zones, pts, { snapStep })),

  circleCustomLayout: (pts, overlay) =>
    commitZones(set, get, (zones) => circleZoneByStroke(zones, pts, { overlay })),

  mergeCustomLayoutCell: (index) =>
    commitZones(set, get, (zones) => mergeZoneInto(zones, index)),

  undoCustomLayout: () =>
    set((s) => {
      if (!s.customLayoutPast.length) return {}
      return {
        customLayoutZones: s.customLayoutPast[s.customLayoutPast.length - 1],
        customLayoutPast: s.customLayoutPast.slice(0, -1),
      }
    }),

  setGalleryDismissed: (v) => set({ galleryDismissed: v }),
  setAssignLayoutId: (id) => set({ assignLayoutId: id }),

  setCustomLayoutMode: (v, cells) =>
    set({
      customLayoutMode: v,
      mode: v ? 'custom-layout' : 'free',
      selectedId: null,
      multiSelected: [],
      // Entering the editor starts from a single full-board zone unless an
      // existing layout is handed in to keep editing.
      ...(v
        ? {
            customLayoutZones: cells?.length ? cellsToZones(cells) : [fullZone()],
            customLayoutPast: [],
          }
        : {}),
    }),
}))

// Dev-only handle so the editor state can be driven from the console / tests.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __editor?: typeof useEditor }).__editor = useEditor
}
