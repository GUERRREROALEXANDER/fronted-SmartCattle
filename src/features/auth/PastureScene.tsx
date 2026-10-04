import { useId, type CSSProperties } from 'react'
import pastureSmall from '../../assets/login/pasture-dusk-1200.jpg'
import pastureLarge from '../../assets/login/pasture-dusk-2400.jpg'
import styles from './PastureScene.module.css'

// Coordinates are in the photo's own 2400x1595 pixel space.
const photoWidth = 2400
const photoHeight = 1595
const zoneVertices = [[60, 800], [1560, 600], [1760, 1010], [40, 1120]] as const
const detections = [
  { x: 160, y: 850, width: 250, height: 140, confidence: 0.88 },
  { x: 690, y: 765, width: 150, height: 165, confidence: 0.91 },
  { x: 845, y: 725, width: 265, height: 170, confidence: 0.94 },
  { x: 1095, y: 672, width: 200, height: 182, confidence: 0.89 },
  // Labelled below its box so it does not collide with the neighbouring label.
  { x: 1232, y: 672, width: 160, height: 172, confidence: 0.83, labelBelow: true },
  { x: 2085, y: 518, width: 160, height: 182, confidence: 0.92, outside: true },
]
const confidenceFormat = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const toPercent = (value: number, total: number) => `${(value / total) * 100}%`
const revealDelay = (index: number, outside?: boolean) => `${outside ? 1200 : 700 + index * 70}ms`

export function PastureScene({ focusX }: { focusX?: number }) {
  const hatchId = `hatch-outside-${useId()}`
  return <figure className={styles.scene} style={{ '--focus-x': focusX } as CSSProperties}>
    <div className={styles.frame} aria-hidden="true">
      <img src={pastureLarge} srcSet={`${pastureSmall} 1200w, ${pastureLarge} 2400w`}
        sizes="(min-width: 1024px) 100vw, 100vw" alt="" decoding="async" fetchPriority="high" />
      <svg viewBox="0 0 2400 1595" preserveAspectRatio="none" focusable="false">
        <defs>
          <pattern id={hatchId} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M 0 0 V 10" className={styles.hatch} vectorEffect="non-scaling-stroke" />
          </pattern>
        </defs>
        <g className={styles.boundary}>
          <polygon points={zoneVertices.map(point => point.join(',')).join(' ')} vectorEffect="non-scaling-stroke" />
          {zoneVertices.map(([x, y]) => <rect key={x} x={x - 5} y={y - 5} width="10" height="10" />)}
        </g>
        {detections.map((box, index) => <g key={box.x}
          className={`${styles.detection} ${box.outside ? styles.outside : ''}`}
          style={{ '--reveal-delay': revealDelay(index, box.outside) } as CSSProperties}>
          <rect className={styles.box} x={box.x} y={box.y} width={box.width} height={box.height}
            rx="3" fill={box.outside ? `url(#${hatchId})` : 'none'} vectorEffect="non-scaling-stroke" />
        </g>)}
      </svg>
      {/* Labels are HTML so they keep a legible size at any scale. */}
      <div className={styles.labels}>
        <span className={styles.zoneLabel}
          style={{ left: toPercent(zoneVertices[1][0], photoWidth), top: toPercent(zoneVertices[1][1], photoHeight) }}>
          Zona segura · Lote 3
        </span>
        {detections.map((box, index) => <span key={box.x}
          className={[styles.label, box.outside && styles.outsideLabel, box.labelBelow && styles.below].filter(Boolean).join(' ')}
          style={{
            // The outside box sits near the photo edge, so its label is right-aligned to the box.
            left: toPercent(box.outside ? box.x + box.width : box.x, photoWidth),
            top: toPercent(box.labelBelow ? box.y + box.height : box.y, photoHeight),
            '--reveal-delay': revealDelay(index, box.outside),
          } as CSSProperties}>
          {box.outside ? 'fuera de zona' : 'bovino'} · {confidenceFormat.format(box.confidence)}
        </span>)}
      </div>
    </div>
    <div className={styles.chrome}>
      <p className={styles.wordmark}>SmartCattle</p>
      <p className={styles.pill}><span aria-hidden="true" />Potrero Norte · Demostración</p>
    </div>
    <figcaption className={styles.caption}>Imagen ilustrativa con detecciones simuladas. Foto: {' '}
      <a href="https://unsplash.com/photos/cows-grazing-in-a-field-at-sunset-HaSohIaDVdI" target="_blank" rel="noopener noreferrer">Uran Wang / Unsplash.</a>
    </figcaption>
  </figure>
}
