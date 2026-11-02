import { PageHeader } from '../../components/ui/PageHeader'
import { useState } from 'react'
import { BadgeCheck, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../app/auth/useAuth'
import { Button } from '../../components/ui/Button'
import { FadeUp, staggerDelay } from '../../motion'
import styles from './ProfilePage.module.css'

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join('')

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
  const role = user.role === 'owner' ? 'Dueño' : 'Trabajador'
  // Worth showing: a demo session cannot change anything on the server, and
  // without this the only symptom is a write that fails for no visible reason.
  const sessionLabel = session.source === 'api'
    ? 'Verificada en el servidor'
    : 'Demostración local'
  return <div className={styles.page}>
    <FadeUp className={styles.head}>
      <PageHeader title="Perfil" />
      <p className={styles.lead}>Tu cuenta en SmartCattle y lo que puedes hacer con ella.</p>
    </FadeUp>

    <FadeUp delay={staggerDelay(1)} className={styles.card}>
      <div className={styles.banner}>
        <span className={styles.avatar} aria-hidden="true">{initials(user.name)}</span>
        <div className={styles.identity}>
          <p className={styles.name}>{user.name}</p>
          <p className={styles.role}><BadgeCheck size={16} strokeWidth={1.75} aria-hidden="true" />{role}</p>
        </div>
      </div>

      <dl className={styles.details}>
        <div><dt>Nombre</dt><dd>{user.name}</dd></div>
        <div><dt>Correo electrónico</dt><dd>{user.email}</dd></div>
        <div><dt>Rol</dt><dd>{role}</dd></div>
        {/*
          Only a demo account has these. The backend signs in by email and has
          no farm entity -- one deployment is one farm -- so a real session has
          nothing to put here, and an empty row reads as missing data rather
          than as a field that does not apply.
        */}
        {user.username && <div><dt>Usuario</dt><dd className="tabular">{user.username}</dd></div>}
        {user.farmId && <div><dt>Identificador de finca</dt><dd className="tabular">{user.farmId}</dd></div>}
        <div><dt>Sesión</dt><dd>{sessionLabel}</dd></div>
      </dl>

      <div className={styles.actions}>
        <Button variant="secondary" icon={LogOut} loading={leaving} onClick={handleLogout}>Cerrar sesión</Button>
      </div>
    </FadeUp>
  </div>
}
