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
import { RequireFarm } from './auth/RequireFarm'
import { SetupFarmPage } from '../features/setup/SetupFarmPage'
import { RedirectIfAuthenticated } from './auth/RedirectIfAuthenticated'
import { LoginPage } from '../features/auth/LoginPage'
import { PhonePairPage } from '../features/cameras/PhonePairPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { ReportPage } from '../features/report/ReportPage'
import { ModelPage } from '../features/assistant/ModelPage'
import { RequireOnboarding } from './auth/RequireOnboarding'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'

const pages = {
  dashboard: DashboardPage,
  report: ReportPage,
  model: ModelPage,
  monitoring: MonitoringPage,
  events: EventsPage,
  cattle: CattlePage,
  cameras: CamerasPage,
  settings: SettingsPage,
}

// Heavy pages (3D scene, charts) load on first visit so the shell stays light.
const lazyPages: Record<string, LazyRouteFunction<RouteObject>> = {
  pasture: async () => ({ Component: (await import('../features/pasture3d/PasturePage')).PasturePage }),
  analytics: async () => ({ Component: (await import('../features/analytics/AnalyticsPage')).AnalyticsPage }),
}

export const router = createBrowserRouter([...(import.meta.env.DEV ? [{
  path: '/dev/sprite-rig',
  lazy: async () => ({ Component: (await import('../features/dev/SpriteRigPage')).SpriteRigPage }),
}] : []), {
  // Opened on a phone from the QR: no session there, the link's code stands in for one.
  path: '/conectar-celular', Component: PhonePairPage, handle: { title: 'Agregar cámara' },
}, {
  Component: RedirectIfAuthenticated,
  children: [
    {
      path: '/bienvenida',
      handle: { title: 'Tu ganado a la vista' },
      lazy: async () => ({ Component: (await import('../features/landing/LandingPage')).LandingPage }),
    },
    { path: '/login', Component: LoginPage, handle: { title: 'Ingresar' } },
    { path: '/register', Component: RegisterPage, handle: { title: 'Crear cuenta' } },
  ],
}, {
  Component: RequireAuth,
  children: [{ path: '/primeros-pasos', Component: OnboardingPage, handle: { title: 'Primeros pasos' } }, {
  Component: RequireOnboarding,
  children: [{ path: '/setup', Component: SetupFarmPage, handle: { title: 'Configurar finca' } }, {
  Component: RequireFarm,
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
  }],
  }],
}])
