import { Link } from 'react-router'
import { AuthLayout } from './AuthLayout'
import { AuthForm } from './AuthForm'

export function LoginPage() {
  return <AuthLayout title="Ingresa a tu finca"
    description="Revisa tus cámaras, alertas y el estado del ganado desde cualquier lugar."
    footer={<>¿No tienes cuenta? <Link to="/register">Crear cuenta</Link></>}>
    <AuthForm mode="login" />
  </AuthLayout>
}
