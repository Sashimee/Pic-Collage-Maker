import { useEffect, useMemo, useRef, useState } from 'react'
import { Image as KonvaImage, Layer, Rect, Stage, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useEditor } from '../store/editorStore'
import { useImage } from '../hooks/useImage'
import { useT } from '../i18n/useLang'
import { BottomSheet } from './BottomSheet'
import { FlipHorizontal2, FlipVertical2 } from 'lucide-react'
import { PHOTO_SHAPES } from '../lib/shapes'
import { ASPECT_PRESETS, MAX_STRAIGHTEN, aspectBox, type AspectId } from '../lib/photoCrop'
import { Slider } from './ui'
import type { PhotoElement } from '../types'

interface Box {
  x: number
  y: number
  width: number
  height: number
}

// Inline "Crop & Shape" panel, opened from the SelectionBar for the selected
// photo. Rendered in the same bottom-sheet pattern as the other tool panels
// (not a full-screen modal) so the board stays visible underneath. Shape
// changes apply live via updateElement; the crop rectangle is only committed
// to the store when "Apply" is pressed.
export function CropOverlay() {
  const t = useT()
  const croppingId = useEditor((s) => s.croppingId)
  const setCropping = useEditor((s) => s.setCropping)
  const el = useEditor((s) =>
    s.elements.find((e) => e.id === s.croppingId && e.type === 'photo'),
  ) as PhotoElement | undefined
  const grid = useEditor((s) => s.mode === 'grid')

  return (
    <BottomSheet
      open={!!croppingId && !!el}
      title={t('crop.title')}
      onClose={() => setCropping(null)}
    >
      {el && <CropPanel el={el} grid={grid} />}
    </BottomSheet>
  )
}

const toggleClass = (on: boolean) =>
  `flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 text-sm transition active:scale-95 ${
    on ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-text/80 hover:bg-surface-3'
  }`

// Grid cells place a photo by cover-fit and pan, and their own cell shape
// clips it, so a grid photo gets the crop, aspect and flip but not the photo
// shape or straighten.
function CropPanel({ el, grid }: { el: PhotoElement; grid: boolean }) {
  const t = useT()
  const image = useImage(el.src)
  const setCropping = useEditor((s) => s.setCropping)
  const updateElement = useEditor((s) => s.updateElement)
  const rectRef = useRef<Konva.Rect>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const shape = el.shape ?? 'rect'

  // Fit the natural image into the available sheet width.
  const fit = useMemo(() => {
    if (!image) return { w: 0, h: 0, scale: 1 }
    const maxW = Math.min(window.innerWidth - 40, 480)
    const maxH = 300
    const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight)
    return { w: image.naturalWidth * scale, h: image.naturalHeight * scale, scale }
  }, [image])

  // Initial crop box (display coords) from an existing crop, else the whole image.
  const [box, setBox] = useState<Box | null>(null)
  const [aspect, setAspect] = useState<AspectId>('free')
  const ratio = ASPECT_PRESETS.find((p) => p.id === aspect)?.ratio ?? null
  useEffect(() => {
    if (!image || !fit.w) return
    if (el.crop) {
      setBox({
        x: el.crop.x * fit.scale,
        y: el.crop.y * fit.scale,
        width: el.crop.width * fit.scale,
        height: el.crop.height * fit.scale,
      })
    } else {
      setBox({ x: 0, y: 0, width: fit.w, height: fit.h })
    }
  }, [image, fit.w, fit.h, fit.scale, el.crop])

  // Attach the transformer to the crop rect once both exist.
  useEffect(() => {
    const tr = trRef.current
    const rect = rectRef.current
    if (tr && rect) {
      tr.nodes([rect])
      tr.getLayer()?.batchDraw()
    }
  }, [box])

  const clamp = (b: Box): Box => {
    let width = Math.min(b.width, fit.w)
    let height = Math.min(b.height, fit.h)
    if (ratio !== null) {
      width = Math.min(width, height * ratio)
      height = width / ratio
    }
    return {
      width,
      height,
      x: Math.max(0, Math.min(b.x, fit.w - width)),
      y: Math.max(0, Math.min(b.y, fit.h - height)),
    }
  }

  const apply = () => {
    if (!box) return
    const inv = 1 / fit.scale
    const crop = {
      x: box.x * inv,
      y: box.y * inv,
      width: box.width * inv,
      height: box.height * inv,
    }
    // Keep the on-board width; match the element height to the crop's aspect.
    const height = el.width * (crop.height / crop.width)
    updateElement(el.id, { crop, height })
    setCropping(null)
  }

  const chooseAspect = (id: AspectId) => {
    setAspect(id)
    const next = ASPECT_PRESETS.find((p) => p.id === id)?.ratio
    if (next && fit.w) setBox(aspectBox(next, fit.w, fit.h))
  }

  const reset = () => {
    setAspect('free')
    setBox({ x: 0, y: 0, width: fit.w, height: fit.h })
    if (el.straighten || el.flipX || el.flipY)
      updateElement(el.id, { straighten: 0, flipX: false, flipY: false })
  }

  return (
    <div className="flex flex-col gap-4">
      {!grid && (
        <div>
          <h3 className="mb-2.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
            {t('filter.shape')}
          </h3>
          <div className="flex items-center gap-2">
            {PHOTO_SHAPES.map((sh) => (
              <button
                key={sh.id}
                onClick={() => updateElement(el.id, { shape: sh.id })}
                title={t('shape.' + sh.id)}
                className={`flex h-11 w-11 items-center justify-center rounded-lg text-lg transition active:scale-90 ${
                  shape === sh.id
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text/80 hover:bg-surface-3'
                }`}
              >
                {sh.glyph}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
          {t('filter.crop')}
        </h3>
        <div role="group" aria-label={t('crop.aspect')} className="mb-3 flex flex-wrap gap-2">
          {ASPECT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={aspect === p.id}
              onClick={() => chooseAspect(p.id)}
              className={toggleClass(aspect === p.id)}
            >
              {p.label ?? t('crop.free')}
            </button>
          ))}
        </div>
        <div className="flex justify-center">
          {image && box && (
            <Stage width={fit.w} height={fit.h} className="rounded-lg shadow-lg">
              <Layer>
                <KonvaImage image={image} width={fit.w} height={fit.h} opacity={0.45} />
                <KonvaImage
                  image={image}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  crop={{
                    x: box.x / fit.scale,
                    y: box.y / fit.scale,
                    width: box.width / fit.scale,
                    height: box.height / fit.scale,
                  }}
                  listening={false}
                />
                <Rect
                  ref={rectRef}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  stroke="#6366f1"
                  strokeWidth={2}
                  draggable
                  onDragEnd={(e) =>
                    setBox((b) => (b ? clamp({ ...b, x: e.target.x(), y: e.target.y() }) : b))
                  }
                  onTransformEnd={() => {
                    const node = rectRef.current
                    if (!node) return
                    const next = clamp({
                      x: node.x(),
                      y: node.y(),
                      width: node.width() * node.scaleX(),
                      height: node.height() * node.scaleY(),
                    })
                    node.scaleX(1)
                    node.scaleY(1)
                    setBox(next)
                  }}
                />
                <Transformer
                  ref={trRef}
                  rotateEnabled={false}
                  keepRatio={ratio !== null}
                  enabledAnchors={
                    ratio !== null
                      ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                      : undefined
                  }
                  anchorSize={14}
                  borderStroke="#6366f1"
                  anchorStroke="#6366f1"
                  boundBoxFunc={(oldB, newB) => (newB.width < 24 || newB.height < 24 ? oldB : newB)}
                />
              </Layer>
            </Stage>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {!grid && (
          <Slider
            label={t('crop.straighten')}
            min={-MAX_STRAIGHTEN}
            max={MAX_STRAIGHTEN}
            step={0.5}
            value={el.straighten ?? 0}
            onChange={(v) => updateElement(el.id, { straighten: v })}
          />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={!!el.flipX}
            onClick={() => updateElement(el.id, { flipX: !el.flipX })}
            className={`${toggleClass(!!el.flipX)} flex-1 gap-2 text-center leading-tight`}
          >
            <FlipHorizontal2 size={18} aria-hidden />
            {t('crop.flipH')}
          </button>
          <button
            type="button"
            aria-pressed={!!el.flipY}
            onClick={() => updateElement(el.id, { flipY: !el.flipY })}
            className={`${toggleClass(!!el.flipY)} flex-1 gap-2 text-center leading-tight`}
          >
            <FlipVertical2 size={18} aria-hidden />
            {t('crop.flipV')}
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={reset}
          className="min-h-[44px] rounded-lg bg-surface-2 px-4 text-sm text-text transition hover:bg-surface-3 active:scale-95"
        >
          {t('crop.reset')}
        </button>
        <button
          onClick={apply}
          className="bg-grad-accent min-h-[44px] rounded-lg px-5 text-sm font-semibold text-white shadow-[var(--shadow-accent)] transition hover:brightness-110 active:scale-95"
        >
          {t('crop.apply')}
        </button>
      </div>
    </div>
  )
}
