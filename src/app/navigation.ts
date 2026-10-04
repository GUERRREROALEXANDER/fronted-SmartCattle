import { Cctv, CircleUserRound, Map, ScrollText, Settings, Tags, Video, type LucideIcon } from 'lucide-react'

type NavigationItem = {
  id: string
  path: string
  label: string
  icon: LucideIcon
  primaryOnMobile: boolean
}

export const navItems = [
  { id: 'dashboard', path: '/', label: 'Inicio', icon: Map, primaryOnMobile: true },
  { id: 'monitoring', path: '/live', label: 'En vivo', icon: Video, primaryOnMobile: true },
  { id: 'events', path: '/events', label: 'Eventos', icon: ScrollText, primaryOnMobile: true },
  { id: 'cattle', path: '/cattle', label: 'Ganado', icon: Tags, primaryOnMobile: true },
  { id: 'cameras', path: '/cameras', label: 'Cámaras', icon: Cctv, primaryOnMobile: false },
  { id: 'settings', path: '/settings', label: 'Ajustes', icon: Settings, primaryOnMobile: false },
] as const satisfies readonly NavigationItem[]

export const profileItem = {
  id: 'profile', path: '/profile', label: 'Perfil', icon: CircleUserRound,
} as const satisfies Omit<NavigationItem, 'primaryOnMobile'>
