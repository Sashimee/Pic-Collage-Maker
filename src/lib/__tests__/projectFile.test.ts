import { describe, it, expect, beforeEach, vi } from 'vitest'
import { packProject, unpackProject } from '../projectFile'
import { clearPersisted, getPhoto, putPhoto } from '../persistence'
import type { LoadedDocument } from '../../store/editorStore'
import type { PhotoElement } from '../../types'

// In memory: fake-indexeddb hands back Blobs that jsdom's FileReader rejects.
vi.mock('../persistence', () => {
  const store = new Map<string, Blob>()
  return {
    putPhoto: async (id: string, blob: Blob) => void store.set(id, blob),
    getPhoto: async (id: string) => store.get(id),
    clearPersisted: async () => store.clear(),
  }
})

describe('projectFile', () => {
  const sampleDoc: LoadedDocument = {
    boardWidth: 1080,
    boardHeight: 1350,
    background: { type: 'solid', color: '#fff', gradientFrom: '#6366f1', gradientTo: '#ec4899', gradientAngle: 45, patternId: 'dots', patternColor: '#6366f1' },
    mode: 'free',
    gridId: null,
    gridGap: 12,
    gridRadius: 0,
    frame: { style: 'none', color: '#fff', width: 0.04 },
    elements: [],
  }

  it('packs and unpacks a project', async () => {
    const blob = await packProject('Test', sampleDoc)
    expect(blob.type).toBe('application/json')

    const result = await unpackProject(blob)
    expect(result.name).toBe('Test')
    expect(result.doc.boardWidth).toBe(1080)
    expect(result.doc.background.type).toBe('solid')
  })

  it('throws on unsupported version', async () => {
    const badBlob = new Blob([JSON.stringify({ version: 99 })], { type: 'application/json' })
    await expect(unpackProject(badBlob)).rejects.toThrow('Unsupported')
  })

  it('rejects non-JSON input', async () => {
    const badBlob = new Blob(['not json'], { type: 'text/plain' })
    await expect(unpackProject(badBlob)).rejects.toThrow('not valid JSON')
  })

  it('rejects missing project.name', async () => {
    const badBlob = new Blob([JSON.stringify({ version: 1, project: {} })], { type: 'application/json' })
    await expect(unpackProject(badBlob)).rejects.toThrow('project.name')
  })

  it('rejects non-data URLs in photos (blocks HTTP egress)', async () => {
    const badBlob = new Blob([JSON.stringify({
      version: 1,
      project: { name: 'Evil', createdAt: 1, updatedAt: 1 },
      doc: sampleDoc,
      photos: { p1: 'https://evil.example/beacon' },
    })], { type: 'application/json' })
    await expect(unpackProject(badBlob)).rejects.toThrow('data:image/')
  })

  it('rejects missing doc.elements', async () => {
    const badBlob = new Blob([JSON.stringify({
      version: 1,
      project: { name: 'X', createdAt: 1, updatedAt: 1 },
      doc: {},
      photos: {},
    })], { type: 'application/json' })
    await expect(unpackProject(badBlob)).rejects.toThrow('doc.elements')
  })

  describe('photos', () => {
    let urls = 0
    beforeEach(async () => {
      urls = 0
      URL.createObjectURL = () => `blob:http://localhost/rebuilt-${++urls}`
      URL.revokeObjectURL = () => {}
      await clearPersisted()
    })

    const photo: PhotoElement = {
      id: 'e1',
      type: 'photo',
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      width: 100,
      height: 100,
      src: 'blob:http://localhost/saving-session',
      previewSrc: 'blob:http://localhost/saving-session',
      photoId: 'abc',
      filters: {} as PhotoElement['filters'],
    }
    const withPhotos: LoadedDocument = {
      ...sampleDoc,
      elements: [photo],
      background: { ...sampleDoc.background, type: 'photo', photoId: 'bg1', photoSrc: 'blob:http://localhost/bg' },
    }
    const bytes = (text: string) => new Blob([text], { type: 'image/png' })

    it('carries every stored variant and the background, and rebuilds them on another device', async () => {
      await putPhoto('abc:orig', bytes('orig'))
      await putPhoto('abc:prev', bytes('prev'))
      await putPhoto('abc:thumb', bytes('thumb'))
      await putPhoto('bg1:bg', bytes('bg'))
      const file = await packProject('Trip', withPhotos)

      const raw = JSON.parse(await file.text())
      expect(Object.keys(raw.photos).sort()).toEqual(['abc:orig', 'abc:prev', 'abc:thumb', 'bg1:bg'])
      expect(JSON.stringify(raw.doc)).not.toContain('blob:')

      await clearPersisted()
      const { doc } = await unpackProject(file)
      expect(await (await getPhoto('abc:prev'))?.text()).toBe('prev')
      expect(await (await getPhoto('bg1:bg'))?.text()).toBe('bg')
      const [el] = doc.elements as PhotoElement[]
      expect(el.src).toMatch(/^blob:http:\/\/localhost\/rebuilt-/)
      expect(doc.background.photoSrc).toMatch(/^blob:http:\/\/localhost\/rebuilt-/)
    })

    it('still opens when an original was stored without a type', async () => {
      await putPhoto('abc:orig', new Blob(['orig']))
      await putPhoto('abc:prev', bytes('prev'))
      const file = await packProject('Untyped', { ...sampleDoc, elements: [photo] })
      await clearPersisted()
      await unpackProject(file)
      expect(await (await getPhoto('abc:orig'))?.text()).toBe('orig')
    })

    it('rebuilds photos from a file that still carries dead blob: URLs', async () => {
      await putPhoto('abc:prev', bytes('prev'))
      const legacy = new Blob([
        JSON.stringify({
          version: 1,
          project: { name: 'Old', createdAt: 1, updatedAt: 1 },
          doc: withPhotos,
          photos: {},
        }),
      ])
      const [el] = (await unpackProject(legacy)).doc.elements as PhotoElement[]
      expect(el.src).toMatch(/rebuilt-/)
    })

    it('only stores photos the document points at', async () => {
      const file = new Blob([
        JSON.stringify({
          version: 1,
          project: { name: 'X', createdAt: 1, updatedAt: 1 },
          doc: sampleDoc,
          photos: { 'someone-else:prev': 'data:image/png;base64,AAAA' },
        }),
      ])
      await unpackProject(file)
      expect(await getPhoto('someone-else:prev')).toBeUndefined()
    })
  })

  it('rejects a missing doc.background', async () => {
    const badBlob = new Blob([JSON.stringify({
      version: 1,
      project: { name: 'X', createdAt: 1, updatedAt: 1 },
      doc: { elements: [] },
      photos: {},
    })], { type: 'application/json' })
    await expect(unpackProject(badBlob)).rejects.toThrow('doc.background')
  })
})
