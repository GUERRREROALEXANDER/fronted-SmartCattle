import type { MotionBlob } from './types'

const BACKGROUND_ALPHA = 0.05
const GHOST_ALPHA = 0.12
const STILL_DELTA = 6
const MOTION_THRESHOLD = 30
const MAX_COMPONENT_RATIO = 0.95

export function dilateMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  const output = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 0) continue

      const minY = Math.max(0, y - 1)
      const maxY = Math.min(height - 1, y + 1)
      const minX = Math.max(0, x - 1)
      const maxX = Math.min(width - 1, x + 1)
      for (let targetY = minY; targetY <= maxY; targetY++) {
        for (let targetX = minX; targetX <= maxX; targetX++) {
          output[targetY * width + targetX] = 1
        }
      }
    }
  }

  return output
}

export class BackgroundModel {
  private background: Float32Array | null = null
  private lastFrame: Float32Array | null = null

  reset(): void {
    this.background = null
    this.lastFrame = null
  }

  process(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
    const pixelCount = width * height
    if (!this.background || !this.lastFrame || this.background.length !== pixelCount) {
      this.background = new Float32Array(pixelCount)
      this.lastFrame = new Float32Array(pixelCount)
      for (let index = 0; index < pixelCount; index++) {
        const offset = index * 4
        const value = luminance(data[offset], data[offset + 1], data[offset + 2])
        this.background[index] = value
        this.lastFrame[index] = value
      }
      return new Uint8Array(pixelCount)
    }

    const mask = new Uint8Array(pixelCount)
    for (let index = 0; index < pixelCount; index++) {
      const offset = index * 4
      const value = luminance(data[offset], data[offset + 1], data[offset + 2])
      const previous = this.background[index]
      const foreground = Math.abs(value - previous) >= MOTION_THRESHOLD
      if (foreground) mask[index] = 1
      // Foreground pixels that did not change since the last frame are mostly the ghost an animal
      // leaves behind; learning them faster keeps boxes tight around the moving body.
      const still = Math.abs(value - this.lastFrame[index]) < STILL_DELTA
      const alpha = foreground && still ? GHOST_ALPHA : BACKGROUND_ALPHA
      this.background[index] = previous + alpha * (value - previous)
      this.lastFrame[index] = value
    }

    return dilateMask(mask, width, height)
  }
}

function luminance(red: number, green: number, blue: number): number {
  return 0.299 * red + 0.587 * green + 0.114 * blue
}

export function findConnectedComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  minArea = Math.ceil(width * height * 0.003),
): MotionBlob[] {
  const pixelCount = width * height
  if (pixelCount <= 0) return []

  const visited = new Uint8Array(pixelCount)
  const stack = new Int32Array(pixelCount)
  const blobs: MotionBlob[] = []
  const areaThreshold = Math.max(1, minArea)

  for (let start = 0; start < pixelCount; start++) {
    if (mask[start] === 0 || visited[start] !== 0) continue

    let stackSize = 0
    stack[stackSize++] = start
    visited[start] = 1
    const pushUnvisited = (index: number): void => {
      if (mask[index] === 0 || visited[index] !== 0) return
      visited[index] = 1
      stack[stackSize++] = index
    }

    let area = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0

    while (stackSize > 0) {
      const index = stack[--stackSize]
      const x = index % width
      const y = Math.floor(index / width)
      area++
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)

      if (x > 0) pushUnvisited(index - 1)
      if (x + 1 < width) pushUnvisited(index + 1)
      if (y > 0) pushUnvisited(index - width)
      if (y + 1 < height) pushUnvisited(index + width)
    }

    if (area < areaThreshold || area >= pixelCount * MAX_COMPONENT_RATIO) continue

    blobs.push({
      box: {
        x: minX / width,
        y: minY / height,
        w: (maxX - minX + 1) / width,
        h: (maxY - minY + 1) / height,
      },
      area: area / pixelCount,
    })
  }

  return blobs
}

export function mergeOverlappingBoxes(blobs: readonly MotionBlob[]): MotionBlob[] {
  const merged = blobs.map((blob) => ({ box: { ...blob.box }, area: blob.area }))

  let current = 0
  while (current < merged.length) {
    let candidate = current + 1
    while (candidate < merged.length) {
      if (!shouldMerge(merged[current].box, merged[candidate].box)) {
        candidate++
        continue
      }

      const first = merged[current]
      const second = merged[candidate]
      const left = Math.min(first.box.x, second.box.x)
      const top = Math.min(first.box.y, second.box.y)
      const right = Math.max(first.box.x + first.box.w, second.box.x + second.box.w)
      const bottom = Math.max(first.box.y + first.box.h, second.box.y + second.box.h)
      merged[current] = {
        box: { x: left, y: top, w: right - left, h: bottom - top },
        area: Math.min(1, first.area + second.area),
      }
      merged.splice(candidate, 1)
      candidate = current + 1
    }
    current++
  }

  return merged
}

function shouldMerge(first: MotionBlob['box'], second: MotionBlob['box']): boolean {
  const overlapX = Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x)
  const overlapY = Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y)
  if (overlapX >= 0 && overlapY >= 0) return true

  const gapX = Math.max(0, -overlapX)
  const gapY = Math.max(0, -overlapY)
  const minWidth = Math.min(first.w, second.w)
  const minHeight = Math.min(first.h, second.h)
  const closeX = gapX <= Math.max(0.01, minWidth * 0.2)
  const closeY = gapY <= Math.max(0.01, minHeight * 0.2)
  const alignedX = overlapX >= 0
    || Math.abs(first.x + first.w / 2 - second.x - second.w / 2) <= minWidth / 2
  const alignedY = overlapY >= 0
    || Math.abs(first.y + first.h / 2 - second.y - second.h / 2) <= minHeight / 2

  return (closeX && alignedY && gapY <= Math.max(0.01, minHeight * 0.1))
    || (closeY && alignedX && gapX <= Math.max(0.01, minWidth * 0.1))
}
