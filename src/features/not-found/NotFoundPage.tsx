import { Compass, House } from 'lucide-react'
import { Link } from 'react-router'
import { FadeUp } from '../../motion'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return <FadeUp className={styles.wrap}>
    <section className={styles.card} aria-labelledby="not-found-title">
      <span className={styles.badge} aria-hidden="true"><Compass size={28} strokeWidth={1.75} /></span>
      <p className={styles.code}>Error 404</p>
      <h1 id="not-found-title" className={styles.title}>Página no encontrada</h1>
      <p className={styles.text}>La dirección no existe. Revisa el enlace o vuelve al inicio para seguir vigilando la finca.</p>
      <Link className={styles.home} to="/">
        <House size={18} strokeWidth={1.75} aria-hidden="true" />Volver al inicio
      </Link>
    </section>
  </FadeUp>
}
