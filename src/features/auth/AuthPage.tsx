import { Link, useLocation } from 'react-router'
import { AuthLayout } from './AuthLayout'
import { AuthForm } from './AuthForm'

const copy = {
  login: {
    title: 'Ingresa a tu finca',
    description: 'Tu ganado, tus zonas seguras y cada alerta, en un solo lugar.',
    footer: <>¿No tienes cuenta? <Link to="/register">Crear cuenta</Link></>,
  },
  register: {
    title: 'Crea tu cuenta',
    description: 'Empieza a cuidar tu finca con monitoreo claro y alertas oportunas.',
    footer: <>¿Ya tienes cuenta? <Link to="/login">Ingresar</Link></>,
  },
} as const

// Both routes render this same component so the form stays mounted and animates between modes.
export function AuthPage() {
  const { pathname } = useLocation()
  const mode = pathname.startsWith('/register') ? 'register' : 'login'
  const { title, description, footer } = copy[mode]
  return <AuthLayout mode={mode} title={title} description={description} footer={footer}>
    <AuthForm mode={mode} />
  </AuthLayout>
}
