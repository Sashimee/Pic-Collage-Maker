import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LayerPanel from '../LayerPanel'
import { useEditor } from '../../store/editorStore'

function seed() {
  const s = useEditor.getState()
  s.clearAll()
  useEditor.setState({ past: [], future: [] })
  s.addPhoto('blob:a', 400, 300)
  s.addText()
  s.addSticker('🌟')
  s.select(null)
}

const ids = () => useEditor.getState().elements.map((e) => e.type)


describe('LayerPanel', () => {
  beforeEach(seed)

  it('lists layers top-first with a count', () => {
    render(<LayerPanel />)
    expect(screen.getByText('3')).toBeInTheDocument()
    const labels = screen
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'))
      .map((b) => b.textContent)
    expect(labels).toEqual(['🌟Sticker', '✏️Tap to edit', '🖼️Photo'])
  })

  it('renders an empty list without crashing', () => {
    useEditor.getState().clearAll()
    render(<LayerPanel />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(0)
  })

  it('selects a layer and marks it pressed', async () => {
    render(<LayerPanel />)
    await userEvent.click(screen.getByRole('button', { name: /^[^:]*Photo$/ }))
    const photo = useEditor.getState().elements.find((e) => e.type === 'photo')!
    expect(useEditor.getState().selectedId).toBe(photo.id)
    expect(screen.getByRole('button', { name: /^[^:]*Photo$/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles hidden and locked without selecting the layer', async () => {
    render(<LayerPanel />)
    await userEvent.click(screen.getAllByTitle('Hide')[0])
    await userEvent.click(screen.getAllByTitle('Lock')[0])
    const sticker = useEditor.getState().elements.find((e) => e.type === 'sticker')!
    expect(sticker.hidden).toBe(true)
    expect(sticker.locked).toBe(true)
    expect(useEditor.getState().selectedId).toBeNull()
    expect(screen.getAllByTitle('Show')).toHaveLength(1)
    expect(screen.getAllByTitle('Unlock')).toHaveLength(1)
  })

  it('moves a layer down the list (back in z-order) with ArrowDown', () => {
    render(<LayerPanel />)
    const [topGrip] = screen.getAllByRole('button', { name: 'Drag to reorder' })
    fireEvent.keyDown(topGrip, { key: 'ArrowDown' })
    expect(ids()).toEqual(['photo', 'sticker', 'text'])
  })

  it('moves a layer up the list (forward in z-order) with ArrowUp', () => {
    render(<LayerPanel />)
    const grips = screen.getAllByRole('button', { name: 'Drag to reorder' })
    fireEvent.keyDown(grips[2], { key: 'ArrowUp' })
    expect(ids()).toEqual(['text', 'photo', 'sticker'])
  })

  it('ignores moves past either end', () => {
    render(<LayerPanel />)
    const grips = screen.getAllByRole('button', { name: 'Drag to reorder' })
    fireEvent.keyDown(grips[0], { key: 'ArrowUp' })
    fireEvent.keyDown(grips[2], { key: 'ArrowDown' })
    expect(ids()).toEqual(['photo', 'text', 'sticker'])
    expect(within(document.body).getByText('3')).toBeInTheDocument()
  })
})
