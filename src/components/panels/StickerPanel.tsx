import { useState } from 'react'
import { useEditor } from '../../store/editorStore'
import { EMOJI_CATEGORIES } from '../../lib/emojis'

export function StickerPanel() {
  const addSticker = useEditor((s) => s.addSticker)
  const [catIndex, setCatIndex] = useState(0)
  const cat = EMOJI_CATEGORIES[catIndex]

  return (
    <div className="flex flex-col gap-2">
      <div className="scroll-x flex gap-1 overflow-x-auto pb-1">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.icon}
            onClick={() => setCatIndex(i)}
            title={c.label}
            className={`flex-shrink-0 rounded-lg px-2 py-2.5 text-xl transition active:scale-95 ${
              i === catIndex ? 'bg-surface-3 ring-1 ring-accent' : 'hover:bg-surface-2'
            }`}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
        {cat.emoji.map((e) => (
          <button
            key={e}
            onClick={() => addSticker(e)}
            className="rounded-lg py-2 text-2xl transition hover:bg-surface-2 active:scale-90"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
