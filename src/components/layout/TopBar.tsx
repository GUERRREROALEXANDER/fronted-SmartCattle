import { DataSourceBadge } from '../ui/DataSourceBadge'
import styles from './TopBar.module.css'

export function TopBar() {
  return <header className={styles.bar}>
    <span className={styles.wordmark}>SmartCattle</span>
    <DataSourceBadge />
  </header>
}
