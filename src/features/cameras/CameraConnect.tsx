import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Cctv, Keyboard, Plug, QrCode as QrIcon, Radar, Smartphone, Trash2, Unplug, Usb, Wifi } from 'lucide-react'
import { describeApiError } from '../../api/errors'
import { skipCameraSetup } from '../../app/auth/cameraSetupSkip'
import { withSessionToken } from '../../api/session'
import { Button, GlassCard, StatusPill, TextField } from '../../components/ui'
import { useResource } from '../../lib/useResource'
import {
  activeService, addCamera, cameraProblem, connectionFor, deleteSavedCamera, getServiceHost, ipCameraSource, listSavedCameras,
  phoneLink, removeCamera, saveCamera, scanCameras, serviceRoot, startPairing, waitForCamera,
  type CameraScan, type FoundCamera, type SavedCamera,
} from '../../services'
import type { Camera, CameraStatus } from '../../types/domain'
import { QrCode } from './QrCode'
import styles from './CameraConnect.module.css'

const statusPill: Record<CameraStatus, { tone: 'safe' | 'warning' | 'critical' | 'inactive' | 'info'; label: string }> = {
  online: { tone: 'safe', label: 'Conectada' },
  connecting: { tone: 'info', label: 'Conectando' },
  offline: { tone: 'inactive', label: 'Sin conectar' },
  error: { tone: 'critical', label: 'Con error' },
}
const kindLabel = { rtsp: 'Cámara IP', 'ip-webcam': 'Celular · IP Webcam', droidcam: 'Celular · DroidCam' } as const
const ease = [0.23, 1, 0.32, 1] as const
// The AI service tells the backend within seconds of a change, and nothing announces a removal: look a few times.
const REFRESH_AFTER_MS = [0, 1500, 3500, 6000]

/** A still from the AI service, refreshed every second; lighter than keeping one MJPEG stream per card open. */
function LivePreview({ baseUrl, name }: { baseUrl: string; name: string }) {
  const [tick, setTick] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => setTick(value => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  // A picture that failed is tried again every few seconds: the service may have been restarting.
  const showPicture = !failed || tick % 5 === 0
  return <div className={styles.preview}>
    {!showPicture
      ? <span className={styles.previewEmpty}><Cctv size={22} strokeWidth={1.75} aria-hidden="true" />Sin imagen todavía</span>
      : <img src={withSessionToken(`${baseUrl}/snapshot.jpg?t=${tick}`)} alt={`Imagen en vivo de ${name} con las detecciones de la IA`}
        onError={() => setFailed(true)} onLoad={() => setFailed(false)} />}
  </div>
}

function Instructions() {
  return <div className={styles.help}>
    <ol className={styles.steps}>
      <li><strong>Enciende la cámara</strong> y déjala en el mismo wifi que este PC.</li>
      <li><strong>Agrégala</strong>: búscala en la red, escanea el QR con el celular o escribe su dirección.</li>
      <li><strong>Pulsa Conectar</strong>. Hasta entonces no se abre el video ni trabaja la IA.</li>
    </ol>
    <details className={styles.advanced}>
      <summary>¿Qué tipo de cámara tienes?</summary>
      <dl className={styles.kinds}>
        <div>
          <dt><Wifi size={16} aria-hidden="true" />Cámara IP (Imou, Hikvision, Dahua…)</dt>
          <dd>Pulsa «Buscar cámaras». Si no aparece, escribe su IP: está en la app de la cámara o en tu router. Al conectar puedes escribir su contraseña; en Imou es el código de seguridad de la etiqueta.</dd>
        </div>
        <div>
          <dt><Smartphone size={16} aria-hidden="true" />Celular como cámara</dt>
          <dd>Instala IP Webcam (Android), ábrela y pulsa «Iniciar servidor». Luego escanea el QR de esta página con ese celular y escribe la dirección que muestra la app. Déjalo enchufado y con la app abierta.</dd>
        </div>
        <div>
          <dt><Usb size={16} aria-hidden="true" />Webcam o iVCam en este PC</dt>
          <dd>Elige «Escribir dirección» y pon su número: 0 es la primera webcam, 1 la siguiente. Con iVCam, abre primero la app en el celular y en el PC.</dd>
        </div>
      </dl>
    </details>
  </div>
}

/** One saved camera: its state, and the buttons that open and close it. */
function SavedCard({ camera, live, previews, busy, onConnect, onDisconnect, onDelete }: {
  camera: SavedCamera
  live: Camera | undefined
  previews: boolean
  busy: boolean
  onConnect: (username: string, password: string) => void
  onDisconnect: () => void
  onDelete: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const status: CameraStatus = live?.status ?? camera.status
  const connected = status === 'online'
  const name = camera.name
  return <GlassCard as="li" padding="none" className={styles.card}>
    {previews && connected && live?.streamUrl && <LivePreview baseUrl={live.streamUrl} name={name} />}
    <div className={styles.cardBody}>
      <span className={styles.cardName}><strong>{name}</strong><span className="tabular">{camera.source}</span></span>
      <StatusPill {...statusPill[status]} />
    </div>
    {live?.lastError && !connected && <p className={styles.error}>{live.lastError}</p>}
    {!connected && camera.source.startsWith('rtsp://') && <details className={`${styles.advanced} ${styles.login}`}>
      <summary>Usuario y contraseña de la cámara</summary>
      <div className={styles.fields}>
        <TextField label="Usuario" value={username} onChange={event => setUsername(event.target.value)} autoComplete="off" hint="Vacío: admin." />
        <TextField label="Contraseña" type="password" value={password} onChange={event => setPassword(event.target.value)}
          autoComplete="new-password" hint="No se guarda: va directo al PC de la finca." />
      </div>
    </details>}
    <div className={styles.cardActions}>
      {connected
        ? <Button variant="secondary" size="sm" icon={Unplug} loading={busy} onClick={onDisconnect}>Desconectar</Button>
        : <Button size="sm" icon={Plug} loading={busy} onClick={() => { onConnect(username, password); setPassword('') }}>Conectar</Button>}
      <Button variant="ghost" size="sm" icon={Trash2} disabled={busy} onClick={onDelete} aria-label={`Quitar ${name}`}>Quitar</Button>
    </div>
  </GlassCard>
}

/** Shows the QR that opens, on a phone, the page where it adds itself to this account. */
function QrPanel({ serviceBase, onWaiting }: { serviceBase: string; onWaiting: (waiting: boolean) => void }) {
  const [link, setLink] = useState<string | null>(null)
  const [problem, setProblem] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => () => onWaiting(false), [onWaiting])

  const show = async () => {
    setLoading(true)
    setProblem('')
    try {
      const [pairing, host] = await Promise.all([startPairing(), getServiceHost(serviceBase).catch(() => null)])
      const url = phoneLink(pairing.code, globalThis.location, host)
      if (!url) {
        setProblem('Este PC no tiene una dirección a la que llegue un celular. Conéctalo al wifi y vuelve a intentarlo.')
        return
      }
      setLink(url)
      onWaiting(true)
    } catch (error) {
      setProblem(describeApiError(error).description)
    } finally {
      setLoading(false)
    }
  }

  return <div className={styles.qr}>
    {link && <div className={styles.qrCode}><QrCode value={link} label="Código QR para agregar una cámara desde el celular" /></div>}
    <div className={styles.qrText}>
      <p className={styles.note}>Escanéalo con la cámara del celular, conectado al mismo wifi. Se abrirá una página para agregar la cámara a tu cuenta; cuando termines aparecerá aquí.</p>
      {link && <p className={styles.note}>Sirve una sola vez y dura 10 minutos.</p>}
      <Button variant="secondary" icon={QrIcon} loading={loading} onClick={show}>{link ? 'Generar otro QR' : 'Mostrar QR'}</Button>
      {problem && <p className={styles.error} role="alert">{problem}</p>}
    </div>
  </div>
}

type Way = 'scan' | 'qr' | 'type'
type Kind = 'ip' | 'url'

/**
 * The place to connect cameras: what to do, the account's saved cameras with the button that opens each one, and three
 * ways to add another. Saving opens nothing; the camera and the AI only start on pressing Connect.
 */
export function CameraConnect({ cameras, onChanged, previews = true }: { cameras: readonly Camera[]; onChanged?: () => void; previews?: boolean }) {
  const reduce = useReducedMotion()
  const serviceBase = activeService(cameras)
  const [waitingForPhone, setWaitingForPhone] = useState(false)
  const saved = useResource(signal => listSavedCameras({ signal }))
  const [way, setWay] = useState<Way>('scan')
  const [scan, setScan] = useState<CameraScan | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [kind, setKind] = useState<Kind>('ip')
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [path, setPath] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [result, setResult] = useState<{ tone: 'safe' | 'critical'; text: string } | null>(null)
  const reloadSaved = saved.reload
  const refreshList = () => REFRESH_AFTER_MS.forEach(delay => setTimeout(() => { onChanged?.(); reloadSaved() }, delay))
  const list = saved.data ?? []
  const liveOf = (id: string) => cameras.find(camera => camera.id === id)

  // With a camera in the account, the app no longer needs to bring this person back here.
  const hasCameras = list.length > 0
  useEffect(() => { if (hasCameras) skipCameraSetup() }, [hasCameras])

  // A camera added from the phone appears here without touching this PC.
  useEffect(() => {
    if (!waitingForPhone) return
    const timer = setInterval(reloadSaved, 3000)
    return () => clearInterval(timer)
  }, [waitingForPhone, reloadSaved])

  const problemText = (error: unknown) => {
    const { title, description } = describeApiError(error)
    return cameraProblem(error) ?? `${title}. ${description}`
  }

  const runScan = async () => {
    setScanning(true)
    setScanError('')
    try {
      setScan(await scanCameras(serviceBase))
    } catch (error) {
      setScanError(cameraProblem(error) ?? describeApiError(error).description)
    } finally {
      setScanning(false)
    }
  }

  const pickFound = (found: FoundCamera) => {
    if (found.kinds.includes('rtsp')) {
      setKind('ip')
      setHost(found.host)
    } else {
      setKind('url')
      setUrl(found.kinds.includes('droidcam') ? `${found.host}:4747/video` : `${found.host}:8080`)
    }
    setWay('type')
    setResult(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setResult(null)
    try {
      await saveCamera(name, kind === 'ip' ? ipCameraSource(host, path) : url)
      setName('')
      setHost('')
      setPath('')
      setUrl('')
      setResult({ tone: 'safe', text: 'Cámara guardada. Pulsa Conectar para ver el video y que la IA empiece a analizarla.' })
      reloadSaved()
    } catch (error) {
      setResult({ tone: 'critical', text: /credentials/i.test(describeApiError(error).description)
        ? 'Quita el usuario y la contraseña de la dirección: se escriben al conectar.'
        : problemText(error) })
    } finally {
      setSaving(false)
    }
  }

  const connect = async (camera: SavedCamera, username: string, password: string) => {
    setBusyId(camera.id)
    setResult(null)
    try {
      const added = await addCamera(serviceBase, { ...connectionFor(camera.source, { username, password }), cameraId: camera.id })
      // The service answers at once and opens the camera in the background: wait until it says how it went.
      const state = await waitForCamera(added.streamUrl)
      if (state.status === 'online') {
        setResult({ tone: 'safe', text: `${camera.name} ya transmite y la IA está analizando la imagen.` })
        refreshList()
        return
      }
      // A camera that never opened must not stay retrying in the background; connecting again starts it over.
      await removeCamera(serviceBase, added.cameraId).catch(() => {})
      setResult({ tone: 'critical', text: state.error
        ? `No se pudo abrir ${camera.name}: revisa la dirección, el usuario y la contraseña. (${state.error})`
        : `${camera.name} no respondió a tiempo. Comprueba que esté encendida y en el mismo wifi que este PC.` })
    } catch (error) {
      setResult({ tone: 'critical', text: problemText(error) })
    } finally {
      setBusyId('')
    }
  }

  const stop = async (camera: SavedCamera) => {
    const live = liveOf(camera.id)
    await removeCamera(live?.streamUrl ? serviceRoot(live.streamUrl) : serviceBase, camera.id)
  }

  const disconnect = async (camera: SavedCamera) => {
    setBusyId(camera.id)
    setResult(null)
    try {
      await stop(camera)
      refreshList()
    } catch (error) {
      setResult({ tone: 'critical', text: problemText(error) })
    } finally {
      setBusyId('')
    }
  }

  const forget = async (camera: SavedCamera) => {
    setBusyId(camera.id)
    setResult(null)
    try {
      // It may not be running, and that must not stop it from being removed.
      await stop(camera).catch(() => {})
      await deleteSavedCamera(camera.id)
      refreshList()
    } catch (error) {
      setResult({ tone: 'critical', text: problemText(error) })
    } finally {
      setBusyId('')
    }
  }

  const ways: { id: Way; icon: typeof Radar; label: string }[] = [
    { id: 'scan', icon: Radar, label: 'Buscar en la red' },
    { id: 'qr', icon: QrIcon, label: 'Con QR y el celular' },
    { id: 'type', icon: Keyboard, label: 'Escribir dirección' },
  ]

  return <div className={styles.wrap}>
    <Instructions />

    {!serviceBase && <p className={styles.error}>El servicio de IA no está corriendo en este PC, así que no se puede buscar ni conectar cámaras.</p>}
    {result && <p className={result.tone === 'safe' ? styles.ok : styles.error} role="status">{result.text}</p>}

    <section aria-labelledby="camera-list-title">
      <h2 id="camera-list-title" className={styles.title}>Mis cámaras</h2>
      {saved.status === 'error' && !saved.data && <p className={styles.error}>No se pudo cargar la lista de cámaras.</p>}
      {saved.data && list.length === 0 && <p className={styles.note}>Todavía no tienes cámaras. Agrega la primera aquí abajo.</p>}
      {list.length > 0 && <ul className={styles.grid}>
        {list.map(camera => <SavedCard key={camera.id} camera={camera} live={liveOf(camera.id)} previews={previews}
          busy={busyId === camera.id} onConnect={(username, password) => void connect(camera, username, password)}
          onDisconnect={() => void disconnect(camera)} onDelete={() => void forget(camera)} />)}
      </ul>}
    </section>

    <GlassCard as="section" padding="lg" aria-labelledby="camera-connect-title" className={styles.connect}>
      <h2 id="camera-connect-title" className={styles.title}>Agregar una cámara</h2>
      <div className={styles.modes} role="group" aria-label="Cómo agregarla">
        {ways.map(item => <button key={item.id} type="button" className={styles.mode} aria-pressed={way === item.id} onClick={() => setWay(item.id)}>
          <item.icon size={16} aria-hidden="true" />{item.label}
        </button>)}
      </div>

      {way === 'scan' && <div className={styles.found}>
        <p className={styles.note}>Busca cámaras y celulares encendidos en el wifi de este PC. Tarda unos segundos.</p>
        <Button variant="secondary" icon={Radar} loading={scanning} onClick={runScan} disabled={!serviceBase} className={styles.action}>Buscar cámaras</Button>
        {scanError && <p className={styles.error} role="alert">{scanError}</p>}
        <AnimatePresence initial={false}>
          {scan && <motion.div key="scan" className={styles.found}
            initial={{ opacity: 0, transform: reduce ? 'none' : 'translateY(-6px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.22, ease }}>
            <p className={styles.note}>
              {scan.cameras.length === 0
                ? `No se encontraron cámaras en ${scan.network ?? 'la red'}. Comprueba que estén encendidas y en el mismo wifi, o escribe la dirección.`
                : `${scan.cameras.length === 1 ? 'Se encontró 1 posible cámara' : `Se encontraron ${scan.cameras.length} posibles cámaras`} en ${scan.network}.`}
            </p>
            <ul className={styles.foundList}>
              {scan.cameras.map(found => <li key={found.host}>
                <button type="button" className={styles.foundItem} onClick={() => pickFound(found)}>
                  {found.kinds.includes('rtsp') ? <Wifi size={18} aria-hidden="true" /> : <Smartphone size={18} aria-hidden="true" />}
                  <span><strong className="tabular">{found.host}</strong><span>{found.kinds.map(item => kindLabel[item]).join(' · ')}</span></span>
                  <span className={styles.use}>Usar</span>
                </button>
              </li>)}
            </ul>
          </motion.div>}
        </AnimatePresence>
      </div>}

      {way === 'qr' && <QrPanel serviceBase={serviceBase} onWaiting={setWaitingForPhone} />}

      {way === 'type' && <form className={styles.form} onSubmit={submit}>
        <div className={styles.modes} role="group" aria-label="Tipo de cámara">
          <button type="button" className={styles.mode} aria-pressed={kind === 'ip'} onClick={() => setKind('ip')}>
            <Wifi size={16} aria-hidden="true" />Cámara IP
          </button>
          <button type="button" className={styles.mode} aria-pressed={kind === 'url'} onClick={() => setKind('url')}>
            <Smartphone size={16} aria-hidden="true" />Celular, webcam o enlace
          </button>
        </div>
        <div className={styles.fields}>
          <TextField label="Nombre" value={name} onChange={event => setName(event.target.value)} required maxLength={80}
            placeholder="Potrero norte" autoComplete="off" />
          {kind === 'ip'
            ? <TextField label="Dirección IP" value={host} onChange={event => setHost(event.target.value)} required
              placeholder="192.168.1.30" inputMode="decimal" autoComplete="off" />
            : <TextField label="Dirección o número de webcam" value={url} onChange={event => setUrl(event.target.value)} required
              placeholder="192.168.1.20:8080  ·  rtsp://…  ·  1" autoComplete="off"
              hint="IP Webcam: la dirección que muestra la app. Webcam o iVCam: su número (0 o 1)." />}
          {kind === 'ip' && <details className={styles.advanced}>
            <summary>Ruta de la cámara (solo si no es Imou ni Dahua)</summary>
            <div className={styles.fields}>
              <TextField label="Ruta RTSP" value={path} onChange={event => setPath(event.target.value)} autoComplete="off"
                placeholder="/cam/realmonitor?channel=1&subtype=1"
                hint="Vacía: la de Imou y Dahua. Hikvision: /Streaming/Channels/102. Otra marca: revisa su manual." />
            </div>
          </details>}
        </div>
        <Button type="submit" icon={Plug} loading={saving}>Guardar cámara</Button>
      </form>}
    </GlassCard>
  </div>
}
