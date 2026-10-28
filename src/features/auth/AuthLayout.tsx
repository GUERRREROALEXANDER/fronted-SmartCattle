import type { ReactNode } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useDocumentTitle } from '../../app/useDocumentTitle'
import { BrandMark } from '../../components/ui/BrandMark'
import { duration, ease } from '../../motion'
import { PastureScene } from './PastureScene'
import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  mode: 'login' | 'register'
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

export function AuthLayout({ mode, title, description, children, footer }: AuthLayoutProps) {
  useDocumentTitle()
  const reduce = useReducedMotion()
  const swap = {
    initial: { opacity: 0, y: reduce ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduce ? 0 : -8 },
    transition: { duration: reduce ? duration.micro : duration.state, ease: ease.out },
  }
  return <main className={styles.layout}>
    <div className={styles.scene}><PastureScene /></div>
    <section className={styles.panel} aria-labelledby="auth-title">
      <motion.div className={styles.panelInner}
        initial={{ opacity: 0, y: reduce ? 0 : 28, scale: reduce ? 1 : 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduce ? { duration: duration.micro } : { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 }}>
        <div className={styles.cardTop}>
          <BrandMark size="sm" />
          <span className={styles.securityBadge}><ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />Acceso seguro</span>
        </div>
        <div className={styles.heading}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={mode} {...swap}>
              <h1 id="auth-title" className={styles.title}>{title}</h1>
              <p className={styles.description}>{description}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className={styles.content}>{children}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.footer key={mode} className={styles.footer} {...swap}>{footer}</motion.footer>
        </AnimatePresence>
      </motion.div>
      <p className={styles.legal}><Lock size={13} strokeWidth={2} aria-hidden="true" />Conexión cifrada · © 2026 SmartCattle</p>
    </section>
  </main>
}
