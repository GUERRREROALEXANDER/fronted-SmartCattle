import { useId, type CSSProperties } from 'react'
import pastureSmall from '../../assets/login/pasture-dusk-1200.jpg'
import pastureLarge from '../../assets/login/pasture-dusk-2400.jpg'
import styles from './PastureScene.module.css'

const detections = [
  { x: 160, y: 850, width: 250, height: 140, confidence: 0.88 },
  { x: 690, y: 765, width: 150, height: 165, confidence: 0.91 },
  { x: 845, y: 725, width: 265, height: 170, confidence: 0.94 },
  { x: 1095, y: 672, width: 200, height: 182, confidence: 0.89 },
  { x: 1232, y: 672, width: 160, height: 172, confidence: 0.83 },
  { x: 2085, y: 518, width: 160, height: 182, confidence: 0.92, outside: true },
]
const confidenceFormat = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
          <polygon points="60,800 1560,600 1760,1010 40,1120" vectorEffect="non-scaling-stroke" />
          {[[60, 800], [1560, 600], [1760, 1010], [40, 1120]].map(([x, y]) =>
            <rect key={x} x={x - 5} y={y - 5} width="10" height="10" />)}
          <text x="1190" y="576">ZONA SEGURA · LOTE 3</text>
        </g>
        {detections.map((box, index) => <g key={box.x}
          className={`${styles.detection} ${box.outside ? styles.outside : ''}`}
          style={{ '--reveal-delay': `${box.outside ? 1200 : 700 + index * 70}ms` } as CSSProperties}>
          <rect className={styles.box} x={box.x} y={box.y} width={box.width} height={box.height}
            rx="3" fill={box.outside ? `url(#${hatchId})` : 'none'} vectorEffect="non-scaling-stroke" />
          <rect className={styles.tag} x={box.x} y={box.y - 36} width={box.outside ? 252 : 146} height="32" rx="3" />
          <text className={styles.label} x={box.x + 8} y={box.y - 13}>
            {box.outside ? 'fuera de zona' : 'bovino'} · {confidenceFormat.format(box.confidence)}
          </text>
        </g>)}
      </svg>
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
