import { PageHeader } from '../../components/ui/PageHeader'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../app/auth/useAuth'
import { Button } from '../../components/ui/Button'
import styles from './ProfilePage.module.css'

export function ProfilePage() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const user = session?.user
  if (!user) return null

  async function handleLogout() {
    setLeaving(true)
    try { await logout() }
    finally { void navigate('/login', { replace: true }) }
  }
  return <>
    <PageHeader title="Perfil" />
    <dl className={styles.details}>
      <div><dt>Nombre</dt><dd>{user.name}</dd></div>
      <div><dt>Correo electrónico</dt><dd>{user.email}</dd></div>
      <div><dt>Rol</dt><dd>{user.role === 'owner' ? 'Dueño' : 'Trabajador'}</dd></div>
      <div><dt>Identificador de finca</dt><dd>{user.farmId}</dd></div>
    </dl>
    <Button variant="secondary" icon={LogOut} loading={leaving} onClick={handleLogout}>Cerrar sesión</Button>
  </>
}
