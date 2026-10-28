import { useEffect, type CSSProperties } from 'react'
import { BellRing, ChartNoAxesColumnIncreasing, ScanEye } from 'lucide-react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import pastureSmall from '../../assets/login/pasture-dusk-1200.jpg'
import pastureLarge from '../../assets/login/pasture-dusk-2400.jpg'
import { BrandMark } from '../../components/ui/BrandMark'
import { ease, staggerDelay } from '../../motion'
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
const features = [
  { icon: ScanEye, label: 'Detección con visión artificial' },
  { icon: BellRing, label: 'Zonas seguras y alertas al instante' },
  { icon: ChartNoAxesColumnIncreasing, label: 'Métricas en tiempo real' },
]

const ZONE_DRAW = { delay: 0.3, duration: 1.2 }
const DETECTION_START = 1.1
const DETECTION_STEP = 0.22
const confidenceFormat = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const toPercent = (value: number, total: number) => `${(value / total) * 100}%`
const detectionDelay = (index: number) => DETECTION_START + index * DETECTION_STEP

function Confidence({ value, delay }: { value: number; delay: number }) {
  const reduce = useReducedMotion()
  const current = useMotionValue(reduce ? value : 0)
  const text = useTransform(current, latest => confidenceFormat.format(latest))

  useEffect(() => {
    if (reduce) {
      current.set(value)
      return
    }
    const controls = animate(current, value, { delay, duration: 0.9, ease: ease.out })
    return () => controls.stop()
  }, [current, delay, reduce, value])

  return <motion.span className={styles.confidence}>{text}</motion.span>
}

export function PastureScene({ focusX }: { focusX?: number }) {
  const reduce = useReducedMotion()
  const points = zoneVertices.map(point => point.join(',')).join(' ')
  // Labels position themselves with a CSS transform, so only SVG shapes get the scale pop.
  const appear = (delay: number, pop = false) => ({
    initial: reduce ? false : pop ? { opacity: 0, scale: 0.9 } : { opacity: 0 },
    animate: pop ? { opacity: 1, scale: 1 } : { opacity: 1 },
    transition: { delay, duration: 0.35, ease: ease.out },
  })

  return <figure className={styles.scene} style={{ '--focus-x': focusX } as CSSProperties}>
    <div className={styles.frame} aria-hidden="true">
      <img src={pastureLarge} srcSet={`${pastureSmall} 1200w, ${pastureLarge} 2400w`}
        sizes="(min-width: 1024px) 60vw, 100vw" alt="" decoding="async" fetchPriority="high" />
      <svg viewBox={`0 0 ${photoWidth} ${photoHeight}`} preserveAspectRatio="none" focusable="false">
        <motion.polygon className={styles.zoneFill} points={points}
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: ZONE_DRAW.delay + ZONE_DRAW.duration * 0.6, duration: 0.6 }} />
        <motion.polygon className={styles.zoneLine} points={points} vectorEffect="non-scaling-stroke"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
          transition={{ pathLength: { ...ZONE_DRAW, ease: ease.fluid }, opacity: { delay: ZONE_DRAW.delay, duration: 0.2 } }} />
        {zoneVertices.map(([x, y], index) => <motion.circle key={x} className={styles.vertex} cx={x} cy={y} r="9"
          {...appear(ZONE_DRAW.delay + (ZONE_DRAW.duration / zoneVertices.length) * index, true)} />)}
        {detections.map((box, index) => <motion.rect key={box.x}
          className={box.outside ? `${styles.box} ${styles.outside}` : styles.box}
          x={box.x} y={box.y} width={box.width} height={box.height} rx="6" vectorEffect="non-scaling-stroke"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          {...appear(detectionDelay(index), true)} />)}
      </svg>
      <span className={styles.scan} />
      {/* Labels are HTML so they keep a legible size at any scale. */}
      <div className={styles.labels}>
        <motion.span className={styles.zoneLabel}
          style={{ left: toPercent(zoneVertices[1][0], photoWidth), top: toPercent(zoneVertices[1][1], photoHeight) }}
          {...appear(ZONE_DRAW.delay + ZONE_DRAW.duration)}>
          Zona segura · Lote 3
        </motion.span>
        {detections.map((box, index) => <motion.span key={box.x}
          className={[styles.label, box.outside && styles.outsideLabel, box.labelBelow && styles.below].filter(Boolean).join(' ')}
          style={{
            // The outside box sits near the photo edge, so its label is right-aligned to the box.
            left: toPercent(box.outside ? box.x + box.width : box.x, photoWidth),
            top: toPercent(box.labelBelow ? box.y + box.height : box.y, photoHeight),
          }}
          {...appear(detectionDelay(index) + 0.1)}>
          {box.outside ? 'fuera de zona' : 'bovino'} · <Confidence value={box.confidence} delay={detectionDelay(index) + 0.1} />
        </motion.span>)}
      </div>
    </div>
    <div className={styles.scrim} aria-hidden="true" />

    <div className={styles.overlay}>
      <div className={styles.topRow}>
        <p className={styles.chip}><span className={styles.hudDot} aria-hidden="true" />Potrero Norte · Demostración</p>
        <p className={`${styles.chip} ${styles.status}`}><span className={styles.liveDot} aria-hidden="true" />Sistema operativo</p>
      </div>
      <motion.div className={styles.story}
        initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6, ease: ease.out }}>
        <BrandMark tone="on-dark" size="lg" className={styles.brand} />
        <p className={styles.tagline}>Vigilancia inteligente del ganado</p>
        <ul className={styles.features}>
          {features.map(({ icon: Icon, label }, index) => <motion.li key={label} className={styles.feature}
            initial={reduce ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + staggerDelay(index) * 2, duration: 0.45, ease: ease.out }}>
            <span className={styles.featureIcon}><Icon size={18} strokeWidth={2} aria-hidden="true" /></span>
            {label}
          </motion.li>)}
        </ul>
      </motion.div>
    </div>

    <figcaption className={styles.caption}>Imagen ilustrativa con detecciones simuladas. Foto:{' '}
      <a href="https://unsplash.com/photos/cows-grazing-in-a-field-at-sunset-HaSohIaDVdI" target="_blank" rel="noopener noreferrer">Uran Wang / Unsplash</a>
    </figcaption>
  </figure>
}
