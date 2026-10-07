export interface TextEditState {
  id: string
  value: string
  left: number
  top: number
  width: number
  fontSize: number
  fontFamily: string
  fill: string
}

interface Props {
  editing: TextEditState
  onChange: (next: TextEditState) => void
  onCommit: () => void
  onCancel: () => void
}

/** Inline text editor overlay (replaces window.prompt on double-tap). */
export function InlineTextEditor({ editing, onChange, onCommit, onCancel }: Props) {
  return (
    <textarea
      autoFocus
      value={editing.value}
      onChange={(e) => onChange({ ...editing, value: e.target.value })}
      onBlur={onCommit}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onCommit()
        } else if (e.key === 'Escape') {
          onCancel()
        }
      }}
      style={{
        left: editing.left,
        top: editing.top,
        width: editing.width,
        fontSize: editing.fontSize,
        fontFamily: editing.fontFamily,
        color: editing.fill,
        lineHeight: 1.1,
      }}
      className="absolute z-40 resize-none overflow-hidden rounded-md border-2 border-accent bg-surface/95 px-1 py-0.5 shadow-xl outline-none"
    />
  )
}
