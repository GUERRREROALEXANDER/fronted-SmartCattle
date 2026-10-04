import { createBrowserRouter } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { MonitoringPage } from '../features/monitoring/MonitoringPage'
import { EventsPage } from '../features/events/EventsPage'
import { CattlePage } from '../features/cattle/CattlePage'
import { CamerasPage } from '../features/cameras/CamerasPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { NotFoundPage } from '../features/not-found/NotFoundPage'
import { navItems, profileItem } from './navigation'

const pages = {
  dashboard: DashboardPage,
  monitoring: MonitoringPage,
  events: EventsPage,
  cattle: CattlePage,
  cameras: CamerasPage,
  settings: SettingsPage,
}

export const router = createBrowserRouter([{
  Component: AppShell,
  children: [
    ...navItems.map(item => ({ path: item.path, Component: pages[item.id], handle: { title: item.label } })),
    { path: profileItem.path, Component: ProfilePage, handle: { title: profileItem.label } },
    ...(import.meta.env.DEV ? [{
      path: '/dev/ui',
      handle: { title: 'Componentes' },
      lazy: async () => {
        const { UiGalleryPage } = await import('../features/dev/UiGalleryPage')
        return { Component: UiGalleryPage }
      },
    }] : []),
    { path: '*', Component: NotFoundPage, handle: { title: 'Página no encontrada' } },
  ],
}])
