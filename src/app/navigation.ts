import { Box, Cctv, ChartPie, CircleUserRound, ClipboardList, Map, ScrollText, Settings, Tags, Video, type LucideIcon } from 'lucide-react'

/** Every page owns one poster ink. */
export type Ink = 'verde' | 'cobalto' | 'naranja' | 'maiz' | 'fucsia' | 'tinta'

export type NavigationItem = {
  id: string
  path: string
  label: string
  /** For the phone's tab bar, when the label does not fit it. */
  shortLabel?: string
  icon: LucideIcon
  primaryOnMobile: boolean
  ink: Ink
}

export const navItems = [
  { id: 'dashboard', path: '/', label: 'Inicio', icon: Map, primaryOnMobile: true, ink: 'verde' },
  { id: 'monitoring', path: '/live', label: 'En vivo', icon: Video, primaryOnMobile: true, ink: 'cobalto' },
  { id: 'events', path: '/events', label: 'Eventos', icon: ScrollText, primaryOnMobile: true, ink: 'naranja' },
  { id: 'report', path: '/informe', label: 'Informe diario', shortLabel: 'Informe', icon: ClipboardList, primaryOnMobile: true, ink: 'fucsia' },
  { id: 'cattle', path: '/cattle', label: 'Ganado', icon: Tags, primaryOnMobile: false, ink: 'maiz' },
  { id: 'pasture', path: '/pasture', label: 'Potrero 3D', icon: Box, primaryOnMobile: false, ink: 'verde' },
  { id: 'analytics', path: '/analytics', label: 'Análisis', icon: ChartPie, primaryOnMobile: false, ink: 'cobalto' },
  { id: 'cameras', path: '/cameras', label: 'Cámaras', icon: Cctv, primaryOnMobile: false, ink: 'maiz' },
  { id: 'settings', path: '/settings', label: 'Ajustes', icon: Settings, primaryOnMobile: false, ink: 'tinta' },
] as const satisfies readonly NavigationItem[]

export const profileItem = {
  id: 'profile', path: '/profile', label: 'Perfil', icon: CircleUserRound, ink: 'tinta',
} as const satisfies Omit<NavigationItem, 'primaryOnMobile'>

/** The ink of the page at this path. */
export function inkFor(pathname: string): Ink {
  const item = [...navItems, profileItem].find(entry => entry.path === pathname)
  return item?.ink ?? 'tinta'
}
