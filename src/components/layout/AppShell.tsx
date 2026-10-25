import { Outlet, useLocation } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { useDocumentTitle } from '../../app/useDocumentTitle'
import { duration, ease } from '../../motion'
import { SideRail } from './SideRail'
import { TopBar } from './TopBar'
import { MobileTabBar } from './MobileTabBar'
import styles from './AppShell.module.css'

export function AppShell() {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  useDocumentTitle()
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#main-content">Saltar al contenido</a>
    <SideRail />
    <TopBar />
    <main className={styles.main} id="main-content" tabIndex={-1}>
      <motion.div className={styles.content} key={pathname}
        initial={{ opacity: 0, y: reduce ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? duration.micro : duration.panel, ease: ease.out }}>
        <Outlet />
      </motion.div>
    </main>
    <MobileTabBar />
  </div>
}
