import { describe, it, expect, vi, afterEach } from 'vitest'
import { samplePhotos } from '../samplePhotos'

describe('samplePhotos', () => {
  afterEach(() => vi.restoreAllMocks())

  it('says so when there is no 2D canvas to paint on', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(samplePhotos()).rejects.toThrow(/2D canvas/)
  })
})
