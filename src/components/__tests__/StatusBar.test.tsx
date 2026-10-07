import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusBar } from '../StatusBar'
import { useGuides } from '../../store/guidesStore'

describe('StatusBar guide toggles', () => {
  beforeEach(() => {
    localStorage.clear()
    useGuides.setState({ rulers: false, centerLines: false, printArea: false, spacing: true })
  })

  it('shows each guide’s state as pressed or not', () => {
    render(<StatusBar />)
    const group = screen.getByRole('group', { name: 'Guides' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rulers' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Spacing hints' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles a guide on and off again', async () => {
    render(<StatusBar />)
    const centre = screen.getByRole('button', { name: 'Centre lines' })
    await userEvent.click(centre)
    expect(useGuides.getState().centerLines).toBe(true)
    expect(centre).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(centre)
    expect(useGuides.getState().centerLines).toBe(false)
  })

  it('remembers the choice across reloads', async () => {
    render(<StatusBar />)
    await userEvent.click(screen.getByRole('button', { name: 'Print safe area & bleed' }))
    const saved = JSON.parse(localStorage.getItem('pic-collage-guides') ?? '{}')
    expect(saved.state).toEqual({ rulers: false, centerLines: false, printArea: true, spacing: true })
  })
})
