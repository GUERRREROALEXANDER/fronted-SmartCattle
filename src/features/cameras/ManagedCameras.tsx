import { useState, type FormEvent } from 'react'
import { Plug, Trash2, Video, VideoOff } from 'lucide-react'
import { useAuth } from '../../app/auth/useAuth'
import { Button, EmptyState, Notice, StatusPill, TextField } from '../../components/ui'
import { useResource } from '../../lib/useResource'
import {
  configureManagedCamera, listManagedCameras, listSavedCameras, managedNameProblem, managedStateView, managerProblem,
  removeManagedCamera, rtspUrlProblem, type ManagedCamera,
} from '../../services'
import { HlsPlayer } from './HlsPlayer'
import styles from './ManagedCameras.module.css'

const REFRESH_MS = 3000

function ManagedCameraCard({ camera, watching, busy, onWatch, onRemove }: {
  camera: ManagedCamera; watching: boolean; busy: boolean; onWatch: () => void; onRemove: () => void
}) {
  const view = managedStateView(camera)
  const streaming = camera.state === 'transmitiendo' && camera.hlsUrl !== null
  return <li className={styles.card}>
    <div className={styles.cardHead}>
      <strong className={styles.cardName}>{camera.name}</strong>
      <StatusPill tone={view.tone} label={view.label} size="sm" />
    </div>
    {camera.address && <p className={`${styles.address} tabular`}>{camera.address}</p>}
    {watching && camera.hlsUrl && <HlsPlayer url={camera.hlsUrl} title={`Video en vivo de ${camera.name}`} />}
    {!(watching && camera.state === 'transmitiendo') && <p className={styles.note}>{view.text}</p>}
    <div className={styles.cardActions}>
      <Button variant="secondary" size="sm" icon={watching ? VideoOff : Video} disabled={!streaming && !watching} onClick={onWatch}>
        {watching ? 'Dejar de ver' : 'Ver en vivo'}
      </Button>
      <Button variant="ghost" size="sm" icon={Trash2} disabled={busy} onClick={onRemove}>Dejar de transmitir</Button>
    </div>
  </li>
}

function ManagerPanel() {
  const cameras = useResource(signal => listManagedCameras({ signal }), { refreshMs: REFRESH_MS })
  const saved = useResource(signal => listSavedCameras({ signal }))
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [watchingId, setWatchingId] = useState<string | null>(null)
  const nameProblem = managedNameProblem(name)
  const urlProblem = rtspUrlProblem(url)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setProblem(null)
    if (nameProblem || urlProblem) return
    setBusy(true)
    try {
      const camera = await configureManagedCamera(name, url)
      // The address holds the camera's password: it does not stay on screen.
      setName('')
      setUrl('')
      setSubmitted(false)
      setWatchingId(camera.id)
      cameras.refresh()
      saved.refresh()
    } catch (error) {
      setProblem(managerProblem(error))
    } finally {
      setBusy(false)
    }
  }

  async function remove(cameraId: string) {
    setBusy(true)
    setProblem(null)
    try {
      await removeManagedCamera(cameraId)
      if (watchingId === cameraId) setWatchingId(null)
      cameras.refresh()
    } catch (error) {
      setProblem(managerProblem(error))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <form className={styles.form} onSubmit={submit} noValidate>
      <TextField label="Nombre" value={name} onChange={event => setName(event.target.value)} list="managed-camera-names" required maxLength={80}
        placeholder="Corral" autoComplete="off"
        hint="Elige una de tus cámaras o escribe un nombre nuevo."
        error={submitted ? nameProblem ?? undefined : undefined} />
      <datalist id="managed-camera-names">
        {(saved.data ?? []).map(camera => <option key={camera.id} value={camera.name} />)}
      </datalist>
      <TextField label="URL RTSP" value={url} onChange={event => setUrl(event.target.value)} required maxLength={500}
        placeholder="rtsp://admin:clave@192.168.1.50:554/cam/realmonitor?channel=1&subtype=1" autoComplete="off" spellCheck={false} autoCapitalize="none"
        hint="Imou y Dahua usan la ruta del ejemplo; en Imou la clave es el código de seguridad de la etiqueta. La URL no se guarda."
        error={submitted ? urlProblem ?? undefined : undefined} />
      <Button type="submit" icon={Plug} loading={busy} className={styles.submit}>Conectar</Button>
    </form>

    {problem && <Notice tone="critical" title="No se pudo completar">{problem}</Notice>}
    {cameras.status === 'error' && <Notice tone="warning" title="Sin respuesta del servicio de cámaras">{managerProblem(cameras.error)} Se reintenta solo.</Notice>}

    {cameras.data && cameras.data.length === 0 && <EmptyState icon={Video} title="Ninguna cámara transmitiendo"
      description="Sin configurar: escribe su nombre y su URL para empezar a transmitir." />}
    {cameras.data && cameras.data.length > 0 && <ul className={styles.list}>
      {cameras.data.map(camera => <ManagedCameraCard key={camera.id} camera={camera} watching={watchingId === camera.id} busy={busy}
        onWatch={() => setWatchingId(current => current === camera.id ? null : camera.id)} onRemove={() => void remove(camera.id)} />)}
    </ul>}
  </>
}

/** Connects RTSP cameras through the backend, which holds the camera service's key, and plays them. */
export function ManagedCameras() {
  const { isDemoMode } = useAuth()
  return <section className={styles.section} aria-labelledby="managed-cameras-title">
    <h2 id="managed-cameras-title" className={styles.title}>Cámara por URL RTSP</h2>
    <p className={styles.note}>La mantenemos transmitiendo y la reconectamos si se cae.</p>
    {isDemoMode
      ? <Notice tone="info" title="No disponible en la demostración">Conectar una cámara por RTSP necesita el servidor de SmartCattle.</Notice>
      : <ManagerPanel />}
  </section>
}
