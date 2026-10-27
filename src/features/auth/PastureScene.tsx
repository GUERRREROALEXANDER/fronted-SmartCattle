import { useId, type CSSProperties } from 'react'
import styles from './PastureScene.module.css'

const sceneWidth = 2400
const sceneHeight = 1595
// The herd sits in the right half so the desktop crop (focus-x 0.85) never cuts a box or its label.
const zoneVertices = [[860, 830], [1700, 640], [1860, 1080], [840, 1180]] as const
const detections = [
  { x: 900, y: 870, width: 220, height: 130, confidence: 0.88 },
  { x: 1170, y: 800, width: 150, height: 160, confidence: 0.91 },
  { x: 1360, y: 760, width: 240, height: 165, confidence: 0.94 },
  { x: 1240, y: 990, width: 200, height: 150, confidence: 0.83, labelBelow: true },
  { x: 2000, y: 560, width: 160, height: 182, confidence: 0.92, outside: true },
]
const confidenceFormat = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const toPercent = (value: number, total: number) => `${(value / total) * 100}%`
const revealDelay = (index: number, outside?: boolean) => `${outside ? 1200 : 700 + index * 70}ms`

function Cow({ box }: { box: (typeof detections)[number] }) {
  const { x, y, width, height } = box
  return <g className={styles.cow} transform={`translate(${x} ${y})`}>
    <path className={styles.cowLegs} vectorEffect="non-scaling-stroke"
      d={`M ${width * 0.28} ${height * 0.62} L ${width * 0.25} ${height * 0.94} M ${width * 0.61} ${height * 0.62} L ${width * 0.65} ${height * 0.94}`} />
    <ellipse className={styles.cowBody} cx={width * 0.46} cy={height * 0.48} rx={width * 0.34} ry={height * 0.26} />
    <ellipse className={styles.cowSpot} cx={width * 0.38} cy={height * 0.43} rx={width * 0.12} ry={height * 0.13} />
    <path className={styles.cowEar} d={`M ${width * 0.73} ${height * 0.32} L ${width * 0.63} ${height * 0.21} L ${width * 0.78} ${height * 0.25} Z`} />
    <ellipse className={styles.cowHead} cx={width * 0.79} cy={height * 0.43} rx={width * 0.15} ry={height * 0.2} />
    <ellipse className={styles.cowMuzzle} cx={width * 0.84} cy={height * 0.52} rx={width * 0.12} ry={height * 0.1} />
    <circle className={styles.cowEye} cx={width * 0.84} cy={height * 0.36} r={Math.max(2, width * 0.018)} />
  </g>
}

export function PastureScene({ focusX }: { focusX?: number }) {
  const id = useId()
  const skyId = `sky-${id}`
  const pastureId = `pasture-${id}`
  const hatchId = `hatch-outside-${id}`
  return <figure className={styles.scene} style={{ '--focus-x': focusX } as CSSProperties}>
    <div className={styles.frame} aria-hidden="true">
      <svg className={styles.illustration} viewBox={`0 0 ${sceneWidth} ${sceneHeight}`} preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={styles.skyTop} />
            <stop offset="100%" className={styles.skyBottom} />
          </linearGradient>
          <linearGradient id={pastureId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={styles.pastureTop} />
            <stop offset="100%" className={styles.pastureBottom} />
          </linearGradient>
          <pattern id={hatchId} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M 0 0 V 10" className={styles.hatch} vectorEffect="non-scaling-stroke" />
          </pattern>
        </defs>
        <rect width={sceneWidth} height={sceneHeight} fill={`url(#${skyId})`} />
        <circle className={styles.sun} cx="1980" cy="220" r="120" />
        <g className={styles.clouds}>
          <path d="M180 280 C210 190 350 180 390 260 C470 200 590 250 580 330 H180 C130 330 130 280 180 280 Z" />
          <path d="M1260 190 C1300 110 1420 120 1450 190 C1530 140 1630 200 1610 270 H1250 C1200 250 1210 200 1260 190 Z" />
        </g>
        <path className={styles.hillBack} d="M0 650 C360 400 690 490 980 650 C1330 370 1780 430 2400 700 V1595 H0 Z" />
        <path className={styles.hillFront} d="M0 790 C420 610 810 690 1190 790 C1650 570 2050 650 2400 800 V1595 H0 Z" />
        <rect className={styles.pasture} x="0" y="790" width={sceneWidth} height="805" fill={`url(#${pastureId})`} />
        <g className={styles.fence}>
          <path d="M0 1240 C620 1150 1460 1210 2400 1060 M0 1320 C650 1230 1500 1290 2400 1140" />
          <path d="M180 1160 V1390 M760 1130 V1360 M1420 1110 V1340 M2140 1010 V1250" />
        </g>
        <g className={styles.boundary}>
          <polygon points={zoneVertices.map(point => point.join(',')).join(' ')} vectorEffect="non-scaling-stroke" />
          {zoneVertices.map(([x, y]) => <rect key={x} x={x - 5} y={y - 5} width="10" height="10" />)}
        </g>
        {detections.map(box => <Cow key={`cow-${box.x}`} box={box} />)}
        {detections.map((box, index) => <g key={box.x}
          className={`${styles.detection} ${box.outside ? styles.outside : ''}`}
          style={{ '--reveal-delay': revealDelay(index, box.outside) } as CSSProperties}>
          <rect className={styles.box} x={box.x} y={box.y} width={box.width} height={box.height}
            fill={box.outside ? `url(#${hatchId})` : 'none'} vectorEffect="non-scaling-stroke" />
        </g>)}
      </svg>
      <div className={styles.skyOverlay} />
      <div className={styles.labels}>
        <span className={styles.zoneLabel}
          style={{ left: toPercent(zoneVertices[1][0], sceneWidth), top: toPercent(zoneVertices[1][1], sceneHeight) }}>
          Zona segura · Lote 3
        </span>
        {detections.map((box, index) => <span key={box.x}
          className={[styles.label, box.outside && styles.outsideLabel, box.labelBelow && styles.below].filter(Boolean).join(' ')}
          style={{
            left: toPercent(box.outside ? box.x + box.width : box.x, sceneWidth),
            top: toPercent(box.labelBelow ? box.y + box.height : box.y, sceneHeight),
            '--reveal-delay': revealDelay(index, box.outside),
          } as CSSProperties}>
          {box.outside ? 'fuera' : 'bovino'} · {confidenceFormat.format(box.confidence)}
        </span>)}
      </div>
    </div>
    <div className={styles.chrome}>
      <p className={styles.wordmark}>SmartCattle</p>
      <p className={styles.pill}><span aria-hidden="true" />Potrero Norte · Demostración</p>
    </div>
    <figcaption className={styles.caption}>
      <strong>Tu finca, de un vistazo.</strong>
      <span>Detecciones simuladas sobre una pradera segura.</span>
    </figcaption>
  </figure>
}
