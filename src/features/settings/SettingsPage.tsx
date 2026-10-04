import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '../../app/auth/useAuth'
import { PageHeader, SkeletonText, StatusPill } from '../../components/ui'
import { eventCatalog, severityLabel } from '../../lib/eventCatalog'
import { can, type Permission } from '../../lib/permissions'
import { useResource } from '../../lib/useResource'
import { getCurrentFarm, getFarmPlan, getSecurityHours, listCameras, listFarmMembers, listSafeZones } from '../../services'
import type { EventKind, SafeZone, Sourced, UserRole } from '../../types/domain'
import styles from './SettingsPage.module.css'

const roleLabel: Record<UserRole, string> = { owner: 'Dueño', worker: 'Trabajador' }
const tone = { info: 'info', warning: 'warning', critical: 'critical' } as const
const pad = (hour: number) => String(hour).padStart(2, '0')

async function loadZones(ids: string[], signal: AbortSignal): Promise<Sourced<SafeZone[]>> {
  const results = await Promise.all(ids.map(id => listSafeZones(id, { signal })))
  return { data: results.flatMap(result => result.data ?? []), source: results[0]?.source ?? 'unavailable' }
}

/**
 * Settings are read-only: the backend has no endpoints to change any of them yet. Each section
 * says so instead of rendering controls that would not work.
 */
export function SettingsPage() {
  const { session } = useAuth()
  const role = session?.user.role ?? 'worker'
  const allowed = (permission: Permission) => can(role, permission)

  const farm = useResource(signal => getCurrentFarm({ signal }))
  const plan = useResource(signal => getFarmPlan({ signal }))
  const members = useResource(signal => listFarmMembers({ signal }))
  const cameras = useResource(signal => listCameras({ signal }))
  const hours = useResource(signal => getSecurityHours({ signal }))
  const ids = (cameras.data ?? []).map(camera => camera.id)
  const zones = useResource(signal => loadZones(ids, signal), { key: ids.join(',') })

  return <>
    <PageHeader title="Ajustes" />
    <p className={styles.intro}>
      <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
      Por ahora los ajustes son de solo lectura: el servidor todavía no permite modificarlos.
    </p>

    <div className={styles.sections}>
      <Section id="account" title="Cuenta" description="Tus datos de acceso a SmartCattle.">
        {session && <dl className={styles.list}>
          <Row label="Nombre">{session.user.name}</Row>
          <Row label="Correo electrónico">{session.user.email}</Row>
          <Row label="Rol">{roleLabel[session.user.role]}</Row>
          <Row label="Contraseña"><span className={styles.muted}>El cambio de contraseña llegará con la autenticación del servidor.</span></Row>
        </dl>}
      </Section>

      {allowed('farm:edit') && <Section id="farm" title="Finca" description="Nombre y lotes de la finca.">
        {farm.status === 'loading' ? <SkeletonText lines={2} /> : <dl className={styles.list}>
          <Row label="Nombre">{farm.data?.name ?? <Unavailable />}</Row>
          <Row label="Lotes">{plan.data
            ? <ul className={styles.chips}>{plan.data.lots.map(lot => <li key={lot.id}>{lot.name}</li>)}</ul>
            : <Unavailable />}</Row>
        </dl>}
      </Section>}

      {allowed('workers:manage') && <Section id="users" title="Usuarios"
        description="Personas con acceso a esta finca. Los trabajadores se unen por invitación del dueño.">
        {members.status === 'loading' ? <SkeletonText lines={2} /> : members.data
          ? <ul className={styles.people}>
            {members.data.map(member => <li key={member.id}>
              <span className={styles.avatar} aria-hidden="true">{initials(member.name)}</span>
              <span className={styles.person}>
                <span className={styles.personName}>{member.name}{member.id === session?.user.id && <span className={styles.you}> (tú)</span>}</span>
                <span className={styles.muted}>{member.email}</span>
              </span>
              <span className={styles.role}>{roleLabel[member.role]}</span>
            </li>)}
          </ul>
          : <Unavailable />}
        <p className={styles.note}>Invitar trabajadores y cambiar permisos estará disponible cuando el servidor lo ofrezca.</p>
      </Section>}

      {allowed('cameras:configure') && <Section id="cameras" title="Cámaras y zonas seguras"
        description="Qué cámara vigila cada zona.">
        {cameras.status === 'loading' ? <SkeletonText lines={3} /> : cameras.data
          ? <table className={styles.table}>
            <thead><tr><th scope="col">Cámara</th><th scope="col">Ubicación</th><th scope="col">Zona segura</th></tr></thead>
            <tbody>{cameras.data.map(camera => <tr key={camera.id}>
              <th scope="row">{camera.name}</th>
              <td>{camera.location}</td>
              <td>{zones.data?.find(zone => zone.cameraId === camera.id)?.name ?? <span className={styles.muted}>Sin zona</span>}</td>
            </tr>)}</tbody>
          </table>
          : <Unavailable />}
      </Section>}

      {allowed('security-hours:configure') && <Section id="security-hours" title="Horario de seguridad"
        description="En este horario, una persona detectada cerca del ganado se trata como posible intrusión.">
        {hours.data
          ? <dl className={styles.list}>
            <Row label="Horario restringido"><span className="tabular">{pad(hours.data.restrictedFrom)}:00 – {pad(hours.data.restrictedTo)}:00</span></Row>
            <Row label="Horario normal"><span className="tabular">{pad(hours.data.restrictedTo)}:00 – {pad(hours.data.restrictedFrom)}:00</span></Row>
          </dl>
          : hours.status === 'loading' ? <SkeletonText lines={2} /> : <Unavailable />}
      </Section>}

      {allowed('alerts:configure') && <Section id="alerts" title="Alertas"
        description="Cómo se clasifica cada tipo de evento. La severidad final la puede asignar el servidor.">
        <ul className={styles.alertTypes}>
          {(Object.keys(eventCatalog) as EventKind[]).map(kind => <li key={kind}>
            <span>{eventCatalog[kind].label}</span>
            <StatusPill tone={tone[eventCatalog[kind].defaultSeverity]} label={severityLabel[eventCatalog[kind].defaultSeverity]} />
          </li>)}
        </ul>
        <p className={styles.note}>Las notificaciones fuera de la aplicación (correo, mensajes) aún no existen en el servidor.</p>
      </Section>}

      {role === 'worker' && <p className={styles.note}>La finca, los usuarios, las cámaras y las alertas los gestiona el dueño de la finca.</p>}
    </div>
  </>
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return <section className={styles.section} aria-labelledby={`settings-${id}`}>
    <div className={styles.sectionHead}>
      <h2 id={`settings-${id}`} className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionDescription}>{description}</p>
    </div>
    <div className={styles.sectionBody}>{children}</div>
  </section>
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.row}><dt>{label}</dt><dd>{children}</dd></div>
}

function Unavailable() {
  return <span className={styles.muted}>No disponible en el servidor</span>
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join('')
