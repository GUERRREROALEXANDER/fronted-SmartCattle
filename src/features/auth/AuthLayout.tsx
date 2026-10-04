import type { ReactNode } from 'react'
import { useDocumentTitle } from '../../app/useDocumentTitle'
import { PastureScene } from './PastureScene'
import styles from './AuthLayout.module.css'

interface AuthLayoutProps { title: string; description: string; children: ReactNode; footer: ReactNode }
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  useDocumentTitle()
  return <main className={styles.layout}>
    <div className={styles.scene}><PastureScene /></div>
    <section className={styles.panel} aria-labelledby="auth-title">
      <div className={styles.panelInner}>
        <h1 id="auth-title" className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>{footer}</footer>
      </div>
    </section>
  </main>
}
