// DEVELOPMENT MOCK DATA. Not backend data. No camera streams exist yet; one camera shows a
// still photo (Uran Wang / Unsplash) with hand-placed detections so the monitoring view can be
// exercised. Every other camera reports no stream.
import pastureFrame from '../assets/login/pasture-dusk-2400.jpg'
import type { NormalizedPoint, StreamSource } from '../types/domain'

const width = 2400
const height = 1595
const normalize = (x: number, y: number): NormalizedPoint => [x / width, y / height]

export const demoFeedCameraId = 'south-pasture'

export const demoFeedSource: StreamSource = { kind: 'image', url: pastureFrame, width, height, synthetic: true }

/** Safe zone drawn over the photo's pasture, in normalized photo coordinates. */
export const demoFeedZoneOutline: readonly NormalizedPoint[] = [
  normalize(60, 800), normalize(1560, 600), normalize(1760, 1010), normalize(40, 1120),
]

/** Hand-placed boxes over the animals in the photo (pixel space). The last one is outside the zone. */
export const demoFeedBoxes = [
  { x: 160, y: 850, w: 250, h: 140, label: 'cow', confidence: 0.88 },
  { x: 690, y: 765, w: 150, h: 165, label: 'cow', confidence: 0.91 },
  { x: 845, y: 725, w: 265, h: 170, label: 'cow', confidence: 0.94 },
  { x: 1095, y: 672, w: 200, h: 182, label: 'cow', confidence: 0.89 },
  { x: 1232, y: 672, w: 160, h: 172, label: 'cow', confidence: 0.83 },
  { x: 2085, y: 518, w: 160, h: 182, label: 'cow', confidence: 0.92 },
].map(box => ({ ...box, box: { x: box.x / width, y: box.y / height, width: box.w / width, height: box.h / height } }))
