import { createBrowserRouter, type LazyRouteFunction, type RouteObject } from 'react-router'
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
import { RequireAuth } from './auth/RequireAuth'
import { RedirectIfAuthenticated } from './auth/RedirectIfAuthenticated'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'

const pages = {
  dashboard: DashboardPage,
  monitoring: MonitoringPage,
  events: EventsPage,
  cattle: CattlePage,
  cameras: CamerasPage,
  settings: SettingsPage,
}

// Heavy pages (3D scene, charts, video tooling) load on first visit so the shell stays light.
const lazyPages: Record<string, LazyRouteFunction<RouteObject>> = {
  pasture: async () => ({ Component: (await import('../features/pasture3d/PasturePage')).PasturePage }),
  videos: async () => ({ Component: (await import('../features/videos/VideosPage')).VideosPage }),
  analytics: async () => ({ Component: (await import('../features/analytics/AnalyticsPage')).AnalyticsPage }),
}

export const router = createBrowserRouter([{
  Component: RedirectIfAuthenticated,
  children: [
    { path: '/login', Component: LoginPage, handle: { title: 'Ingresar' } },
    { path: '/register', Component: RegisterPage, handle: { title: 'Crear cuenta' } },
  ],
}, {
  Component: RequireAuth,
  children: [{
  Component: AppShell,
  children: [
    ...navItems.map(item => item.id in lazyPages
      ? { path: item.path, lazy: lazyPages[item.id], handle: { title: item.label } }
      : { path: item.path, Component: pages[item.id as keyof typeof pages], handle: { title: item.label } }),
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
  }],
}])
