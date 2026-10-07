import { forwardRef, useMemo, useRef, useState } from 'react'
import { Group, Layer, Line, Rect, Stage, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useEditor, type LoadedDocument } from '../store/editorStore'
import { useT } from '../i18n/useLang'
import { BoardScene, type BoardInteractions } from './BoardScene'
import type { CanvasElement } from '../types'
import { computeSnap, type SnapResult } from '../lib/snap'
import { CustomLayoutEditor } from './CustomLayoutEditor'
import { CustomLayoutToolbar } from './CustomLayoutToolbar'
import { useViewTransform } from './canvas/useViewTransform'
import { useStageGestures } from './canvas/useStageGestures'
import { useTransformerAttach } from './canvas/useTransformerAttach'
import { useExportHandle, type EditorHandle } from './canvas/useExportHandle'
import { useCustomLayoutTools } from './canvas/useCustomLayoutTools'
import { useCellPicker } from './canvas/useCellPicker'
import { CanvasAidToggles, CanvasGuides, SnapAids, type GridType } from './canvas/CanvasAids'
import { useGuides } from '../store/guidesStore'
import { InlineTextEditor, type TextEditState } from './canvas/InlineTextEditor'
import { CanvasErrorBridge } from './canvas/CanvasErrorBridge'
import { BoardColourPicker } from './canvas/BoardColourPicker'

export type { EditorHandle }

const NO_SNAP = { guides: [], spacing: [] }
const PLACEMENT_KEYS = new Set(['x', 'y', 'rotation', 'scaleX', 'scaleY'])
const isPlacement = (patch: Partial<CanvasElement>) =>
  Object.keys(patch).every((k) => PLACEMENT_KEYS.has(k))

export interface EditorCanvasProps {
  /**
   * Fraction of the canvas height (0..1) hidden behind an overlaying panel
   * sheet. The board is fitted above it so a photo at the bottom of the
   * collage stays visible — and adjustable — while its panel is open.
   */
  bottomInset?: number
}

export const EditorCanvas = forwardRef<EditorHandle, EditorCanvasProps>(({ bottomInset = 0 }, ref) => {
  const t = useT()
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const boardRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)

  const [snapGuides, setSnapGuides] = useState<Pick<SnapResult, 'guides' | 'spacing'>>(NO_SNAP)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [gridType, setGridType] = useState<GridType>('dot')
  const guides = useGuides()

  const boardWidth = useEditor((s) => s.boardWidth)
  const boardHeight = useEditor((s) => s.boardHeight)
  const background = useEditor((s) => s.background)
  const frame = useEditor((s) => s.frame)
  const elements = useEditor((s) => s.elements)
  const mode = useEditor((s) => s.mode)
  const gridId = useEditor((s) => s.gridId)
  const gridGap = useEditor((s) => s.gridGap)
  const setGridGap = useEditor((s) => s.setGridGap)
  const gridRadius = useEditor((s) => s.gridRadius)
  const gridMargin = useEditor((s) => s.gridMargin)
  const selectedId = useEditor((s) => s.selectedId)
  const select = useEditor((s) => s.select)
  const toggleMultiSelect = useEditor((s) => s.toggleMultiSelect)
  const updateElement = useEditor((s) => s.updateElement)
  const updateElements = useEditor((s) => s.updateElements)
  const multiSelected = useEditor((s) => s.multiSelected)
  const brushColor = useEditor((s) => s.brushColor)
  const brushSize = useEditor((s) => s.brushSize)
  const customLayoutZones = useEditor((s) => s.customLayoutZones)
  const customLayoutPast = useEditor((s) => s.customLayoutPast)

  const { size, tf, setTf, zoomAtPoint } = useViewTransform(hostRef, bottomInset)
  const { drawMode, liveStroke, marquee, stageHandlers } = useStageGestures({
    stageRef,
    tf,
    setTf,
    zoomAtPoint,
    onBackgroundPress: () => setSnapGuides(NO_SNAP),
  })
  useTransformerAttach(trRef, stageRef)
  useExportHandle(ref, hostRef, boardRef, tf)
  const layoutTools = useCustomLayoutTools()
  const cellPicker = useCellPicker()

  const [editing, setEditing] = useState<TextEditState | null>(null)
  const [canvasError, setCanvasError] = useState<Error | null>(null)

  // The Transformer moves the rest of a multi-selection itself and fires
  // drag/transform end per node in one synchronous loop; commit the whole
  // group from the nodes once, so it is one undo step.
  const groupCommitQueued = useRef(false)
  const commitGroup = () => {
    if (groupCommitQueued.current) return
    groupCommitQueued.current = true
    queueMicrotask(() => {
      groupCommitQueued.current = false
      // Only what the Transformer holds actually moved; a grid cell can share
      // an element's id, and its cell-local placement must never be written back.
      const patches: Record<string, Partial<CanvasElement>> = {}
      for (const node of trRef.current?.nodes() ?? []) {
        patches[node.id()] = {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
        }
      }
      updateElements(patches)
    })
  }

  const handleDragMove = (el: CanvasElement) => (e: Konva.KonvaEventObject<DragEvent>) => {
    // Snapping one node of a group would shear it away from the others.
    if (!snapEnabled || e.evt?.shiftKey || multiSelected.length > 1) {
      setSnapGuides(NO_SNAP)
      return
    }
    const node = e.target
    const currentX = node.x()
    const currentY = node.y()
    const result = computeSnap(
      el,
      elements,
      boardWidth,
      boardHeight,
      currentX,
      currentY,
      { spacing: guides.spacing },
    )
    if (result.x !== currentX) node.x(result.x)
    if (result.y !== currentY) node.y(result.y)
    setSnapGuides(result)
  }

  // BoardScene draws from a document rather than from the store, so the same
  // component can render a page that is not the one being edited (the photo
  // book). Here that document is just the live editor state.
  const liveDoc: LoadedDocument = useMemo(
    () => ({
      boardWidth,
      boardHeight,
      background,
      mode,
      gridId,
      gridGap,
      gridRadius,
      gridMargin,
      frame,
      elements,
    }),
    [boardWidth, boardHeight, background, mode, gridId, gridGap, gridRadius, gridMargin, frame, elements],
  )

  const interactions: BoardInteractions = {
    selectedId,
    onSelect: (id, e) => {
      if (e?.evt?.shiftKey) toggleMultiSelect(id)
      else select(id)
    },
    onChange: (id, patch) => {
      if (multiSelected.length > 1 && multiSelected.includes(id) && isPlacement(patch)) commitGroup()
      else updateElement(id, patch)
    },
    onEditText: (id) => openTextEditor(id),
    onDragMove: (el) => handleDragMove(el),
    onEmptyCell: cellPicker.open,
  }

  const openTextEditor = (id: string) => {
    const stage = stageRef.current
    const node = stage?.findOne('#' + id)
    const el = useEditor.getState().elements.find((x) => x.id === id)
    if (!stage || !node || el?.type !== 'text') return
    const rect = node.getClientRect({ relativeTo: stage })
    setEditing({
      id,
      value: el.text,
      left: rect.x,
      top: rect.y,
      width: Math.max(rect.width, 120),
      fontSize: el.fontSize * tf.scale,
      fontFamily: el.fontFamily,
      fill: el.fill,
    })
  }

  const commitEdit = () => {
    if (editing) updateElement(editing.id, { text: editing.value })
    setEditing(null)
  }

  if (canvasError) throw canvasError

  return (
    <div ref={hostRef} className="canvas-host relative h-full w-full">
      {/* Opened programmatically when an empty cell is tapped, so there is no
          visible label to associate — aria-label is the only route. */}
      <input
        ref={cellPicker.inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label={t('header.addPhotos')}
        onChange={cellPicker.onChange}
      />
      {mode === 'custom-layout' && (
        <CustomLayoutToolbar
          demoNonce={layoutTools.demoNonce}
          snapEnabled={layoutTools.snapEnabled}
          canUndo={customLayoutPast.length > 0}
          zoneCount={customLayoutZones.length}
          gap={gridGap}
          tool={layoutTools.tool}
          circleOverlay={layoutTools.circleOverlay}
          onToolChange={layoutTools.setTool}
          onCircleOverlayToggle={layoutTools.toggleCircleOverlay}
          onGapChange={setGridGap}
          onUndo={() => useEditor.getState().undoCustomLayout()}
          onClear={() => {
            const s = useEditor.getState()
            // Re-entering the mode resets to a single full-board zone.
            s.setCustomLayoutMode(true)
          }}
          onSnapToggle={layoutTools.toggleSnap}
          onApply={layoutTools.apply}
          onCancel={() => {
            useEditor.getState().setCustomLayoutMode(false)
          }}
        />
      )}
      <CanvasAidToggles
        hidden={mode === 'custom-layout'}
        snapEnabled={snapEnabled}
        onSnapToggle={() => setSnapEnabled((v) => !v)}
        showGrid={showGrid}
        onGridToggle={() => setShowGrid((v) => !v)}
        gridType={gridType}
        onGridTypeToggle={() => setGridType((g) => (g === 'dot' ? 'line' : 'dot'))}
        showRulers={guides.rulers}
        onRulersToggle={() => guides.toggle('rulers')}
      />

      {size.w > 0 && (
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          {...stageHandlers}
          onDragEnd={() => setSnapGuides(NO_SNAP)}
          style={{ cursor: drawMode ? 'crosshair' : 'default' }}
        >
          <Layer>
            <CanvasErrorBridge onError={setCanvasError}>
            <Group ref={boardRef} x={tf.x} y={tf.y} scaleX={tf.scale} scaleY={tf.scale}>
              {/* In draw mode elements ignore hits so strokes land on the stage. */}
              <Group listening={!drawMode}>
                <BoardScene
                  doc={liveDoc}
                  interactions={interactions}
                  overlay={
                    <>
                    <SnapAids guides={snapGuides.guides} spacing={snapGuides.spacing} />

                    {liveStroke && (
                      <Line
                        points={liveStroke}
                        stroke={brushColor}
                        strokeWidth={brushSize}
                        lineCap="round"
                        lineJoin="round"
                        tension={0.4}
                        listening={false}
                      />
                    )}
                    </>
                  }
                  backdrop={
                    <>
                    <CanvasGuides
                      boardWidth={boardWidth}
                      boardHeight={boardHeight}
                      showGrid={showGrid}
                      gridType={gridType}
                      showRulers={guides.rulers}
                      centerLines={guides.centerLines}
                      printArea={guides.printArea}
                    />
                    {mode === 'custom-layout' && (
                      <CustomLayoutEditor
                        boardWidth={boardWidth}
                        boardHeight={boardHeight}
                        zones={customLayoutZones}
                        gap={gridGap}
                        tool={layoutTools.tool}
                        onStroke={layoutTools.onStroke}
                        onTapZone={layoutTools.onTapZone}
                        tf={tf}
                        snapEnabled={layoutTools.snapEnabled}
                      />
                    )}
                    </>
                  }
                />
              </Group>

            </Group>
            <Transformer
              ref={trRef}
              rotateEnabled
              anchorSize={16}
              anchorCornerRadius={8}
              anchorStroke="#6366f1"
              borderStroke="#6366f1"
              borderStrokeWidth={2}
              rotateAnchorOffset={34}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
              }
            />
            {marquee && (
              <Rect
                {...marquee}
                fill="rgba(99,102,241,0.12)"
                stroke="#6366f1"
                strokeWidth={1}
                dash={[4, 4]}
                listening={false}
              />
            )}
            </CanvasErrorBridge>
          </Layer>
        </Stage>
      )}
      {editing && (
        <InlineTextEditor
          editing={editing}
          onChange={setEditing}
          onCommit={commitEdit}
          onCancel={() => setEditing(null)}
        />
      )}
      <BoardColourPicker hostRef={hostRef} />
    </div>
  )
})

EditorCanvas.displayName = 'EditorCanvas'
