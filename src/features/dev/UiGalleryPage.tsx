import { useState } from 'react'
import { Camera, Plus } from 'lucide-react'
import { Button, TextField, StatusPill, Notice, EmptyState, ErrorState, Skeleton, SkeletonText, PageHeader } from '../../components/ui'
import styles from './UiGalleryPage.module.css'

const variants = ['primary', 'secondary', 'ghost', 'danger'] as const
const sizes = ['md', 'sm'] as const
const tones = ['safe', 'warning', 'critical', 'inactive', 'info'] as const
const labels = { safe: 'En zona segura', warning: 'Requiere atención', critical: 'Fuera de zona', inactive: 'Sin conexión', info: 'Información' }
const variantLabels = { primary: 'Principal', secondary: 'Secundario', ghost: 'Discreto', danger: 'Peligro' }

export function UiGalleryPage() {
  const [message, setMessage] = useState('Selecciona una acción para probarla.')
  const [name, setName] = useState('')
  const [retries, setRetries] = useState(0)
  return <div className={styles.gallery}>
    <PageHeader title="Componentes" />
    <p>Galería de desarrollo · Datos y acciones de demostración.</p>
    <p role="status">{message}</p>
    <section className={styles.section} aria-labelledby="buttons-title">
      <h2 id="buttons-title">Botones</h2>
      {variants.map(variant => <div className={styles.group} key={variant}>
        <h3>{variantLabels[variant]}</h3>
        {sizes.map(size => <div className={styles.row} key={size}>
          <span>{size === 'md' ? 'Mediano' : 'Pequeño'}</span>
          <Button variant={variant} size={size} onClick={() => setMessage('Acción ejecutada.')}>Continuar</Button>
          <Button variant={variant} size={size} icon={Plus} onClick={() => setMessage('Cámara de demostración añadida.')}>Añadir cámara</Button>
          <Button variant={variant} size={size} loading icon={Plus}>Añadir cámara</Button>
          <Button variant={variant} size={size} disabled icon={Plus}>Añadir cámara</Button>
        </div>)}
      </div>)}
    </section>
    <section className={styles.section} aria-labelledby="fields-title">
      <h2 id="fields-title">Campos de texto</h2>
      <div className={styles.fields}>
        <TextField label="Nombre" name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required />
        <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" hint="Usa el correo asociado a tu cuenta." />
        <TextField label="Nombre de la cámara" name="camera" defaultValue="" hint="Elige un nombre fácil de reconocer." error="Escribe el nombre de la cámara." required />
        <TextField label="Contraseña" name="password" type="password" autoComplete="current-password" />
        <TextField label="Finca asignada" defaultValue="Finca de demostración" disabled />
        <TextField label="Identificador" value="CAM-001" readOnly />
      </div>
    </section>
    <section className={styles.section} aria-labelledby="pills-title">
      <h2 id="pills-title">Indicadores de estado</h2>
      {sizes.map(size => <div className={styles.row} key={size}>
        {tones.map(tone => <StatusPill key={tone} tone={tone} size={size} label={labels[tone]} />)}
      </div>)}
    </section>
    <section className={styles.section} aria-labelledby="notices-title">
      <h2 id="notices-title">Avisos</h2>
      {(['info', 'warning', 'critical', 'safe'] as const).map(tone => <Notice key={tone} tone={tone} title={labels[tone]}
        action={<Button variant="secondary" size="sm" onClick={() => setMessage(`Aviso consultado: ${labels[tone]}.`)}>Ver detalles</Button>}>
        Este aviso muestra un estado de demostración de la cámara del potrero.
      </Notice>)}
      <Notice tone="info" title="Aviso sin descripción" />
    </section>
    <section className={styles.section} aria-labelledby="empty-title">
      <h2 id="empty-title">Estados vacíos y errores</h2>
      <EmptyState title="Aún no hay cámaras" description="Añade una cámara para comenzar a monitorear la finca." icon={Camera}
        action={<Button icon={Plus} onClick={() => setMessage('Cámara de demostración añadida.')}>Añadir cámara</Button>} />
      <EmptyState title="No hay eventos" />
      <ErrorState description="Revisa tu conexión e inténtalo de nuevo." onRetry={() => setRetries(count => count + 1)} />
      <p role="status">Reintentos de demostración: {retries}</p>
      <ErrorState title="Cámara no disponible" description="Consulta su estado antes de continuar." icon={Camera} />
      <ErrorState />
    </section>
    <section className={styles.section} aria-labelledby="skeleton-title">
      <h2 id="skeleton-title">Carga de contenido</h2>
      <Skeleton />
      <Skeleton width="var(--space-16)" height="var(--space-16)" radius="var(--radius-full)" />
      <Skeleton height="var(--space-16)" radius="var(--radius-lg)" />
      <SkeletonText />
      <SkeletonText lines={5} />
    </section>
  </div>
}
