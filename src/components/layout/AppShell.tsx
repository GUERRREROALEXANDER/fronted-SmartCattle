import { Outlet, useLocation } from 'react-router'
import { useDocumentTitle } from '../../app/useDocumentTitle'
import { SideRail } from './SideRail'
import { TopBar } from './TopBar'
import { MobileTabBar } from './MobileTabBar'
import styles from './AppShell.module.css'

export function AppShell() {
  const { pathname } = useLocation()
  useDocumentTitle()
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#main-content">Saltar al contenido</a>
    <SideRail />
    <TopBar />
    <main className={styles.main} id="main-content" tabIndex={-1}>
      <div className={styles.content} key={pathname}><Outlet /></div>
    </main>
    <MobileTabBar />
  </div>
}
