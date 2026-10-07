import { describe, it, expect } from 'vitest'
import { templateBlocker, templateFromBoard, type BoardState } from '../templates/fromBoard'
import {
  deleteUserTemplate,
  listUserTemplates,
  saveUserTemplate,
} from '../../services/localTemplates'
import { DEFAULT_FILTERS, type Background, type CanvasElement } from '../../types'

const background: Background = {
  type: 'solid',
  color: '#fde68a',
  gradientFrom: '#fff',
  gradientTo: '#000',
  gradientAngle: 90,
  patternId: 'dots',
  patternColor: '#000',
}

const base = { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 }
const photo: CanvasElement = {
  ...base,
  id: 'p1',
  type: 'photo',
  src: 'blob:x',
  width: 100,
  height: 100,
  filters: DEFAULT_FILTERS,
  cellIndex: 1,
}
const text: CanvasElement = {
  ...base,
  id: 't1',
  type: 'text',
  text: 'Summer',
  fontFamily: 'Poppins',
  fontSize: 80,
  fill: '#111',
  fontStyle: 'bold',
  groupId: 'g1',
}
const sticker: CanvasElement = { ...base, id: 's1', type: 'sticker', emoji: '🌴', fontSize: 120 }

const board = (patch: Partial<BoardState> = {}): BoardState => ({
  boardWidth: 1080,
  boardHeight: 1350,
  background,
  mode: 'grid',
  gridId: '4-grid',
  gridGap: 12,
  gridRadius: 8,
  gridMargin: 20,
  frame: { style: 'solid', color: '#fff', width: 0.03 },
  elements: [photo, text, sticker],
  ...patch,
})

describe('templateFromBoard', () => {
  it('keeps the layout, styling and words but not the photos', () => {
    const doc = templateFromBoard(board())!
    expect(doc).toMatchObject({
      boardWidth: 1080,
      boardHeight: 1350,
      gridId: '4-grid',
      gridGap: 12,
      gridRadius: 8,
      gridMargin: 20,
      frame: { style: 'solid' },
      background: { type: 'solid', color: '#fde68a' },
    })
    expect(doc.elements.map((e) => e.type)).toEqual(['text', 'sticker'])
  })

  it('drops ids and group links, which belong to this board', () => {
    const doc = templateFromBoard(board())!
    for (const e of doc.elements) {
      expect(e).not.toHaveProperty('id')
      expect(e).not.toHaveProperty('groupId')
    }
  })

  it('leaves hidden elements out', () => {
    const doc = templateFromBoard(board({ elements: [{ ...text, hidden: true }, sticker] }))!
    expect(doc.elements.map((e) => e.type)).toEqual(['sticker'])
  })

  it('turns a photo background into its plain colour, without the session-bound URL', () => {
    const doc = templateFromBoard(
      board({ background: { ...background, type: 'photo', photoSrc: 'blob:bg', photoId: 'bg1' } }),
    )!
    expect(doc.background.type).toBe('solid')
    expect(doc.background).not.toHaveProperty('photoSrc')
    expect(doc.background).not.toHaveProperty('photoId')
  })

  it('gives nothing in free mode or without a layout', () => {
    expect(templateFromBoard(board({ mode: 'free' }))).toBeUndefined()
    expect(templateFromBoard(board({ gridId: null }))).toBeUndefined()
  })

  it('refuses a drawn layout, whose id may not resolve later', () => {
    expect(templateFromBoard(board({ gridId: 'custom-uuid' }))).toBeUndefined()
    expect(templateBlocker({ mode: 'grid', gridId: 'custom-uuid' })).toBe('customLayout')
    expect(templateBlocker({ mode: 'free', gridId: '4-grid' })).toBe('needsLayout')
    expect(templateBlocker({ mode: 'grid', gridId: '4-grid' })).toBeNull()
  })

  it('defaults a missing margin to none', () => {
    expect(templateFromBoard(board({ gridMargin: undefined }))!.gridMargin).toBe(0)
  })
})

describe('local templates store', () => {
  it('saves, lists newest first and deletes', async () => {
    const doc = templateFromBoard(board())!
    await saveUserTemplate({ id: 'a', name: 'Old', createdAt: 1, doc })
    await saveUserTemplate({ id: 'b', name: 'New', createdAt: 2, doc })
    expect((await listUserTemplates()).map((t) => t.name)).toEqual(['New', 'Old'])

    await deleteUserTemplate('b')
    const left = await listUserTemplates()
    expect(left.map((t) => t.id)).toEqual(['a'])
    expect(left[0].doc).toEqual(doc)
    await deleteUserTemplate('a')
  })

  it('skips records that are malformed or from another schema', async () => {
    const doc = templateFromBoard(board())!
    await saveUserTemplate({ id: 'ok', name: 'Ok', createdAt: 1, doc })
    const { openDB } = await import('idb')
    const raw = await openDB('pic-collage-templates', 1)
    await raw.put('templates', {
      schema: 1,
      id: 'bad',
      name: 'Bad',
      createdAt: 2,
      doc: { ...doc, gridId: 7 },
    })
    await raw.put('templates', { id: 'old', name: 'Old', createdAt: 3, doc })
    raw.close()

    expect((await listUserTemplates()).map((t) => t.id)).toEqual(['ok'])
    for (const id of ['ok', 'bad', 'old']) await deleteUserTemplate(id)
  })
})
