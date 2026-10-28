import { useState } from 'react'
import { useLocation, useMatches, useOutlet } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useDocumentTitle } from '../../app/useDocumentTitle'
import { useAuth } from '../../app/auth/useAuth'
import { duration, ease } from '../../motion'
import { VideoLibraryProvider } from '../../features/videos/VideoLibraryProvider'
import { SideRail } from './SideRail'
import { TopBar } from './TopBar'
import { AlarmBanner } from './AlarmBanner'
import { MobileTabBar } from './MobileTabBar'
import styles from './AppShell.module.css'

// Keeps the leaving page on screen while its exit animation runs.
function FrozenOutlet() {
  const outlet = useOutlet()
  const [frozen] = useState(outlet)
  return frozen
}

function usePageTitle() {
  const matches = useMatches()
  const handle = [...matches].reverse().find(match => {
    const value = match.handle
    return typeof value === 'object' && value !== null && 'title' in value && typeof value.title === 'string'
  })?.handle as { title: string } | undefined
  return handle?.title ?? 'Inicio'
}

export function AppShell() {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  const title = usePageTitle()
  const { session } = useAuth()
  useDocumentTitle()
  // The video library lives here so loaded videos survive navigation while signed in.
  return <VideoLibraryProvider><div className={styles.shell}>
    <a className={styles.skipLink} href="#main-content">Saltar al contenido</a>
    <SideRail />
    <TopBar title={title} user={session?.user} />
    <AlarmBanner />
    <main className={styles.main} id="main-content" tabIndex={-1}>
      <AnimatePresence mode="wait">
        <motion.div className={styles.content} key={pathname}
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduce ? duration.micro : 0.45, ease: ease.out } }}
          exit={{ opacity: 0, y: 0, transition: { duration: reduce ? 0 : duration.micro, ease: ease.in } }}>
          <FrozenOutlet />
        </motion.div>
      </AnimatePresence>
    </main>
    <MobileTabBar />
  </div></VideoLibraryProvider>
}
