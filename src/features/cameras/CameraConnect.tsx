import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AppWindow, Cctv, Laptop, Plug, QrCode as QrIcon, Radar, Smartphone, Trash2, Unplug, Usb, Wifi } from 'lucide-react'
import { aiServiceUrl } from '../../api/config'
import { ApiError, describeApiError } from '../../api/errors'
import { skipCameraSetup } from '../../app/auth/cameraSetupSkip'
import { withSessionToken } from '../../api/session'
import { Button, GlassCard, StatusPill, TextField } from '../../components/ui'
import { useResource } from '../../lib/useResource'
import {
  DEVICE_SOURCE, activeService, addCamera, addressProblem, cameraProblem, cameraSourceFrom, canShareScreen, connectionFor, deleteSavedCamera, getFarmPc, getServiceHost, isDeviceCamera, isScreenCamera, listSavedCameras, onlyInsideItsNetwork,
  loginProblem, phoneLink, rememberScreenCamera, removeCamera, saveCamera, scanCameras, serviceRoot, startFarmPcPairing, startPairing, waitForCamera,
  type CameraScan, type FoundCamera, type SavedCamera,
} from '../../services'
import type { Camera, CameraStatus } from '../../types/domain'
import { QrCode } from './QrCode'
import { useDeviceCamera } from './useDeviceCamera'
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
    <details className={styles.advanced}>
      <summary>¿Qué tipo de cámara tienes?</summary>
      <dl className={styles.kinds}>
        <div>
          <dt><Wifi size={16} aria-hidden="true" />Cámara IP (Imou, Hikvision, Dahua…)</dt>
          <dd>Con dirección pública, escríbela. Con una 192.168.x.x solo se puede abrir desde su wifi, así que hace falta enlazar un PC allí. Al conectar puedes escribir su contraseña; en Imou es el código de seguridad de la etiqueta.</dd>
        </div>
        <div>
          <dt><Smartphone size={16} aria-hidden="true" />Celular como cámara</dt>
          <dd>Abre esta página en el celular y pulsa «Transmitir». Déjalo enchufado, con la página abierta y la pantalla encendida.</dd>
        </div>
        <div>
          <dt><Usb size={16} aria-hidden="true" />Webcam de este PC</dt>
          <dd>Elige «Este celular o PC» y pulsa «Transmitir».</dd>
        </div>
      </dl>
    </details>
  </div>
}

const DOWNLOAD = 'https://github.com/GUERRREROALEXANDER/modelo-de-IA-yolo-ultralytics-SmartCattel/archive/refs/heads/main.zip'

/** Shown while no PC answers for this account: without one at the farm, nothing can open its cameras. */
function FarmPcPanel() {
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState('')
  const [loading, setLoading] = useState(false)

  const show = async () => {
    setLoading(true)
    setProblem('')
    try {
      setCode((await startFarmPcPairing()).code)
    } catch (error) {
      setProblem(describeApiError(error).description)
    } finally {
      setLoading(false)
    }
  }

  return <GlassCard as="section" padding="lg" aria-labelledby="farm-pc-title" className={styles.connect}>
    <h2 id="farm-pc-title" className={styles.title}>Enlaza un PC en la finca</h2>
    <p className={styles.note}>
      Una cámara IP con dirección 192.168.x.x solo se puede abrir desde su mismo wifi. Si no quieres usar un celular, deja allí un PC encendido con internet y enlázalo una vez; después verás esa cámara desde cualquier sitio. Si ya lo enlazaste, solo enciéndelo: esta página lo detectará sola.
    </p>
    <ol className={styles.steps}>
      <li>En ese PC, <a href={DOWNLOAD}>descarga el programa</a> y descomprímelo.</li>
      <li>Abre <strong>Iniciar SmartCattle</strong>. La primera vez tarda varios minutos.</li>
      <li>Cuando te lo pida, escribe este código. Sirve una vez y dura 10 minutos.</li>
    </ol>
    {code
      ? <p className={styles.pairCode} aria-label={`Código: ${code}`}>{code}</p>
      : <Button variant="secondary" icon={Laptop} loading={loading} onClick={show} className={styles.action}>Mostrar código</Button>}
    {problem && <p className={styles.error} role="alert">{problem}</p>}
  </GlassCard>
}

/** One saved camera: its state, and the buttons that open and close it. */
function SavedCard({ camera, live, previews, busy, canConnect, asksLogin, onConnect, onDisconnect, onDelete }: {
  canConnect: boolean
  /** The camera refused without a login: only now is it worth asking for one. */
  asksLogin: boolean
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
      <span className={styles.cardName}><strong>{name}</strong><span className="tabular">{!isDeviceCamera(camera.source) ? camera.source : isScreenCamera(camera.id) ? 'Ventana de un computador' : 'Cámara de un celular'}</span></span>
      <StatusPill {...statusPill[status]} />
    </div>
    {live?.lastError && !connected && <p className={styles.error}>{live.lastError}</p>}
    {!connected && camera.source.startsWith('rtsp://') && <details className={styles.advanced} open={asksLogin || undefined}>
      <summary>Esta cámara pide usuario y contraseña</summary>
      <div className={`${styles.fields} ${styles.login}`}>
        <TextField label="Usuario de la cámara" name="camera-rtsp-user" value={username} onChange={event => setUsername(event.target.value)} autoComplete="off"
          placeholder="admin" hint="No es tu correo. Vacío: admin." />
        <TextField label="Contraseña de la cámara" name="camera-rtsp-secret" type="password" value={password} onChange={event => setPassword(event.target.value)}
          autoComplete="new-password" hint="En Imou, el código de la etiqueta. No se guarda." />
      </div>
    </details>}
    <div className={styles.cardActions}>
      {connected
        ? <Button variant="secondary" size="sm" icon={Unplug} loading={busy} onClick={onDisconnect}>Desconectar</Button>
        : <Button size="sm" icon={Plug} loading={busy} disabled={!canConnect} onClick={() => { onConnect(username, password); setPassword('') }}>Conectar</Button>}
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

/** Takes a person at a computer to this same page on their phone, where the camera is. */
function OpenOnPhone() {
  const { hostname, origin, pathname } = globalThis.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null
  return <div className={styles.qr}>
    <div className={styles.qrCode}><QrCode value={`${origin}${pathname}`} label="Código QR para abrir esta página en el celular" /></div>
    <p className={styles.note}>¿Estás en un computador? Escanea esto con el celular que hará de cámara y entra con tu cuenta.</p>
  </div>
}

type Way = 'device' | 'scan' | 'qr'

/**
 * The place to connect cameras: a name and a link are enough, and the camera opens at once. A login is asked for only
 * if the camera refuses without one; the other ways of adding a camera wait behind "Otras formas".
 */
export function CameraConnect({ cameras, onChanged, previews = true }: { cameras: readonly Camera[]; onChanged?: () => void; previews?: boolean }) {
  const reduce = useReducedMotion()
  const farmPc = useResource(signal => getFarmPc({ signal }), { refreshMs: 10_000 })
  // This account's PC, once it answers; a service set up for this page otherwise, as when everything runs on one PC.
  const serviceBase = activeService(cameras, farmPc.data || aiServiceUrl)
  const [waitingForPhone, setWaitingForPhone] = useState(false)
  const saved = useResource(signal => listSavedCameras({ signal }))
  const [way, setWay] = useState<Way>('device')
  const [deviceName, setDeviceName] = useState('')
  const [needsFarmPc, setNeedsFarmPc] = useState(false)
  const [scan, setScan] = useState<CameraScan | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [loginFor, setLoginFor] = useState('')
  const [othersOpen, setOthersOpen] = useState(() => new URLSearchParams(globalThis.location.search).get('con') === 'celular')
  const [result, setResult] = useState<{ tone: 'safe' | 'critical'; text: string } | null>(null)
  const broadcastEnded = useCallback((text: string) => setResult({ tone: 'critical', text }), [])
  const [anyName, setAnyName] = useState('')
  const { videoRef: deviceVideo, activeId: broadcastingId, weakSignal, open: openDevice, openScreen, send: sendFromDevice, stop: stopDevice } = useDeviceCamera(broadcastEnded)
  const reloadSaved = saved.refresh
  // Something on a local network can reach its cameras: a linked PC, or a service running on this network. In the cloud, no.
  const reachesLocalCameras = Boolean(farmPc.data) || Boolean(serviceBase && !serviceBase.startsWith('https://'))
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
    setLink(found.kinds.includes('rtsp') ? found.host : found.kinds.includes('droidcam') ? `${found.host}:4747/video` : `${found.host}:8080`)
    setResult(null)
    document.getElementById('camera-connect-title')?.scrollIntoView({ block: 'center' })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const address = cameraSourceFrom(link)
    const wrong = addressProblem(address)
    if (wrong) {
      setResult({ tone: 'critical', text: wrong })
      return
    }
    if (!reachesLocalCameras && onlyInsideItsNetwork(link)) {
      setNeedsFarmPc(true)
      setResult({ tone: 'critical', text: 'Esa dirección solo existe dentro del wifi de la cámara y no se puede abrir desde internet. Usa «Este celular o PC» para transmitir sin dirección, escribe una dirección pública o enlaza un PC en la finca.' })
      return
    }
    setSaving(true)
    setResult(null)
    try {
      const camera = await saveCamera(name, address)
      setName('')
      setLink('')
      reloadSaved()
      // Saved is not the goal, seeing it is: open it right away. Without a service to open it, the card waits.
      if (serviceBase) await connect(camera, '', '')
      else {
        setNeedsFarmPc(true)
        setResult({ tone: 'safe', text: 'Cámara guardada. Podrás conectarla cuando el PC de la finca esté encendido.' })
      }
    } catch (error) {
      setResult({ tone: 'critical', text: /credentials/i.test(describeApiError(error).description)
        ? 'Quita el usuario y la contraseña de la dirección: se escriben al conectar.'
        : problemText(error) })
    } finally {
      setSaving(false)
    }
  }

  const broadcast = async (camera: SavedCamera, opened?: MediaStream) => {
    setBusyId(camera.id)
    setResult(null)
    try {
      const media = opened ?? await (isScreenCamera(camera.id) ? openScreen() : openDevice())
      const added = await addCamera(serviceBase, { kind: 'browser', cameraId: camera.id }).catch((error: unknown) => {
        media.getTracks().forEach(track => track.stop())
        throw error
      })
      sendFromDevice(media, serviceBase, added.cameraId)
      const state = await waitForCamera(added.streamUrl)
      if (state.status === 'online') {
        setResult({ tone: 'safe', text: `${camera.name} ya transmite. Deja esta página abierta; se puede ver desde cualquier lugar entrando con tu cuenta.` })
        refreshList()
        return
      }
      stopDevice()
      setResult({ tone: 'critical', text: `${camera.name} no llegó al servicio. Revisa la señal de este celular y vuelve a intentarlo.` })
    } catch (error) {
      const own = error instanceof Error && !(error instanceof ApiError) && error.cause !== undefined
      // Closing the dialog of windows is a change of mind, not a problem: it has no text.
      if (!own || error.message) setResult({ tone: 'critical', text: own ? error.message : problemText(error) })
    } finally {
      setBusyId('')
    }
  }

  /** The window is chosen first: browsers only allow asking right after the click, and a change of mind saves nothing. */
  const addAnyCamera = async (event: FormEvent) => {
    event.preventDefault()
    setResult(null)
    let media: MediaStream
    try {
      media = await openScreen()
    } catch (error) {
      if (error instanceof Error && error.message) setResult({ tone: 'critical', text: error.message })
      return
    }
    setSaving(true)
    try {
      const camera = await saveCamera(anyName, DEVICE_SOURCE)
      rememberScreenCamera(camera.id)
      setAnyName('')
      reloadSaved()
      await broadcast(camera, media)
    } catch (error) {
      media.getTracks().forEach(track => track.stop())
      setResult({ tone: 'critical', text: problemText(error) })
    } finally {
      setSaving(false)
    }
  }

  const addDevice = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setResult(null)
    try {
      const camera = await saveCamera(deviceName, DEVICE_SOURCE)
      setDeviceName('')
      reloadSaved()
      await broadcast(camera)
    } catch (error) {
      setResult({ tone: 'critical', text: problemText(error) })
    } finally {
      setSaving(false)
    }
  }

  const connect = async (camera: SavedCamera, username: string, password: string) => {
    if (isDeviceCamera(camera.source)) {
      await broadcast(camera)
      return
    }
    const wrong = loginProblem(username)
    if (wrong) {
      setResult({ tone: 'critical', text: wrong })
      return
    }
    setBusyId(camera.id)
    setResult(null)
    setLoginFor('')
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
      if (state.error && camera.source.startsWith('rtsp://')) setLoginFor(camera.id)
      setResult({ tone: 'critical', text: state.error
        ? `No se pudo abrir ${camera.name}: revisa la dirección y, si la pide, escribe su contraseña en la tarjeta. (${state.error})`
        : `${camera.name} no respondió a tiempo. Comprueba que esté encendida y en el mismo wifi que este PC.` })
    } catch (error) {
      if (error instanceof ApiError && /password/i.test(error.detail ?? '')) setLoginFor(camera.id)
      setResult({ tone: 'critical', text: problemText(error) })
    } finally {
      setBusyId('')
    }
  }

  const stop = async (camera: SavedCamera) => {
    if (broadcastingId === camera.id) {
      stopDevice()
      return
    }
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
    { id: 'device', icon: Smartphone, label: 'Este celular o PC' },
    // Both are about a local network: from the cloud there is none to search, and a phone app's address would not open.
    ...(reachesLocalCameras ? [
      { id: 'scan' as const, icon: Radar, label: 'Buscar en la red' },
      { id: 'qr' as const, icon: QrIcon, label: 'App IP Webcam (QR)' },
    ] : []),
  ]

  return <div className={styles.wrap}>
    <section aria-labelledby="camera-connect-title" className={styles.quick}>
      <h2 id="camera-connect-title" className={styles.quickTitle}>Agrega una cámara</h2>
      <form className={styles.quickForm} onSubmit={submit}>
        <TextField label="Nombre" value={name} onChange={event => setName(event.target.value)} required maxLength={80}
          placeholder="Potrero norte" autoComplete="off" />
        <TextField label="Enlace o IP de la cámara" value={link} onChange={event => setLink(event.target.value)} required
          placeholder="192.168.1.20 o rtsp://…" autoComplete="off" inputMode="url" />
        <Button type="submit" icon={Plug} loading={saving || Boolean(busyId)} className={styles.quickSubmit}>Conectar</Button>
      </form>
    </section>

    <section aria-labelledby="any-camera-title" className={styles.quick}>
      <h2 id="any-camera-title" className={styles.quickTitle}>Conecta cualquier cámara</h2>
      <p className={styles.note}>Sin importar la marca ni el modelo, y sin IP ni contraseña: si ves su imagen en este computador, la IA puede analizarla.</p>
      {canShareScreen()
        ? <>
          <ol className={styles.steps}>
            <li>Abre la imagen de la cámara en su app, en el navegador o en el programa del grabador.</li>
            <li>Escribe un nombre y pulsa el botón.</li>
            <li>Elige la ventana donde se ve la cámara.</li>
          </ol>
          <form className={styles.anyForm} onSubmit={addAnyCamera}>
            <TextField label="Nombre" value={anyName} onChange={event => setAnyName(event.target.value)} required maxLength={80}
              placeholder="Corral" autoComplete="off" />
            <Button type="submit" icon={AppWindow} loading={saving} disabled={!serviceBase || Boolean(broadcastingId)} className={styles.quickSubmit}>Elegir la ventana</Button>
          </form>
          <p className={styles.note}>
            {serviceBase
              ? 'Deja ese computador encendido y la ventana abierta, sin minimizarla: la IA analiza lo que se ve en ella. Si algo la tapa, también lo verá.'
              : 'Para usarlo, enciende primero el servicio de IA o el PC de la finca.'}
          </p>
        </>
        : <p className={styles.note}>Esto se hace desde un computador, en Chrome o Edge. Desde este celular puedes transmitir su propia cámara en «Otras formas».</p>}
    </section>

    {needsFarmPc && !farmPc.data && farmPc.status !== 'loading' && <FarmPcPanel />}
    {result && <p className={result.tone === 'safe' ? styles.ok : styles.error} role="status">{result.text}</p>}

    <div className={styles.broadcast} hidden={!broadcastingId}>
      <video ref={deviceVideo} className={styles.broadcastVideo} muted playsInline aria-label="Lo que ve la cámara de este dispositivo" />
      <p className={weakSignal ? styles.error : styles.ok} role="status">
        {weakSignal
          ? 'Sin señal por el momento. Sigue intentando; no cierres esta página.'
          : 'Transmitiendo desde este dispositivo. Déjalo enchufado, con esta página abierta y la pantalla encendida.'}
      </p>
    </div>

    <section aria-labelledby="camera-list-title">
      <h2 id="camera-list-title" className={styles.title}>Mis cámaras</h2>
      {saved.status === 'error' && !saved.data && <p className={styles.error}>No se pudo cargar la lista de cámaras.</p>}
      {saved.data && list.length === 0 && <p className={styles.note}>Todavía no tienes cámaras. Agrega la primera aquí arriba.</p>}
      {list.length > 0 && <ul className={styles.grid}>
        {list.map(camera => <SavedCard key={camera.id} camera={camera} live={liveOf(camera.id)} previews={previews}
          asksLogin={loginFor === camera.id} busy={busyId === camera.id} canConnect={Boolean(serviceBase)} onConnect={(username, password) => void connect(camera, username, password)}
          onDisconnect={() => void disconnect(camera)} onDelete={() => void forget(camera)} />)}
      </ul>}
    </section>

    <details className={styles.others} open={othersOpen} onToggle={event => setOthersOpen(event.currentTarget.open)}>
      <summary className={styles.othersTitle}>Otras formas: un celular, buscar en la red o QR</summary>
      {!needsFarmPc && !serviceBase && !farmPc.data && farmPc.status !== 'loading' && <FarmPcPanel />}
      <Instructions />
      <div className={styles.modes} role="group" aria-label="Cómo agregarla">
        {ways.map(item => <button key={item.id} type="button" className={styles.mode} aria-pressed={way === item.id} onClick={() => setWay(item.id)}>
          <item.icon size={16} aria-hidden="true" />{item.label}
        </button>)}
      </div>

      {way === 'device' && <form className={styles.form} onSubmit={addDevice}>
        <p className={styles.note}>Usa la cámara de este celular o la webcam de este PC. Sin IP, sin contraseña y sin instalar nada: te pedirá permiso para usar la cámara y ya.</p>
        <div className={styles.fields}>
          <TextField label="Nombre" value={deviceName} onChange={event => setDeviceName(event.target.value)} required maxLength={80}
            placeholder="Corral del ternero" autoComplete="off" />
        </div>
        <Button type="submit" icon={Smartphone} loading={saving} disabled={!serviceBase || Boolean(broadcastingId)} className={styles.action}>Transmitir</Button>
        <OpenOnPhone />
      </form>}

      {way === 'scan' && reachesLocalCameras && <div className={styles.found}>
        <p className={styles.note}>Busca cámaras y celulares encendidos en el wifi del PC de la finca. Tarda unos segundos.</p>
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

      {way === 'qr' && reachesLocalCameras && <QrPanel serviceBase={serviceBase} onWaiting={setWaitingForPhone} />}
    </details>
  </div>
}
