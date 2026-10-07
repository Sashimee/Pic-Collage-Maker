import { describe, it, expect } from 'vitest'
import { placementCost, smartAssign, type FillPhoto } from '../../ai/smartFill'

const plain = (aspect: number): FillPhoto => ({ aspect, faces: [] })

describe('placementCost', () => {
  it('costs nothing when the cell has the photo’s shape', () => {
    expect(placementCost(plain(1.5), 1.5)).toEqual({ cost: 0, pan: { x: 0, y: 0 } })
  })

  it('charges the share the cover-fit crops away', () => {
    // A 2:1 photo in a square cell shows half of itself.
    expect(placementCost(plain(2), 1).cost).toBeCloseTo(0.5)
    expect(placementCost(plain(0.5), 1).cost).toBeCloseTo(0.5)
  })

  it('pans to a face near the edge so it stays whole', () => {
    // 2:1 photo, face at the far left; a square cell shows x 0..1 once panned left.
    const photo: FillPhoto = { aspect: 2, faces: [{ x: 0.1, y: 0.3, width: 0.3, height: 0.3 }] }
    const placed = placementCost(photo, 1)
    expect(placed.pan).toEqual({ x: 1, y: 0 })
    expect(placed.cost).toBeCloseTo(0.5)
  })

  it('charges for faces the crop still cuts', () => {
    // Faces at both ends of a 3:1 panorama cannot share a square frame.
    const photo: FillPhoto = {
      aspect: 3,
      faces: [
        { x: 0, y: 0.4, width: 0.2, height: 0.2 },
        { x: 2.8, y: 0.4, width: 0.2, height: 0.2 },
      ],
    }
    const { cost } = placementCost(photo, 1)
    expect(cost).toBeCloseTo(2 / 3 + 3 * 1)
  })
})

describe('smartAssign', () => {
  it('returns nothing for no photos', () => {
    expect(smartAssign([], [1, 1])).toEqual([])
  })

  it('seats each photo in the cell of its own shape', () => {
    const placements = smartAssign([plain(0.5), plain(2)], [2, 0.5])
    expect(placements.map((p) => p?.cell)).toEqual([1, 0])
  })

  it('keeps the current order when every cell is the same', () => {
    const placements = smartAssign([plain(1), plain(1.5), plain(0.7)], [1, 1, 1])
    expect(placements.map((p) => p?.cell)).toEqual([0, 1, 2])
  })

  it('leaves photos in their current cells around a gap when nothing fits better', () => {
    const placements = smartAssign(
      [
        { ...plain(1), current: 2 },
        { ...plain(1), current: 3 },
      ],
      [1, 1, 1, 1],
    )
    expect(placements.map((p) => p?.cell)).toEqual([2, 3])
  })

  it('still moves a photo out of its current cell when another fits better', () => {
    const placements = smartAssign(
      [
        { ...plain(0.5), current: 0 },
        { ...plain(2), current: 1 },
      ],
      [2, 0.5],
    )
    expect(placements.map((p) => p?.cell)).toEqual([1, 0])
  })

  it('moves a face-heavy panorama to the wide cell even when that costs another photo', () => {
    const panorama: FillPhoto = {
      aspect: 3,
      faces: [
        { x: 0.1, y: 0.4, width: 0.2, height: 0.2 },
        { x: 2.7, y: 0.4, width: 0.2, height: 0.2 },
      ],
    }
    const placements = smartAssign([panorama, plain(1)], [1, 3])
    expect(placements.map((p) => p?.cell)).toEqual([1, 0])
  })

  it('uses each cell once and leaves photos beyond the cell count out', () => {
    const placements = smartAssign([plain(1), plain(2), plain(0.5)], [2, 1])
    expect(placements[2]).toBeUndefined()
    expect(new Set(placements.slice(0, 2).map((p) => p?.cell))).toEqual(new Set([0, 1]))
  })

  it('leaves cells empty when there are fewer photos', () => {
    const placements = smartAssign([plain(2)], [1, 0.5, 2])
    expect(placements).toEqual([{ cell: 2, pan: { x: 0, y: 0 } }])
  })

  it('still places every photo once on a grid too big for the exact search', () => {
    const aspects = Array.from({ length: 16 }, (_, i) => 0.5 + (i % 5) * 0.3)
    const cells = [...aspects].reverse()
    const placements = smartAssign(aspects.map(plain), cells)
    const used = placements.map((p) => p!.cell)
    expect(new Set(used).size).toBe(16)
    placements.forEach((p, i) => expect(cells[p!.cell]).toBeCloseTo(aspects[i]))
  })

  it('is deterministic', () => {
    const photos = [plain(1.2), plain(0.8), plain(1.6), plain(0.9)]
    expect(smartAssign(photos, [1, 1.5, 0.75, 1.2])).toEqual(
      smartAssign(photos, [1, 1.5, 0.75, 1.2]),
    )
  })
})
