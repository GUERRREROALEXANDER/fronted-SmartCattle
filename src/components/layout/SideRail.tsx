import { NavLink } from 'react-router'
import { navItems, profileItem } from '../../app/navigation'
import { DataSourceBadge } from '../ui/DataSourceBadge'
import styles from './SideRail.module.css'

export function SideRail() {
  const ProfileIcon = profileItem.icon
  return <aside className={styles.rail}>
    <span className={styles.wordmark}>SmartCattle</span>
    <nav aria-label="Principal" className={styles.navigation}>
      {navItems.map(({ id, path, label, icon: Icon }) =>
        <NavLink key={id} to={path} end={path === '/'} className={styles.item}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />{label}
        </NavLink>)}
    </nav>
    <div className={styles.bottom}>
      <DataSourceBadge tone="on-brand" />
      <NavLink to={profileItem.path} className={styles.item}>
        <ProfileIcon size={20} strokeWidth={1.75} aria-hidden="true" />{profileItem.label}
      </NavLink>
    </div>
  </aside>
}
