import { isBottomCenterOutside } from './geometry'
import type { Box, Detection, DetectionClass, MotionBlob, Point } from './types'

const BOX_SMOOTHING = 0.45
const MAX_UNSEEN_SEC = 1
const CLASS_VOTE_WEIGHT = 0.25
const EDGE_MARGIN = 0.01

interface Track {
  /** Assigned on confirmation, so discarded fragments never consume visible ids. */
  id: string | null
  hits: number
  box: Box
  cls: DetectionClass
  /** Running vote for 'person' (0..1) so one odd blob shape does not flip the class. */
  personScore: number
  confidence: number
  ageSec: number
  unseenSec: number
}

interface MatchCandidate {
  trackIndex: number
  blobIndex: number
  score: number
}

export function classifyBlob(box: Box): DetectionClass {
  const aspectRatio = box.h / Math.max(box.w, Number.EPSILON)
  const hasPersonSize = box.h >= 0.08 && box.w * box.h >= 0.002
  return aspectRatio > 1.3 && hasPersonSize ? 'person' : 'cattle'
}

export function confidenceForTrack(box: Box, ageSec: number, trackId: string, timeSec: number): number {
  const sizeScore = Math.min(1, Math.sqrt(Math.max(0, box.w * box.h)) / 0.3)
  const ageScore = Math.min(1, Math.max(0, ageSec) / 2)
  const base = 0.72 + sizeScore * 0.16 + ageScore * 0.07
  return Math.min(0.97, Math.max(0.72, base + deterministicJitter(trackId, timeSec)))
}

export class DetectionTracker {
  private tracks: Track[] = []

  /** minHits observations are required before a track is reported (filters one-off motion noise). */
  constructor(private readonly minHits = 1) {}
  private nextId = 1
  private lastTimeSec: number | null = null

  reset(): void {
    this.clearTracks()
    this.nextId = 1
  }

  /** Drops current tracks but keeps the id counter, so ids are never reused within one analysis. */
  clearTracks(): void {
    this.tracks = []
    this.lastTimeSec = null
  }

  update(blobs: readonly MotionBlob[], timeSec: number, zone: readonly Point[]): Detection[] {
    const elapsedSec = this.lastTimeSec === null ? 0 : Math.max(0, timeSec - this.lastTimeSec)
    this.lastTimeSec = timeSec

    this.tracks = this.tracks.filter((track) => {
      track.ageSec += elapsedSec
      track.unseenSec += elapsedSec
      return track.unseenSec <= MAX_UNSEEN_SEC
    })

    const candidates: MatchCandidate[] = []
    for (let trackIndex = 0; trackIndex < this.tracks.length; trackIndex++) {
      for (let blobIndex = 0; blobIndex < blobs.length; blobIndex++) {
        const trackBox = this.tracks[trackIndex].box
        const blobBox = blobs[blobIndex].box
        const overlap = intersectionOverUnion(trackBox, blobBox)
        const distance = centerDistance(trackBox, blobBox)
        const diagonal = Math.max(boxDiagonal(trackBox), boxDiagonal(blobBox), 0.001)
        const closeEnough = distance <= Math.max(0.08, diagonal * 0.75)
        if (overlap < 0.05 && !closeEnough) continue

        candidates.push({
          trackIndex,
          blobIndex,
          score: overlap * 2 + Math.max(0, 1 - distance / Math.max(0.08, diagonal)),
        })
      }
    }

    candidates.sort((first, second) => second.score - first.score
      || first.trackIndex - second.trackIndex
      || first.blobIndex - second.blobIndex)

    const assignments = new Array<number>(this.tracks.length).fill(-1)
    const assignedBlobs = new Uint8Array(blobs.length)
    for (const candidate of candidates) {
      if (assignments[candidate.trackIndex] !== -1 || assignedBlobs[candidate.blobIndex] !== 0) continue
      assignments[candidate.trackIndex] = candidate.blobIndex
      assignedBlobs[candidate.blobIndex] = 1
    }

    const updatedTracks: Track[] = this.tracks.map((track, trackIndex) => {
      const blobIndex = assignments[trackIndex]
      if (blobIndex === -1) return track

      const box = smoothBox(track.box, blobs[blobIndex].box)
      // A box cut by the frame edge has a misleading aspect ratio, so it does not vote.
      const personScore = touchesFrameEdge(box)
        ? track.personScore
        : track.personScore * (1 - CLASS_VOTE_WEIGHT) + (classifyBlob(box) === 'person' ? CLASS_VOTE_WEIGHT : 0)
      const hits = track.hits + 1
      return {
        ...track,
        id: track.id ?? (hits >= this.minHits ? String(this.nextId++) : null),
        hits,
        box,
        personScore,
        // Hysteresis: switching class needs a clear majority, so the label does not flicker.
        cls: personScore > 0.65 ? 'person' : personScore < 0.35 ? 'cattle' : track.cls,
        confidence: confidenceForTrack(box, track.ageSec, track.id ?? '', timeSec),
        unseenSec: 0,
      }
    })

    for (let blobIndex = 0; blobIndex < blobs.length; blobIndex++) {
      if (assignedBlobs[blobIndex] !== 0) continue
      const box = { ...blobs[blobIndex].box }
      const id = this.minHits <= 1 ? String(this.nextId++) : null
      const cls = classifyBlob(box)
      updatedTracks.push({
        id,
        hits: 1,
        box,
        cls,
        personScore: cls === 'person' ? 1 : 0,
        confidence: confidenceForTrack(box, 0, id ?? '', timeSec),
        ageSec: 0,
        unseenSec: 0,
      })
    }

    this.tracks = updatedTracks
    return this.tracks.flatMap((track) => track.id === null ? [] : [{
      trackId: track.id,
      cls: track.cls,
      confidence: track.unseenSec > 0
        ? track.confidence * Math.exp(-2.5 * track.unseenSec)
        : track.confidence,
      box: { ...track.box },
      outside: isBottomCenterOutside(track.box, zone),
    }])
  }
}

function touchesFrameEdge(box: Box): boolean {
  return box.x <= EDGE_MARGIN || box.y <= EDGE_MARGIN || box.x + box.w >= 1 - EDGE_MARGIN || box.y + box.h >= 1 - EDGE_MARGIN
}

function deterministicJitter(trackId: string, timeSec: number): number {
  const key = `${trackId}:${Math.round(timeSec * 20)}`
  let hash = 2_166_136_261
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return ((hash >>> 0) / 4_294_967_295 - 0.5) * 0.03
}

function smoothBox(previous: Box, observed: Box): Box {
  return {
    x: previous.x + (observed.x - previous.x) * BOX_SMOOTHING,
    y: previous.y + (observed.y - previous.y) * BOX_SMOOTHING,
    w: previous.w + (observed.w - previous.w) * BOX_SMOOTHING,
    h: previous.h + (observed.h - previous.h) * BOX_SMOOTHING,
  }
}

function intersectionOverUnion(first: Box, second: Box): number {
  const overlapWidth = Math.max(0, Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x))
  const overlapHeight = Math.max(0, Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y))
  const intersection = overlapWidth * overlapHeight
  const union = first.w * first.h + second.w * second.h - intersection
  return union > 0 ? intersection / union : 0
}

function centerDistance(first: Box, second: Box): number {
  return Math.hypot(
    first.x + first.w / 2 - second.x - second.w / 2,
    first.y + first.h / 2 - second.y - second.h / 2,
  )
}

function boxDiagonal(box: Box): number {
  return Math.hypot(box.w, box.h)
}
