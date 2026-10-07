import { useEditor } from '../../store/editorStore'
import type { TextElement } from '../../types'
import { ColorField, Section, Slider } from '../ui'
import { useT } from '../../i18n/useLang'

const DEFAULT_CHIP = { color: '#fde68a', padding: 18, radius: 14 }

export function TextEffects({ text, selectedId }: { text: TextElement; selectedId: string }) {
  const t = useT()
  const update = useEditor((s) => s.updateElement)
  return (
    <Section title={t('text.effects')}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() =>
            update(selectedId, {
              shadowBlur: text.shadowBlur ? 0 : 14,
              shadowColor: text.shadowColor ?? '#000000',
            })
          }
          className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
            text.shadowBlur
              ? 'bg-accent text-accent-fg'
              : 'bg-surface-2 text-text/80 hover:bg-surface-3'
          }`}
        >
          {t('text.shadow')}
        </button>
        <button
          onClick={() =>
            update(selectedId, { chip: text.chip ? undefined : { ...DEFAULT_CHIP } })
          }
          className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
            text.chip
              ? 'bg-accent text-accent-fg'
              : 'bg-surface-2 text-text/80 hover:bg-surface-3'
          }`}
        >
          {t('text.chip')}
        </button>
        {text.chip && (
          <ColorField
            label={t('common.color')}
            value={text.chip.color}
            onChange={(v) => update(selectedId, { chip: { ...text.chip!, color: v } })}
          />
        )}
      </div>
      <Slider
        label={t('text.outline')}
        min={0}
        max={20}
        value={text.strokeWidth ?? 0}
        onChange={(v) =>
          update(selectedId, { strokeWidth: v, stroke: text.stroke ?? '#000000' })
        }
      />
      {(text.strokeWidth ?? 0) > 0 && (
        <ColorField
          label={t('text.outlineColor')}
          value={text.stroke ?? '#000000'}
          onChange={(v) => update(selectedId, { stroke: v })}
        />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() =>
            update(selectedId, {
              effects: {
                ...text.effects,
                glow: text.effects?.glow
                  ? undefined
                  : { color: '#ffffff', blur: 12 },
              },
            })
          }
          className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
            text.effects?.glow
              ? 'bg-accent text-accent-fg'
              : 'bg-surface-2 text-text/80 hover:bg-surface-3'
          }`}
        >
          Glow
        </button>
        <button
          onClick={() =>
            update(selectedId, {
              effects: {
                ...text.effects,
                extrude: text.effects?.extrude
                  ? undefined
                  : { depth: 4, color: '#000000' },
              },
            })
          }
          className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
            text.effects?.extrude
              ? 'bg-accent text-accent-fg'
              : 'bg-surface-2 text-text/80 hover:bg-surface-3'
          }`}
        >
          Extrude
        </button>
        <button
          onClick={() =>
            update(selectedId, {
              effects: {
                ...text.effects,
                gradient: text.effects?.gradient
                  ? undefined
                  : {
                      stops: [
                        { offset: 0, color: '#ec4899' },
                        { offset: 1, color: '#6366f1' },
                      ],
                    },
              },
            })
          }
          className={`min-h-[40px] rounded-lg px-3 text-sm transition active:scale-95 ${
            text.effects?.gradient
              ? 'bg-accent text-accent-fg'
              : 'bg-surface-2 text-text/80 hover:bg-surface-3'
          }`}
        >
          Gradient
        </button>
      </div>

      <Slider
        label={t('text.curve')}
        min={0}
        max={80}
        value={text.curve ?? 0}
        onChange={(v) => update(selectedId, { curve: v })}
      />
    </Section>
  )
}
