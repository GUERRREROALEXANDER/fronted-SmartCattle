import { useEffect, useRef, useState } from 'react'
import { Clapperboard, ScanSearch, ShieldAlert, Spline } from 'lucide-react'
import { Button } from '../../components/ui'
import { canRecordSyntheticVideo, recordSyntheticVideo, SYNTHETIC_DURATION_SEC } from './analysis/syntheticScene'
import styles from './AnalysisNotice.module.css'

export interface AnalysisNoticeProps {
  onSampleReady: (file: File) => void
}

/** Explains the simulated YOLO analysis and offers a generated sample clip for evaluators. */
export function AnalysisNotice({ onSampleReady }: AnalysisNoticeProps) {
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const supported = canRecordSyntheticVideo()

  useEffect(() => () => abortRef.current?.abort(), [])

  const generate = async () => {
    setError(null)
    setProgress(0)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const file = await recordSyntheticVideo({ onProgress: setProgress, signal: controller.signal })
      onSampleReady(file)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo generar el video de ejemplo.')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setProgress(null)
    }
  }

  const recording = progress !== null
  const remaining = recording ? Math.max(0, Math.ceil(SYNTHETIC_DURATION_SEC * (1 - progress))) : 0

  return (
    <section className={styles.card} aria-labelledby="videos-analysis-intro">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Simulación YOLO en el navegador</p>
        <h2 id="videos-analysis-intro" className={styles.title}>Analiza un video grabado y mira las detecciones en tiempo real</h2>
        <ul className={styles.points}>
          <li><ScanSearch size={18} aria-hidden="true" />Cajas para vacas y personas que siguen lo que se mueve en el video.</li>
          <li><Spline size={18} aria-hidden="true" />Zona segura ajustable arrastrando sus esquinas.</li>
          <li><ShieldAlert size={18} aria-hidden="true" />Alarma cuando una vaca sale del perímetro y reporte descargable.</li>
        </ul>
        <p className={styles.note}>El modelo real corre en el servidor; aquí se simula con detección de movimiento. Los videos no salen de este navegador.</p>
      </div>
      <div className={styles.cta}>
        <Button icon={Clapperboard} onClick={generate} loading={recording} disabled={!supported || recording} fullWidth>
          Probar con video de ejemplo
        </Button>
        {recording && (
          <div className={styles.progress} role="status">
            <div className={styles.bar} aria-hidden="true"><div className={styles.barFill} style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <span>Generando potrero de ejemplo… {remaining} s</span>
          </div>
        )}
        {!recording && !error && (
          <p className={styles.ctaHint}>{supported ? `Crea un clip de ${SYNTHETIC_DURATION_SEC} s con vacas y una persona; una vaca sale de la zona.` : 'Este navegador no puede grabar el video de ejemplo. Sube un video propio.'}</p>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </section>
  )
}
