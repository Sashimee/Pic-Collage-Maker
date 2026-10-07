import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { useT } from '../i18n/useLang'
import { useTheme } from '../i18n/useTheme'
import { useEditor } from '../store/editorStore'
import { useSettings } from '../store/settingsStore'
import type { PanelTab } from './panels.config'
import { canCopyImage } from '../lib/exportImage'
import type { ExportKind } from './HeaderBar'

export interface Command {
  id: string
  label: string
  keys?: string[]
  /** False hides it from the palette; the shortcut list still shows it. */
  enabled?: boolean
  run: () => void
}

export interface CommandActions {
  tabs: PanelTab[]
  onExport: (kind: ExportKind) => void
  onExportSVG: () => void
  onOpenPanel: (id: string) => void
  onShortcutHelp: () => void
}

const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent)

export function formatKeys(keys: string[], mac = isMac()) {
  const names: Record<string, string> = mac
    ? { Mod: '⌘', Shift: '⇧', Alt: '⌥', Delete: '⌫', Escape: 'Esc' }
    : { Mod: 'Ctrl', Alt: 'Alt', Delete: 'Del', Escape: 'Esc' }
  return keys.map((k) => names[k] ?? k).join(mac ? '' : '+')
}

const editor = () => useEditor.getState()
const withSelection = (fn: (id: string) => void) => () => {
  const id = editor().selectedId
  if (id) fn(id)
}

const zoomBy = (step: number) => editor().setCanvasZoom(editor().canvasZoom + step)

export function useCommands({
  tabs,
  onExport,
  onExportSVG,
  onOpenPanel,
  onShortcutHelp,
}: CommandActions): Command[] {
  const t = useT()
  const theme = useTheme((s) => s.theme)
  const toggleTheme = useTheme((s) => s.toggleTheme)
  const exportFormat = useSettings((s) => s.exportFormat)
  const hasSelection = useEditor((s) => s.selectedId !== null)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const hasElements = useEditor((s) => s.elements.length > 0)
  const canPasteStyle = useEditor((s) => s.copiedStyle !== null)

  return [
    {
      id: 'undo',
      enabled: canUndo,
      label: t('header.undo'),
      keys: ['Mod', 'Z'],
      run: () => editor().undo(),
    },
    {
      id: 'redo',
      enabled: canRedo,
      label: t('header.redo'),
      keys: ['Mod', 'Shift', 'Z'],
      run: () => editor().redo(),
    },
    {
      id: 'select-all',
      enabled: hasElements,
      label: t('ctx.selectAll'),
      keys: ['Mod', 'A'],
      run: () => {
        const { elements, mode, selectMany } = editor()
        selectMany(
          elements.filter((el) => mode !== 'grid' || el.type !== 'photo').map((el) => el.id),
        )
      },
    },
    {
      id: 'duplicate',
      enabled: hasSelection,
      label: t('sel.duplicate'),
      keys: ['Mod', 'D'],
      run: withSelection((id) => editor().duplicateElement(id)),
    },
    {
      id: 'forward',
      enabled: hasSelection,
      label: t('sel.forward'),
      keys: ['Mod', ']'],
      run: withSelection((id) => editor().bringForward(id)),
    },
    {
      id: 'backward',
      enabled: hasSelection,
      label: t('sel.backward'),
      keys: ['Mod', '['],
      run: withSelection((id) => editor().sendBackward(id)),
    },
    {
      id: 'front',
      enabled: hasSelection,
      label: t('ctx.bringFront'),
      keys: ['Mod', 'Shift', ']'],
      run: withSelection((id) => editor().bringToFront(id)),
    },
    {
      id: 'back',
      enabled: hasSelection,
      label: t('ctx.sendBack'),
      keys: ['Mod', 'Shift', '['],
      run: withSelection((id) => editor().sendToBack(id)),
    },
    {
      id: 'copy-style',
      enabled: hasSelection,
      label: t('style.copy'),
      keys: ['Mod', 'Alt', 'C'],
      run: withSelection((id) => editor().copyStyle(id)),
    },
    {
      id: 'paste-style',
      enabled: hasSelection && canPasteStyle,
      label: t('style.paste'),
      keys: ['Mod', 'Alt', 'V'],
      run: withSelection((id) => {
        const { multiSelected, pasteStyle } = editor()
        pasteStyle(multiSelected.length > 1 ? multiSelected : [id])
      }),
    },
    {
      id: 'delete',
      enabled: hasSelection,
      label: t('sel.delete'),
      keys: ['Delete'],
      run: withSelection((id) => {
        const { multiSelected, removeElement, removeElements } = editor()
        if (multiSelected.length > 1) removeElements(multiSelected)
        else removeElement(id)
      }),
    },
    {
      id: 'deselect',
      enabled: hasSelection,
      label: t('cmd.deselect'),
      keys: ['Escape'],
      run: () => editor().select(null),
    },
    {
      id: 'export-png',
      label: t('export.png'),
      keys: exportFormat === 'png' ? ['Mod', 'E'] : undefined,
      run: () => onExport('png'),
    },
    {
      id: 'export-jpg',
      label: t('export.jpg'),
      keys: exportFormat === 'jpg' ? ['Mod', 'E'] : undefined,
      run: () => onExport('jpg'),
    },
    { id: 'export-pdf', label: t('export.pdf'), run: () => onExport('pdf') },
    { id: 'export-svg', label: t('export.svg'), run: onExportSVG },
    { id: 'export-book', label: t('export.book'), run: () => onExport('book') },
    {
      id: 'copy-image',
      enabled: canCopyImage(),
      label: t('export.copy'),
      keys: ['Mod', 'C'],
      run: () => onExport('copy'),
    },
    ...tabs.map((tab) => ({
      id: `panel-${tab.id}`,
      label: `${t('cmd.openPanel')}: ${t(tab.labelKey)}`,
      run: () => onOpenPanel(tab.id),
    })),
    { id: 'zoom-in', label: t('aria.zoomIn'), run: () => zoomBy(0.1) },
    { id: 'zoom-out', label: t('aria.zoomOut'), run: () => zoomBy(-0.1) },
    { id: 'zoom-reset', label: t('aria.resetZoom'), run: () => editor().setCanvasZoom(1) },
    {
      id: 'theme',
      label: t(theme === 'dark' ? 'header.dayMode' : 'header.nightMode'),
      run: toggleTheme,
    },
    { id: 'shortcuts', label: t('cmd.shortcuts'), keys: ['?'], run: onShortcutHelp },
  ]
}

export const matches = (label: string, query: string) => {
  const haystack = label.toLocaleLowerCase()
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}

// The option's own name already reads the shortcut out via aria-keyshortcuts.
const ariaKeys = (keys: string[]) =>
  keys.map((k) => (k === 'Mod' ? (isMac() ? 'Meta' : 'Control') : k)).join('+')

function Kbd({ keys, hidden }: { keys: string[]; hidden?: boolean }) {
  return (
    <kbd
      aria-hidden={hidden || undefined}
      className="shrink-0 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-xs text-muted"
    >
      {formatKeys(keys)}
    </kbd>
  )
}

// Keys stop here so the editor behind the dialog does not also act on them (Escape
// would otherwise clear the selection too). The search field is the exception: its
// own handler needs the key, and the editor's shortcuts already ignore text fields.
function Modal({
  labelledBy,
  onClose,
  onPalette,
  children,
}: {
  labelledBy: string
  onClose: () => void
  onPalette?: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const palette = useRef(onPalette)
  palette.current = onPalette

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close.current()
        return
      }
      const inField = e.target instanceof HTMLInputElement && !!dialog.current?.contains(e.target)
      if (inField) {
        if (e.key === 'Tab') e.preventDefault()
        return
      }
      e.stopPropagation()
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && palette.current) {
        e.preventDefault()
        palette.current()
        return
      }
      // A modified key would otherwise reach the browser's own shortcut (Ctrl+K: search).
      if (e.metaKey || e.ctrlKey) e.preventDefault()
      if (e.key === 'Tab') {
        e.preventDefault()
        const stops = [
          ...(dialog.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]') ?? []),
        ]
        const at = stops.findIndex((stop) => stop === document.activeElement)
        stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus()
      }
    }
    // A press on the dialog's padding or text would otherwise drop focus to <body>,
    // where the palette's keys no longer reach its search field.
    const onPress = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null
      if (
        target &&
        dialog.current?.contains(target) &&
        !target.closest('input, button, [tabindex="0"]')
      ) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onPress, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onPress, true)
    }
  }, [])

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="fixed left-1/2 top-[12vh] z-[100] flex max-h-[76vh] w-[min(34rem,92vw)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
      >
        {children}
      </div>
    </>
  )
}

export function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[]
  onClose: () => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const titleId = useId()
  const list = useRef<HTMLUListElement>(null)
  const results = useMemo(
    () => commands.filter((c) => c.enabled !== false && matches(c.label, query)),
    [commands, query],
  )
  const current = Math.min(active, results.length - 1)

  useEffect(() => {
    list.current?.children[current]?.scrollIntoView?.({ block: 'nearest' })
  }, [current])

  const run = (command: Command) => {
    onClose()
    command.run()
  }
  const pick = useRef((_index: number) => {})
  pick.current = (index) => {
    if (results[index]) run(results[index])
  }

  // Listened to natively: the search field owns the list's keyboard (aria-activedescendant),
  // so the list itself has no key handler to pair a React onClick with. Click rather than
  // mouse-down, so the release cannot land on whatever sits under the closed palette.
  useEffect(() => {
    const el = list.current
    if (!el) return
    const onClick = (e: MouseEvent) => {
      const option = e.target instanceof Element && e.target.closest('[role="option"]')
      if (option) pick.current([...el.children].indexOf(option))
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [])

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!results.length) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[current]) run(results[current])
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      onClose()
    }
  }

  const optionId = (i: number) => `${listId}-${i}`

  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="sr-only">
        {t('cmd.title')}
      </h2>
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results.length ? optionId(current) : undefined}
          aria-autocomplete="list"
          onKeyDown={onKeyDown}
          aria-label={t('cmd.title')}
          placeholder={t('cmd.placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-text outline-none placeholder:text-muted"
        />
      </div>
      <ul
        ref={list}
        id={listId}
        role="listbox"
        aria-label={t('cmd.title')}
        className="overflow-y-auto p-2"
      >
        {results.map((command, i) => (
          <li
            key={command.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === current}
            aria-keyshortcuts={command.keys && ariaKeys(command.keys)}
            data-command={command.id}
            onPointerMove={() => i !== current && setActive(i)}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
              i === current ? 'bg-accent/15 text-text ring-1 ring-inset ring-accent' : 'text-text'
            }`}
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">{command.label}</span>
            {command.keys && <Kbd keys={command.keys} hidden />}
          </li>
        ))}
      </ul>
      <p role="status" className={results.length ? 'sr-only' : 'px-4 pb-4 pt-2 text-sm text-muted'}>
        {results.length ? '' : t('cmd.empty')}
      </p>
    </Modal>
  )
}

export function ShortcutHelp({
  commands,
  onClose,
  onPalette,
}: {
  commands: Command[]
  onClose: () => void
  onPalette?: () => void
}) {
  const t = useT()
  const titleId = useId()
  const rows = [
    ...commands.filter((c) => c.keys && c.id !== 'shortcuts'),
    { id: 'nudge', label: t('cmd.nudge'), keys: ['←↑↓→'] },
    { id: 'palette', label: t('cmd.title'), keys: ['Mod', 'K'] },
  ]
  const list = useRef<HTMLDListElement>(null)

  // A tab stop only once the list outgrows the dialog, when a keyboard needs it to
  // scroll. Set on the node: as a prop, jsx-a11y reads a tabindex on a <dl> as a
  // misplaced control, while axe asks for exactly this on a scrollable region.
  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current
      if (!el) return
      if (el.scrollHeight > el.clientHeight) el.tabIndex = 0
      else el.removeAttribute('tabindex')
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <Modal labelledBy={titleId} onClose={onClose} onPalette={onPalette}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 id={titleId} className="text-base font-semibold text-text">
          {t('cmd.shortcuts')}
        </h2>
        <button
          autoFocus
          onClick={onClose}
          className="rounded-lg p-2.5 text-muted transition hover:bg-surface-2 hover:text-text"
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>
      </div>
      <dl ref={list} aria-labelledby={titleId} className="overflow-y-auto px-4 py-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <dt className="min-w-0 text-text [overflow-wrap:anywhere]">{row.label}</dt>
            <dd>{row.keys && <Kbd keys={row.keys} />}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}

export type CommandView = 'palette' | 'shortcuts'

export function CommandOverlay({
  view,
  onClose,
  onPalette,
  ...actions
}: CommandActions & { view: CommandView; onClose: () => void; onPalette: () => void }) {
  const commands = useCommands(actions)
  // Captured once for the overlay's life, so moving from the palette to the shortcut
  // list still returns focus to whatever opened the first of them. Restored on the
  // close path rather than in an effect cleanup, which StrictMode replays after the
  // dialog has focused its own control.
  const [opener] = useState(() => document.activeElement)
  const close = () => {
    onClose()
    if (opener instanceof HTMLElement) opener.focus()
  }
  return view === 'palette' ? (
    <CommandPalette commands={commands} onClose={close} />
  ) : (
    <ShortcutHelp commands={commands} onClose={close} onPalette={onPalette} />
  )
}
