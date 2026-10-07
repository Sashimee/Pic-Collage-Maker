import { BetweenVerticalStart, Crosshair, Ruler, Scan } from 'lucide-react'
import { useEditor } from '../store/editorStore'
import { useGuides, type Guides } from '../store/guidesStore'
import { useT } from '../i18n/useLang'

const GUIDE_TOGGLES: { key: keyof Guides; label: string; Icon: typeof Ruler }[] = [
  { key: 'rulers', label: 'guides.rulers', Icon: Ruler },
  { key: 'centerLines', label: 'guides.centerLines', Icon: Crosshair },
  { key: 'printArea', label: 'guides.printArea', Icon: Scan },
  { key: 'spacing', label: 'guides.spacing', Icon: BetweenVerticalStart },
]

export function StatusBar() {
  const t = useT()
  const boardWidth = useEditor((s) => s.boardWidth)
  const boardHeight = useEditor((s) => s.boardHeight)
  const elements = useEditor((s) => s.elements)
  const selected = useEditor((s) => s.selected?.())
  const guides = useGuides()

  const selectedInfo = selected
    ? `${selected.type === 'photo' ? '📷' : selected.type === 'text' ? '🔤' : selected.type === 'sticker' ? '🙂' : '🖊'} ${Math.round(selected.x)},${Math.round(selected.y)}`
    : t('panel.pickTool')

  return (
    <footer className="hidden sm:flex items-center justify-between gap-4 border-t border-border/60 bg-surface/80 px-4 py-1.5 text-[11px] text-muted backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span>{boardWidth} × {boardHeight} px</span>
        <span className="h-3 w-px bg-border" />
        <span>{elements.length} {elements.length === 1 ? 'layer' : 'layers'}</span>
        <span className="h-3 w-px bg-border" />
        <span className="truncate max-w-[12rem]">{selectedInfo}</span>
      </div>
      <div className="flex items-center gap-3">
        <div role="group" aria-label={t('guides.label')} className="-my-1 flex items-center gap-0.5">
          {GUIDE_TOGGLES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => guides.toggle(key)}
              aria-pressed={guides[key]}
              aria-label={t(label)}
              title={t(label)}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                guides[key] ? 'bg-accent text-white' : 'hover:bg-surface-2 hover:text-text'
              }`}
            >
              <Icon size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
        <span className="h-3 w-px bg-border" />
        <span className="opacity-60">Pic Collage v2</span>
      </div>
    </footer>
  )
}
