import { Link } from 'react-router'
import { AuthLayout } from './AuthLayout'
import { AuthForm } from './AuthForm'

export function RegisterPage() {
  return <AuthLayout title="Crea tu cuenta"
    description="Registra tu finca para empezar a monitorear tu ganado."
    footer={<>¿Ya tienes cuenta? <Link to="/login">Ingresar</Link></>}>
    <AuthForm mode="register" />
  </AuthLayout>
}
