import { Notice } from '../../components/ui'
import styles from './AnalysisNotice.module.css'

export function AnalysisNotice() {
  return (
    <Notice tone="info" title="Análisis automático pendiente">
      <p>Los videos se quedan en este navegador. El análisis automático estará disponible cuando el servidor reciba videos.</p>
      <div className={styles.action}>
        <button type="button" disabled className={styles.button} aria-describedby="analysis-disabled-reason">
          Analizar con IA
        </button>
        <span id="analysis-disabled-reason" className={styles.reason}>
          El backend aún no tiene un endpoint para subir videos.
        </span>
      </div>
    </Notice>
  )
}
