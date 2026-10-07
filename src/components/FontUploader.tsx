import { useState, useRef, useEffect } from 'react'
import { useToasts } from './ToastContainer'
import { useT } from '../i18n/useLang'
import { saveCustomFont, loadCustomFonts, deleteCustomFont } from '../lib/fonts'

export function FontUploader({ onFontsChange }: { onFontsChange?: () => void }) {
  const t = useT()
  const toast = useToasts()
  const [fonts, setFonts] = useState<{ id: string; name: string; family: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Load saved fonts on mount
  useEffect(() => {
    loadCustomFonts().then((f) =>
      setFonts(f.map((x) => ({ id: x.id, name: x.name, family: x.family }))),
    )
  }, [])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    try {
      const font = await saveCustomFont(file.name.replace(/\.\w+$/, ''), file)
      setFonts((prev) => [...prev, { id: font.id, name: font.name, family: font.family }])
      toast.success(t('font.loaded'))
      onFontsChange?.()
    } catch {
      toast.error(t('font.loadFailed'))
    }
    input.value = ''
  }

  const handleDelete = async (id: string) => {
    await deleteCustomFont(id)
    setFonts((prev) => prev.filter((f) => f.id !== id))
    onFontsChange?.()
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        aria-label={t('font.upload')}
        tabIndex={-1}
        className="sr-only"
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-muted transition hover:text-text hover:border-accent"
      >
        ＋ {t('font.upload')}
      </button>

      {fonts.length > 0 && (
        <div className="flex flex-col gap-1">
          {fonts.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
              <span className="text-sm" style={{ fontFamily: f.family }}>{f.name}</span>
              <button
                onClick={() => handleDelete(f.id)}
                className="text-xs text-danger transition hover:opacity-70"
              >
                {t('font.remove')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
