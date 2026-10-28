import { CloudCheck, Download, HardDrive, Loader2 } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '../../../components/ui'
import { CountUp, duration, ease, staggerDelay } from '../../../motion'
import type { VideoAnalysisSummary } from '../detection/types'
import { formatClock } from './analysisModel'
import styles from './AnalysisSummary.module.css'

export type SaveStatus = 'saving' | 'api' | 'local'

export interface AnalysisSummaryProps {
  summary: VideoAnalysisSummary
  saveStatus: SaveStatus
  onDownload: () => void
}

const percent = (value: number) => `${Math.round(value)} %`
const twoDecimals = (value: number) => (value / 100).toFixed(2)

export function AnalysisSummary({ summary, saveStatus, onDownload }: AnalysisSummaryProps) {
  const reduce = useReducedMotion()
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
  }, [reduce])
  const cattleAlerts = summary.alerts.filter(alert => alert.cls === 'cattle').length
  const metrics = [
    { label: 'Máximo de vacas', value: summary.max_cattle },
    { label: 'Máximo de personas', value: summary.max_people },
    { label: 'Alertas totales', value: summary.alerts.length, tone: summary.alerts.length > 0 ? 'danger' : undefined, note: `${cattleAlerts} de vacas` },
    { label: 'Tiempo con animales fuera', value: summary.outside_ratio * 100, format: percent, tone: summary.outside_ratio > 0 ? 'danger' : undefined },
    { label: 'Confianza media', value: summary.avg_confidence * 100, format: twoDecimals },
    { label: 'Cuadros analizados', value: summary.frames_analyzed, note: `en ${formatClock(summary.duration_sec)}` },
  ]

  return (
    <motion.section
      ref={ref}
      className={styles.card}
      aria-labelledby={titleId}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.panel, ease: ease.out }}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Resumen del análisis</p>
          <h3 id={titleId} className={styles.title}>{summary.video_name}</h3>
        </div>
        <p className={`${styles.save} ${styles[saveStatus]}`} role="status">
          {saveStatus === 'saving' && <><Loader2 size={16} className={styles.spin} aria-hidden="true" />Guardando resultado…</>}
          {saveStatus === 'api' && <><CloudCheck size={16} aria-hidden="true" />Guardado en el servidor</>}
          {saveStatus === 'local' && <><HardDrive size={16} aria-hidden="true" />Guardado solo en este navegador</>}
        </p>
      </header>

      <dl className={styles.metrics}>
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            className={`${styles.metric} ${metric.tone === 'danger' ? styles.danger : ''}`}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.state, ease: ease.out, delay: 0.1 + staggerDelay(index) }}
          >
            <dt>{metric.label}</dt>
            <dd>
              <CountUp value={metric.value} format={metric.format} />
              {metric.note && <span className={styles.note}>{metric.note}</span>}
            </dd>
          </motion.div>
        ))}
      </dl>

      <div className={styles.actions}>
        <Button icon={Download} onClick={onDownload}>Descargar reporte (JSON)</Button>
      </div>
    </motion.section>
  )
}
