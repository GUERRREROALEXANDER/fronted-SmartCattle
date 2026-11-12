import { Navigate, Outlet } from 'react-router'
import { onboardingOf } from '../../features/onboarding/onboardingModel'
import { useAuth } from './useAuth'

/** The first time an account enters, Lucero receives it before anything else. It asks only once. */
export function RequireOnboarding() {
  const { session } = useAuth()
  if (session && !onboardingOf(session.user.id)) return <Navigate to="/primeros-pasos" replace />
  return <Outlet />
}
