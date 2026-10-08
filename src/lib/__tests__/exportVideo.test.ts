import { describe, expect, it } from 'vitest'
import { pickVideoFormat, slideAt, slideshowDuration, videoSize } from '../exportVideo'

describe('pickVideoFormat', () => {
  it('prefers MP4, which iOS can play', () => {
    expect(pickVideoFormat(() => true)?.extension).toBe('mp4')
  })

  it('falls back to WebM where only that records', () => {
    expect(pickVideoFormat((t) => t.startsWith('video/webm'))).toEqual({
      mimeType: 'video/webm;codecs=vp9',
      extension: 'webm',
    })
  })

  it('takes plain MP4 when the H.264 profile is not offered', () => {
    expect(pickVideoFormat((t) => t === 'video/mp4')?.mimeType).toBe('video/mp4')
  })

  it('returns null when nothing records', () => {
    expect(pickVideoFormat(() => false)).toBeNull()
  })
})

describe('slideAt', () => {
  const options = { secondsPerPage: 3, fadeSeconds: 1 }

  it('holds each page sharp until its fade', () => {
    expect(slideAt(0, 3, options)).toEqual({ page: 0, next: 1, mix: 0 })
    expect(slideAt(2, 3, options)).toEqual({ page: 0, next: 1, mix: 0 })
  })

  it('crossfades into the next page over the tail of its time', () => {
    expect(slideAt(2.5, 3, options).mix).toBeCloseTo(0.5)
    expect(slideAt(3, 3, options)).toEqual({ page: 1, next: 2, mix: 0 })
  })

  it('holds the last page to the end and past it', () => {
    expect(slideAt(8.9, 3, options)).toEqual({ page: 2, next: 2, mix: 0 })
    expect(slideAt(20, 3, options)).toEqual({ page: 2, next: 2, mix: 0 })
  })

  it('cuts without a fade', () => {
    expect(slideAt(2.9, 3, { secondsPerPage: 3, fadeSeconds: 0 })).toEqual({
      page: 0,
      next: 0,
      mix: 0,
    })
  })

  it('never fades for longer than a page lasts', () => {
    expect(slideAt(0, 2, { secondsPerPage: 1, fadeSeconds: 5 }).mix).toBe(0)
    expect(slideAt(0.5, 2, { secondsPerPage: 1, fadeSeconds: 5 }).mix).toBeCloseTo(0.5)
  })

  it('shows a single page throughout', () => {
    expect(slideAt(1, 1, options)).toEqual({ page: 0, next: 0, mix: 0 })
  })
})

describe('videoSize', () => {
  it('puts the long side at 1080 with even dimensions', () => {
    expect(videoSize([{ boardWidth: 1080, boardHeight: 1350 }])).toEqual({
      width: 864,
      height: 1080,
    })
    expect(videoSize([{ boardWidth: 1920, boardHeight: 1080 }])).toEqual({
      width: 1080,
      height: 608,
    })
  })

  it('follows the first page when pages differ', () => {
    expect(
      videoSize([
        { boardWidth: 1000, boardHeight: 1000 },
        { boardWidth: 1080, boardHeight: 1920 },
      ]),
    ).toEqual({ width: 1080, height: 1080 })
  })
})

it('runs for the page count times the time per page', () => {
  expect(slideshowDuration(4, { secondsPerPage: 3, fadeSeconds: 1 })).toBe(12)
})
