/**
 * Client-side face detection — lightweight fallback using brightness contrast.
 * Detects potential face regions by finding bright oval-shaped areas in upper half of image.
 * Falls back to center-crop when no face is detected.
 */

export interface FaceBox {
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

export async function detectFaces(src: string): Promise<FaceBox[]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    img.onload = () => {
      const boxes = findFaceRegions(img)
      resolve(boxes)
    }
    img.onerror = () => resolve([])
  })
}

export function findFaceRegions(img: HTMLImageElement): FaceBox[] {
  const w = img.naturalWidth
  const h = img.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data

  // Look for bright/skin-tone regions in upper 60% of image
  const sampleSize = Math.max(8, Math.floor(Math.min(w, h) / 50))
  const regions: { x: number; y: number; score: number }[] = []

  for (let y = Math.floor(h * 0.1); y < h * 0.7; y += sampleSize) {
    for (let x = Math.floor(w * 0.2); x < w * 0.8; x += sampleSize) {
      const i = (Math.floor(y) * w + Math.floor(x)) * 4
      const r = d[i]
      const g = d[i + 1]
      const b = d[i + 2]

      // Skin tone-ish detection: high red, medium green, lower blue
      const brightness = (r + g + b) / 3
      const skinScore = r > 80 && r > g && g > b * 0.8 && brightness > 60
        ? brightness
        : 0

      if (skinScore > 0) {
        regions.push({ x, y, score: skinScore })
      }
    }
  }

  if (regions.length < 3) return []

  // Find center of mass of skin regions
  let totalX = 0, totalY = 0, totalScore = 0
  for (const r of regions) {
    totalX += r.x * r.score
    totalY += r.y * r.score
    totalScore += r.score
  }

  const cx = totalX / totalScore
  const cy = totalY / totalScore

  // Estimate face size based on image dimensions
  const faceW = Math.min(w * 0.35, h * 0.35)
  const faceH = faceW * 1.25

  return [{
    x: Math.max(0, cx - faceW / 2),
    y: Math.max(0, cy - faceH / 2),
    width: faceW,
    height: faceH,
    confidence: 0.6,
  }]
}

export async function loadFaceModels(): Promise<void> {
  // No-op — client-side detection doesn't need model files
}

/** Compute crop rectangle that centers on detected faces, or center-crop if none. */
export function computeSmartCrop(
  faces: { x: number; y: number; width: number; height: number }[],
  imgW: number,
  imgH: number,
  aspect: number,
): { x: number; y: number; width: number; height: number } | undefined {
  if (!faces.length) return undefined

  // Center on the first face
  const face = faces[0]
  const cx = face.x + face.width / 2
  const cy = face.y + face.height / 2

  // Compute crop size preserving aspect ratio
  let cw = imgW
  let ch = imgW / aspect
  if (ch > imgH) {
    ch = imgH
    cw = imgH * aspect
  }

  let x = cx - cw / 2
  let y = cy - ch / 2

  // Clamp to image bounds
  x = Math.max(0, Math.min(x, imgW - cw))
  y = Math.max(0, Math.min(y, imgH - ch))

  return { x, y, width: cw, height: ch }
}

/**
 * The grid-cell pan (−1..1 per axis, as `PhotoElement.cellPan`) that brings
 * the faces as close to the middle of a cover-fitted cell as the photo's
 * overflow allows. No faces, no pan.
 */
export function facePan(
  faces: { x: number; y: number; width: number; height: number }[],
  imgW: number,
  imgH: number,
  cellAspect: number,
): { x: number; y: number } {
  if (!faces.length) return { x: 0, y: 0 }
  const left = Math.min(...faces.map((f) => f.x))
  const top = Math.min(...faces.map((f) => f.y))
  const right = Math.max(...faces.map((f) => f.x + f.width))
  const bottom = Math.max(...faces.map((f) => f.y + f.height))
  // In units of the shown image: a cover fit leaves overflow on one axis only.
  const shownW = Math.min(imgW, imgH * cellAspect)
  const shownH = Math.min(imgH, imgW / cellAspect)
  const axis = (centre: number, size: number, shown: number) => {
    const overflow = size - shown
    if (overflow <= 0) return 0
    return Math.max(-1, Math.min(1, (size - 2 * centre) / overflow))
  }
  return {
    x: axis((left + right) / 2, imgW, shownW),
    y: axis((top + bottom) / 2, imgH, shownH),
  }
}
