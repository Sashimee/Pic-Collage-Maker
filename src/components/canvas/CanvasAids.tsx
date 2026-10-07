import { Line } from 'react-konva'
import { Magnet, Grid3x3, Ruler } from 'lucide-react'
import { useT } from '../../i18n/useLang'

export type GridType = 'dot' | 'line'

interface ToggleProps {
  hidden: boolean
  snapEnabled: boolean
  onSnapToggle: () => void
  showGrid: boolean
  onGridToggle: () => void
  gridType: GridType
  onGridTypeToggle: () => void
  showRulers: boolean
  onRulersToggle: () => void
}

/** The snap / grid / ruler toggle column at the canvas's top-left. */
export function CanvasAidToggles({
  hidden,
  snapEnabled,
  onSnapToggle,
  showGrid,
  onGridToggle,
  gridType,
  onGridTypeToggle,
  showRulers,
  onRulersToggle,
}: ToggleProps) {
  const t = useT()
  return (
    <div
      className={`absolute left-2 top-2 z-10 flex-col gap-1.5 ${
        hidden ? 'hidden' : 'flex'
      }`}
    >
      <button
        onClick={onSnapToggle}
        aria-label={t('canvas.snapToGuides')}
        aria-pressed={snapEnabled}
        title={t('canvas.snapToGuides')}
        className={`flex h-10 w-10 items-center justify-center rounded-xl shadow backdrop-blur transition ${
          snapEnabled ? 'bg-accent text-white' : 'bg-surface-2/90 text-muted hover:text-text'
        }`}
      >
        <Magnet size={18} />
      </button>
      <button
        onClick={onGridToggle}
        aria-label={t('canvas.toggleGrid')}
        aria-pressed={showGrid}
        title={t('canvas.toggleGrid')}
        className={`flex h-10 w-10 items-center justify-center rounded-xl shadow backdrop-blur transition ${
          showGrid ? 'bg-accent text-white' : 'bg-surface-2/90 text-muted hover:text-text'
        }`}
      >
        <Grid3x3 size={18} />
      </button>
      {showGrid && (
        <button
          onClick={onGridTypeToggle}
          aria-label={t(gridType === 'dot' ? 'canvas.gridDots' : 'canvas.gridLines')}
          title={t(gridType === 'dot' ? 'canvas.gridDots' : 'canvas.gridLines')}
          className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-surface-2/90 px-2 text-[0.65rem] font-semibold text-muted shadow backdrop-blur transition hover:text-text"
        >
          {t(gridType === 'dot' ? 'canvas.gridDots' : 'canvas.gridLines')}
        </button>
      )}
      <button
        onClick={onRulersToggle}
        aria-label={t('canvas.toggleRulers')}
        aria-pressed={showRulers}
        title={t('canvas.toggleRulers')}
        className={`flex h-10 w-10 items-center justify-center rounded-xl shadow backdrop-blur transition ${
          showRulers ? 'bg-accent text-white' : 'bg-surface-2/90 text-muted hover:text-text'
        }`}
      >
        <Ruler size={18} />
      </button>
    </div>
  )
}

interface GuideProps {
  boardWidth: number
  boardHeight: number
  showGrid: boolean
  gridType: GridType
  showRulers: boolean
}

/** Grid dots / lines and pixel rulers, drawn behind the board's elements. */
export function CanvasGuides({ boardWidth, boardHeight, showGrid, gridType, showRulers }: GuideProps) {
  const gridSpacing = 40
  const gridDots: { x: number; y: number }[] = []
  const gridLinesH: { x1: number; y1: number; x2: number; y2: number }[] = []
  const gridLinesV: { x1: number; y1: number; x2: number; y2: number }[] = []
  if (showGrid) {
    for (let x = 0; x <= boardWidth; x += gridSpacing) {
      for (let y = 0; y <= boardHeight; y += gridSpacing) {
        if (gridType === 'dot') {
          gridDots.push({ x, y })
        }
      }
      if (gridType === 'line') {
        gridLinesV.push({ x1: x, y1: 0, x2: x, y2: boardHeight })
      }
    }
    if (gridType === 'line') {
      for (let y = 0; y <= boardHeight; y += gridSpacing) {
        gridLinesH.push({ x1: 0, y1: y, x2: boardWidth, y2: y })
      }
    }
  }

  return (
    <>
      {showGrid && gridType === 'dot' &&
        gridDots.map((d, i) => (
          <Line
            key={`gd-${i}`}
            points={[d.x, d.y, d.x + 0.1, d.y + 0.1]}
            stroke="rgba(0,0,0,0.12)"
            strokeWidth={1.5}
            lineCap="round"
            listening={false}
          />
        ))}
      {showGrid && gridType === 'line' && (
        <>
          {gridLinesV.map((l, i) => (
            <Line
              key={`gv-${i}`}
              points={[l.x1, l.y1, l.x2, l.y2]}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={0.5}
              listening={false}
            />
          ))}
          {gridLinesH.map((l, i) => (
            <Line
              key={`gh-${i}`}
              points={[l.x1, l.y1, l.x2, l.y2]}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={0.5}
              listening={false}
            />
          ))}
        </>
      )}

      {showRulers && (
        <>
          {Array.from({ length: Math.floor(boardWidth / 100) + 1 }).map((_, i) => {
            const x = i * 100
            return (
              <Line
                key={`rt-${i}`}
                points={[x, 0, x, 12]}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth={0.5}
                listening={false}
              />
            )
          })}
          {Array.from({ length: Math.floor(boardHeight / 100) + 1 }).map((_, i) => {
            const y = i * 100
            return (
              <Line
                key={`rl-${i}`}
                points={[0, y, 12, y]}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth={0.5}
                listening={false}
              />
            )
          })}
        </>
      )}
    </>
  )
}
