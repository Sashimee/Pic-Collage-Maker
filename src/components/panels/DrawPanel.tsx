import { useEditor } from '../../store/editorStore'
import { ColorField, Section, Slider } from '../ui'
import { useT } from '../../i18n/useLang'

const DRAW_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#6366f1', '#ec4899', '#111827', '#ffffff']

export function DrawPanel() {
  const t = useT()
  const brushColor = useEditor((s) => s.brushColor)
  const brushSize = useEditor((s) => s.brushSize)
  const setBrush = useEditor((s) => s.setBrush)

  return (
    <Section>
      <p className="text-xs text-muted">{t('draw.hint')}</p>
      <div className="flex flex-wrap gap-2">
        {DRAW_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setBrush({ color: c })}
            style={{ background: c }}
            className={`h-11 w-11 rounded-full border transition active:scale-90 ${
              brushColor === c ? 'border-accent ring-2 ring-accent' : 'border-border'
            }`}
          />
        ))}
      </div>
      <ColorField
        label={t('common.color')}
        value={brushColor}
        onChange={(v) => setBrush({ color: v })}
      />
      <Slider
        label={t('draw.size')}
        min={1}
        max={60}
        value={brushSize}
        onChange={(v) => setBrush({ size: v })}
      />
    </Section>
  )
}
