import { useId, type CSSProperties } from 'react'
import { detectedObjectLabel } from '../../lib/eventCatalog'
import { formatConfidence } from '../../lib/format'
import type { Detection, SafeZone } from '../../types/domain'
import { placeLabels } from './monitoringModel'
import styles from './DetectionOverlay.module.css'

export interface OverlayLayers { boxes: boolean; zones: boolean; labels: boolean }

interface DetectionOverlayProps {
  /** Pixel size of the picture; overlay coordinates are normalized and scaled to it. */
  width: number
  height: number
  detections: readonly Detection[]
  zones: readonly SafeZone[]
  layers: OverlayLayers
}

const kindClass = (detection: Detection) =>
  detection.insideSafeZone === false ? styles.outside : detection.label === 'person' ? styles.person : styles.cattle

/** Safe zones and detection boxes drawn over the camera picture. Decorative for assistive tech; the stage summarizes it in text. */
export function DetectionOverlay({ width, height, detections, zones, layers }: DetectionOverlayProps) {
  const hatchId = `outside-hatch-${useId()}`
  const placement = placeLabels(detections)
  return <>
    <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={hatchId} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M 0 0 V 12" className={styles.hatch} />
        </pattern>
      </defs>
      {layers.zones && zones.map(zone => {
        const outline = zone.outline ?? [
          [zone.bounds[0], zone.bounds[1]], [zone.bounds[2], zone.bounds[1]],
          [zone.bounds[2], zone.bounds[3]], [zone.bounds[0], zone.bounds[3]],
        ] as const
        const points = outline.map(([x, y]) => [x * width, y * height] as const)
        return <g key={zone.id} className={styles.zone}>
          <polygon points={points.map(point => point.join(',')).join(' ')} vectorEffect="non-scaling-stroke" />
          {points.map(([x, y]) => <rect key={`${x}-${y}`} x={x - 6} y={y - 6} width="12" height="12" />)}
        </g>
      })}
      {layers.boxes && detections.map(detection => <rect key={detection.id}
        className={`${styles.box} ${kindClass(detection)}`}
        x={detection.box.x * width} y={detection.box.y * height}
        width={detection.box.width * width} height={detection.box.height * height}
        rx="3" vectorEffect="non-scaling-stroke"
        fill={detection.insideSafeZone === false ? `url(#${hatchId})` : 'none'} />)}
    </svg>
    {layers.boxes && layers.labels && <div className={styles.labels} aria-hidden="true">
      {detections.map(detection => {
        const outside = detection.insideSafeZone === false
        const nearRight = detection.box.x + detection.box.width > 0.82
        const below = placement.get(detection.id) === 'below'
        return <span key={detection.id}
          className={[styles.label, kindClass(detection), nearRight && styles.alignRight, below && styles.below].filter(Boolean).join(' ')}
          style={{
            left: `${(nearRight ? detection.box.x + detection.box.width : detection.box.x) * 100}%`,
            top: `${(below ? detection.box.y + detection.box.height : detection.box.y) * 100}%`,
          } as CSSProperties}>
          {outside ? 'fuera de zona' : detectedObjectLabel(detection.label)} · {formatConfidence(detection.confidence)}
        </span>
      })}
      {layers.zones && zones.map(zone => {
        const [x, y] = (zone.outline ?? [[zone.bounds[0], zone.bounds[1]]])[0]
        return <span key={zone.id} className={styles.zoneLabel} style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
          {zone.name}
        </span>
      })}
    </div>}
  </>
}
