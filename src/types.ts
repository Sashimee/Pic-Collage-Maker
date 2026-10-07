// Core data model for the editor. Every visible item on the board is a
// `CanvasElement` — a discriminated union keyed by `type`. New element kinds
// (text, sticker, …) plug in here without touching the transform/selection code.

export type ElementType = 'photo' | 'text' | 'sticker' | 'drawing' | 'shape' | 'path' | 'group'

export interface BaseElement {
  id: string
  type: ElementType
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  /**
   * If true, the element is hidden from the canvas.
   */
  hidden?: boolean
  /**
   * If true, the element cannot be selected or edited.
   */
  locked?: boolean
  /**
   * Opacity 0..1 (default 1)
   */
  opacity?: number
  /**
   * Konva globalCompositeOperation blend mode.
   */
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  /**
   * The user's label for the layer; when unset the Layers panel describes it.
   */
  name?: string
  /**
   * If set, this element belongs to a group. Grouped items move together.
   */
  groupId?: string
}

export type FilterPreset =
  | 'none'
  | 'grayscale'
  | 'sepia'
  | 'vivid'
  | 'cool'
  | 'warm'
  | 'fade'
  | 'noir'
  | 'punch'

export interface PhotoFilters {
  brightness: number // Konva Brighten:  -1 .. 1
  contrast: number //   Konva Contrast: -100 .. 100
  saturation: number // Konva HSL:        -2 .. 10
  blur: number //       Konva Blur radius: 0 .. 40
  vignette: number //   dark-edge overlay strength: 0 .. 0.9
  preset: FilterPreset
}

// Non-AI "cutout": clip a photo into a decorative shape.
export type PhotoShape = 'rect' | 'circle' | 'star' | 'heart' | 'arch' | 'diamond' | 'cloud' | 'hexagon' | 'triangle'

// Source-pixel crop rectangle (Konva Image `crop`).
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PhotoStyling {
  borderWidth?: number
  borderColor?: string
  shadowBlur?: number
  shadowOffset?: number
  shadowColor?: string
  radius?: number // rect shape only
  polaroid?: boolean // rect shape only: a white card around the photo, deeper at the bottom
}

export interface PhotoElement extends BaseElement {
  type: 'photo'
  src: string // display source (usually the preview variant)
  photoId?: string // IndexedDB key prefix for the source blobs (persistence)
  previewSrc?: string // object URL for the 1080px preview variant
  originalSrc?: string // object URL for the original resolution variant
  thumbSrc?: string // object URL for the 256px thumbnail variant
  width: number // intrinsic display size (design units)
  height: number
  filters: PhotoFilters // legacy v1 — kept for backward compatibility
  filterStack?: FilterOperation[] // non-destructive v2
  shape?: PhotoShape // defaults to 'rect'
  crop?: CropRect // source-pixel crop; undefined = whole image
  straighten?: number // degrees, free mode only; the photo zooms to keep its frame covered
  flipX?: boolean
  flipY?: boolean
  styling?: PhotoStyling // free mode only
  // Per-cell framing in grid mode (ignored in free mode):
  /**
   * Grid slot this photo is pinned to. Unpinned photos fill the remaining
   * slots in array order, so tapping an empty cell can place a photo exactly
   * there instead of wherever the next free index happens to be.
   */
  cellIndex?: number
  cellZoom?: number // zoom within the cell, >= 1; default 1 = plain cover-fit
  cellPan?: { x: number; y: number } // normalised pan, each axis in [-1, 1]; default centred
}

export interface TextChip {
  color: string
  padding: number
  radius: number
}

export interface TextSpan {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: number
  fill?: string
}

export interface TextEffects {
  glow?: { color: string; blur: number }
  extrude?: { depth: number; color: string }
  gradient?: { stops: { offset: number; color: string }[] }
}

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontFamily: string
  fontSize: number
  fill: string
  fontStyle: string // 'normal' | 'bold' | 'italic' | 'bold italic'
  stroke?: string //       outline color
  strokeWidth?: number //  outline width (0 = none)
  shadowColor?: string
  shadowBlur?: number //   drop-shadow blur (0 = none)
  chip?: TextChip //       tape/scrapbook background behind the text
  curve?: number //        arch depth in px (0 = straight)
  // Multi-line support
  width?: number            // wrapping width in design units
  lineHeight?: number       // 1.2 default
  letterSpacing?: number    // extra px between characters (0 default)
  align?: 'left' | 'center' | 'right'
  // Rich text spans (if provided, render instead of single text string)
  spans?: TextSpan[]
  // Text-on-path SVG path data
  path?: string
  // Text effects
  effects?: TextEffects
}

export interface StickerElement extends BaseElement {
  type: 'sticker'
  emoji: string
  fontSize: number
}

export interface DrawingElement extends BaseElement {
  type: 'drawing'
  points: number[] // flat [x0,y0,x1,y1,…] in board units, relative to x/y
  stroke: string
  strokeWidth: number
}

export interface PathElement extends BaseElement {
  type: 'path'
  d: string // SVG path string
  stroke: string
  strokeWidth: number
  fill?: string
  closePath?: boolean
}

export type CanvasElement =
  | PhotoElement
  | TextElement
  | StickerElement
  | DrawingElement
  | PathElement
  | ShapeElement
  | GroupElement

// ---- Shape element --------------------------------------------------------

export type ShapeType =
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'arrow'
  | 'arrow-curved'
  | 'arrow-double'
  | 'speech-bubble'
  | 'star'
  | 'starburst'
  | 'ribbon'
  | 'heart'
  | 'cloud'
  | 'lightning'
  | 'custom'

export interface ShapeElement extends BaseElement {
  type: 'shape'
  shapeType: ShapeType
  fill: string
  stroke?: string
  strokeWidth?: number
  // For arrows
  arrowHead?: { size: number; style: 'triangle' | 'circle' | 'bar' }
  // For custom SVG path
  path?: string
  /** The shape library entry this came from; names the layer in the current language. */
  libraryId?: string
}

// ---- Group element ---------------------------------------------------------

export interface GroupElement extends BaseElement {
  type: 'group'
  children: CanvasElement[]  // nested elements
  expanded?: boolean        // layer panel state
}

// ---- Background ----------------------------------------------------------

export type BackgroundType = 'solid' | 'gradient' | 'pattern' | 'photo'

export type PatternId = 'dots' | 'stripes' | 'grid' | 'checker' | 'hearts'

export interface Background {
  type: BackgroundType
  color: string
  gradientFrom: string
  gradientTo: string
  gradientAngle: number // degrees, 0 = left→right
  patternId: PatternId
  patternColor: string // foreground/motif color (background uses `color`)
  photoSrc?: string // object URL for a full-board photo background
  photoId?: string // IndexedDB key for the source blob (persistence)
}

// ---- Board frame ---------------------------------------------------------

export type FrameStyle = 'none' | 'solid' | 'rounded' | 'polaroid'

export interface Frame {
  style: FrameStyle
  color: string
  width: number // fraction of the board's shorter axis (0..0.15)
}

// ---- Grid collage mode ---------------------------------------------------

export type EditorMode = 'free' | 'grid' | 'custom-layout'

export type GridCellShape =
  | 'rect'
  | 'circle'
  | 'rounded-rect'
  | 'ellipse'
  | 'polygon'
  | 'path'

export type LayoutCategory = 'classic' | 'editorial' | 'social' | 'creative' | 'custom'

// Cells are normalised to the 0..1 unit square and scaled to the board size.
export interface GridCell {
  x: number
  y: number
  width: number
  height: number
  /** Visual shape of this cell. Defaults to 'rect'. */
  shape?: GridCellShape
  /** Per-cell corner radius (design units). Overrides gridRadius for this cell. */
  cornerRadius?: number
  /** Normalised polygon vertices for shape='polygon'. Each vertex in 0..1. */
  polygon?: { x: number; y: number }[]
  /** SVG path string for shape='path'. Normalised to 0..1 viewBox. */
  path?: string
  /** Rotation in degrees, applied to the cell content. Default 0. */
  rotation?: number
}

export interface GridLayout {
  id: string
  label: string
  count: number
  cells: GridCell[]
  /** Gallery category for organisation. */
  category?: LayoutCategory
  /** Search tags (future). */
  tags?: string[]
  /** If true this layout was created by the user and is stored in localStorage. */
  isCustom?: boolean
}

export const DEFAULT_FILTERS: PhotoFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
  vignette: 0,
  preset: 'none',
}

export type FilterOperation =
  | { type: 'brightness'; value: number }
  | { type: 'contrast'; value: number }
  | { type: 'saturation'; value: number }
  | { type: 'hueShift'; value: number }
  | { type: 'exposure'; value: number }
  | { type: 'shadows'; value: number }
  | { type: 'highlights'; value: number }
  | { type: 'temperature'; value: number }
  | { type: 'tint'; value: number }
  | { type: 'preset'; id: FilterPreset }
  | { type: 'blur'; radius: number }
  | { type: 'vignette'; strength: number }
  | { type: 'levels'; black: number; white: number; gamma: number }
  | { type: 'curves'; channels: Partial<Record<ToneChannel, CurvePoint[]>> }
  | { type: 'hsl'; bands: Partial<Record<HslBand, HslAdjust>> }
  /** A 3D LUT as base64 RGB bytes, `size`³ entries with red varying fastest. */
  | { type: 'lut'; name: string; size: number; data: string; amount: number }

export type ToneChannel = 'rgb' | 'r' | 'g' | 'b'
/** [input, output], both 0..255. */
export type CurvePoint = [number, number]
export type HslBand = 'red' | 'orange' | 'yellow' | 'green' | 'aqua' | 'blue' | 'purple' | 'magenta'
/** Hue in degrees (−30..30); saturation and lightness −1..1. */
export interface HslAdjust {
  hue: number
  saturation: number
  lightness: number
}

export const DEFAULT_FILTER_STACK: FilterOperation[] = [
  { type: 'brightness', value: 0 },
  { type: 'contrast', value: 0 },
  { type: 'saturation', value: 0 },
  { type: 'preset', id: 'none' },
]

// ---- Watermark -----------------------------------------------------------

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

export interface WatermarkSettings {
  enabled: boolean
  text: string
  position: WatermarkPosition
  opacity: number // 0..1
  fontSize: number // px
  color: string
}

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: false,
  text: '',
  position: 'bottom-right',
  opacity: 0.5,
  fontSize: 24,
  color: '#ffffff',
}

// ---- Print Mode ----------------------------------------------------------

export interface PrintSettings {
  enabled: boolean
  bleedMarks: boolean
  cropMarks: boolean
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  enabled: false,
  bleedMarks: true,
  cropMarks: true,
}
