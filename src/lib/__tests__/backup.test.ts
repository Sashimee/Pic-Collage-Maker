import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BackupStorageError, InvalidBackupError, packBackup, restoreBackup } from '../projectFile'
import { getPhoto, putPhoto } from '../persistence'
import { listProjects, loadProject, saveProject, type Project } from '../../services/localProjects'
import type { LoadedDocument } from '../../store/editorStore'
import type { PhotoElement } from '../../types'

// In memory: fake-indexeddb hands back Blobs that jsdom's FileReader rejects.
const photoStore = new Map<string, Blob>()
let failWrites = false
vi.mock('../persistence', () => ({
  putPhoto: async (id: string, blob: Blob) => {
    // Like the real one, a failed write is swallowed.
    if (!failWrites) photoStore.set(id, blob)
  },
  getPhoto: async (id: string) => photoStore.get(id),
}))

const projectStore = new Map<string, Project>()
vi.mock('../../services/localProjects', () => ({
  listProjects: async () => [...projectStore.keys()],
  loadProject: async (id: string) => projectStore.get(id),
  saveProject: async (p: Project) => void projectStore.set(p.id, p),
}))

const page = (photoId?: string, bgId?: string): LoadedDocument => ({
  boardWidth: 1080,
  boardHeight: 1350,
  background: {
    type: bgId ? 'photo' : 'solid',
    color: '#fff',
    gradientFrom: '#6366f1',
    gradientTo: '#ec4899',
    gradientAngle: 45,
    patternId: 'dots',
    patternColor: '#6366f1',
    ...(bgId ? { photoId: bgId, photoSrc: 'blob:http://localhost/bg' } : {}),
  },
  mode: 'free',
  gridId: null,
  gridGap: 12,
  gridRadius: 0,
  frame: { style: 'none', color: '#fff', width: 0.04 },
  elements: photoId
    ? [
        {
          id: `el-${photoId}`,
          type: 'photo',
          x: 0,
          y: 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          width: 100,
          height: 100,
          src: 'blob:http://localhost/live',
          photoId,
          filters: {} as PhotoElement['filters'],
        } satisfies PhotoElement,
      ]
    : [],
})

const project = (id: string, name: string, pages: LoadedDocument[]): Project => ({
  id,
  name,
  createdAt: 100,
  updatedAt: 200,
  data: { schema: 2, pages, activePage: 0 },
})

const bytes = (text: string) => new Blob([text], { type: 'image/png' })
const json = (value: unknown) => new Blob([JSON.stringify(value)], { type: 'application/json' })

describe('backup', () => {
  beforeEach(() => {
    photoStore.clear()
    projectStore.clear()
    failWrites = false
    let n = 0
    URL.createObjectURL = () => `blob:http://localhost/rebuilt-${n++}`
  })

  it('round-trips every project, page and photo onto an empty device', async () => {
    await saveProject(project('p1', 'Trip', [page('a'), page(undefined, 'bg1')]))
    // A legacy record: `data` is the bare document.
    await saveProject({ ...project('p2', 'Old', []), data: page('b') })
    for (const key of ['a:orig', 'a:prev', 'a:thumb', 'bg1:bg', 'b:prev']) {
      await putPhoto(key, bytes(key))
    }
    await putPhoto('unused:prev', bytes('unused'))

    const { blob, count } = await packBackup()
    expect(count).toBe(2)
    const raw = JSON.parse(await blob.text())
    expect(Object.keys(raw.photos).sort()).toEqual([
      'a:orig',
      'a:prev',
      'a:thumb',
      'b:prev',
      'bg1:bg',
    ])
    expect(JSON.stringify(raw.projects)).not.toContain('blob:')

    photoStore.clear()
    projectStore.clear()
    expect(await restoreBackup(blob)).toBe(2)

    const restored = await Promise.all((await listProjects()).map((id) => loadProject(id)))
    expect(restored.map((p) => p?.name).sort()).toEqual(['Old', 'Trip'])
    const trip = restored.find((p) => p?.name === 'Trip')!
    expect(trip.createdAt).toBe(100)
    expect((trip.data as { pages: unknown[] }).pages).toHaveLength(2)
    expect(await (await getPhoto('a:prev'))?.text()).toBe('a:prev')
    expect(await (await getPhoto('bg1:bg'))?.text()).toBe('bg1:bg')
    expect(await getPhoto('unused:prev')).toBeUndefined()
  })

  it('adds restored projects next to existing ones instead of replacing them', async () => {
    await saveProject(project('p1', 'Trip', [page()]))
    const { blob } = await packBackup()
    await restoreBackup(blob)

    const ids = await listProjects()
    expect(ids).toHaveLength(2)
    expect(ids).toContain('p1')
  })

  it('packs an empty backup when nothing is saved', async () => {
    const { blob, count } = await packBackup()
    expect(count).toBe(0)
    expect(JSON.parse(await blob.text())).toMatchObject({ projects: [], photos: {} })
  })

  it('rejects a file that is not a backup, without writing anything', async () => {
    await expect(restoreBackup(new Blob(['nope']))).rejects.toThrow(InvalidBackupError)
    await expect(restoreBackup(json({ version: 1, project: { name: 'x' } }))).rejects.toThrow(
      'Not a Pic Collage backup',
    )
    await expect(
      restoreBackup(json({ format: 'piccollage-backup', version: 2, projects: [], photos: {} })),
    ).rejects.toThrow('Unsupported backup version')
    expect(projectStore.size).toBe(0)
  })

  it('checks every project and photo before writing any of them', async () => {
    const good = { name: 'Good', data: { schema: 2, pages: [page('a')], activePage: 0 } }
    await expect(
      restoreBackup(
        json({
          format: 'piccollage-backup',
          version: 1,
          projects: [good, { name: 'Empty', data: { pages: [] } }],
          photos: {},
        }),
      ),
    ).rejects.toThrow('"Empty" has no pages')
    await expect(
      restoreBackup(
        json({
          format: 'piccollage-backup',
          version: 1,
          projects: [good],
          photos: { 'a:prev': 'https://evil.example/beacon' },
        }),
      ),
    ).rejects.toThrow('not a data:image/ URL')
    expect(projectStore.size).toBe(0)
    expect(photoStore.size).toBe(0)
  })

  it('stops before adding projects whose photos could not be stored', async () => {
    await saveProject(project('p1', 'Trip', [page('a')]))
    await putPhoto('a:prev', bytes('a'))
    const { blob } = await packBackup()
    projectStore.clear()
    photoStore.clear()

    failWrites = true
    await expect(restoreBackup(blob)).rejects.toThrow(BackupStorageError)
    expect(projectStore.size).toBe(0)
  })
})
