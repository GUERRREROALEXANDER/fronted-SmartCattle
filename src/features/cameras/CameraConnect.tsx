import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Cctv, Plug, Radar, Smartphone, Wifi } from 'lucide-react'
import { aiServiceUrl } from '../../api/config'
import { describeApiError } from '../../api/errors'
import { Button, GlassCard, StatusPill, TextField } from '../../components/ui'
import {
  connectCamera, scanCameras, waitForCamera, type CameraScan, type CameraSource, type FoundCamera,
} from '../../services'
import type { Camera, CameraStatus } from '../../types/domain'
import styles from './CameraConnect.module.css'

const statusPill: Record<CameraStatus, { tone: 'safe' | 'warning' | 'critical' | 'inactive' | 'info'; label: string }> = {
  online: { tone: 'safe', label: 'En línea' },
  connecting: { tone: 'info', label: 'Conectando' },
  offline: { tone: 'inactive', label: 'Sin conexión' },
  error: { tone: 'critical', label: 'Con error' },
}
const kindLabel = { rtsp: 'Cámara IP (RTSP)', 'ip-webcam': 'Celular · IP Webcam', droidcam: 'Celular · DroidCam' } as const
const ease = [0.23, 1, 0.32, 1] as const

/** A still from the AI service, refreshed every second; lighter than keeping one MJPEG stream per card open. */
function LivePreview({ baseUrl, name }: { baseUrl: string; name: string }) {
  const [tick, setTick] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => setTick(value => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return <div className={styles.preview}>
    {failed
      ? <span className={styles.previewEmpty}><Cctv size={22} strokeWidth={1.75} aria-hidden="true" />Sin imagen todavía</span>
      : <img src={`${baseUrl}/snapshot.jpg?t=${tick}`} alt={`Imagen en vivo de ${name} con las detecciones de la IA`}
        onError={() => setFailed(true)} onLoad={() => setFailed(false)} />}
  </div>
}

type Mode = 'ip' | 'url'

/**
 * The cameras the AI service reports, with their live picture, plus the way to add one: search the local
 * network, or type the camera's IP (and password) or a phone app's address / webcam number.
 */
export function CameraConnect({ cameras, onChanged }: { cameras: readonly Camera[]; onChanged?: () => void }) {
  const reduce = useReducedMotion()
  const services = cameras.filter(camera => camera.streamUrl)
  const scanBase = services[0]?.streamUrl ?? aiServiceUrl
  const [scan, setScan] = useState<CameraScan | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [mode, setMode] = useState<Mode>('ip')
  const [host, setHost] = useState('')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [url, setUrl] = useState('')
  const [target, setTarget] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [result, setResult] = useState<{ tone: 'safe' | 'critical'; text: string } | null>(null)
  const targetCamera = services.find(camera => camera.id === target) ?? services[0]

  const runScan = async () => {
    setScanning(true)
    setScanError('')
    try {
      setScan(await scanCameras(scanBase ?? ''))
    } catch (error) {
      setScanError(describeApiError(error).description)
    } finally {
      setScanning(false)
    }
  }

  const pickFound = (found: FoundCamera) => {
    if (found.kinds.includes('rtsp')) {
      setMode('ip')
      setHost(found.host)
    } else {
      setMode('url')
      setUrl(found.kinds.includes('droidcam') ? `${found.host}:4747/video` : `${found.host}:8080`)
    }
    setResult(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!targetCamera?.streamUrl) return
    const source: CameraSource = mode === 'ip' ? { kind: 'ip', host, username, password } : { kind: 'url', url }
    setConnecting(true)
    setResult(null)
    try {
      await connectCamera(targetCamera.streamUrl, source)
      // The service answers at once and opens the camera in the background: wait until it says how it went.
      const state = await waitForCamera(targetCamera.streamUrl)
      setResult(state.status === 'online'
        ? { tone: 'safe', text: `${targetCamera.name} ya transmite y la IA está analizando la imagen.` }
        : { tone: 'critical', text: state.error
          ? `No se pudo abrir la cámara: revisa la IP, el usuario y la contraseña. (${state.error})`
          : 'La cámara no respondió a tiempo. Comprueba que esté encendida y en la misma red.' })
      setPassword('')
      onChanged?.()
    } catch (error) {
      const { title, description } = describeApiError(error)
      setResult({ tone: 'critical', text: `${title}. ${description}` })
    } finally {
      setConnecting(false)
    }
  }

  return <div className={styles.wrap}>
    <section aria-labelledby="camera-list-title">
      <h2 id="camera-list-title" className={styles.title}>Cámaras conectadas a la IA</h2>
      {cameras.length === 0
        ? <p className={styles.note}>
          Todavía ninguna cámara reporta al servidor. Enciende el servicio de IA en el PC de la finca y conecta una cámara abajo.
        </p>
        : <ul className={styles.grid}>
          {cameras.map(camera => <GlassCard as="li" key={camera.id} padding="none" className={styles.card}>
            {camera.streamUrl
              ? <LivePreview baseUrl={camera.streamUrl} name={camera.name} />
              : <div className={styles.preview}><span className={styles.previewEmpty}>Sin servicio de video</span></div>}
            <div className={styles.cardBody}>
              <strong>{camera.name}</strong>
              <StatusPill {...statusPill[camera.status]} />
            </div>
            {camera.lastError && camera.status !== 'online' && <p className={styles.error}>{camera.lastError}</p>}
          </GlassCard>)}
        </ul>}
    </section>

    <GlassCard as="section" padding="lg" aria-labelledby="camera-connect-title" className={styles.connect}>
      <div className={styles.connectHead}>
        <div>
          <h2 id="camera-connect-title" className={styles.title}>Conectar una cámara</h2>
          <p className={styles.note}>Busca en tu red o escribe la IP de la cámara. La IA empieza a analizarla en cuanto abre la imagen.</p>
        </div>
        <Button variant="secondary" icon={Radar} loading={scanning} onClick={runScan} disabled={!scanBase}>
          Buscar cámaras en la red
        </Button>
      </div>

      {!scanBase && <p className={styles.error}>
        El servicio de IA no está corriendo en este PC, así que no se puede buscar ni conectar cámaras.
      </p>}
      {scanError && <p className={styles.error} role="alert">{scanError}</p>}
      <AnimatePresence initial={false}>
        {scan && <motion.div key="scan" className={styles.found}
          initial={{ opacity: 0, transform: reduce ? 'none' : 'translateY(-6px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.22, ease }}>
          <p className={styles.note}>
            {scan.cameras.length === 0
              ? `No se encontraron cámaras en ${scan.network ?? 'la red'}. Comprueba que estén encendidas y conectadas al mismo wifi.`
              : `${scan.cameras.length === 1 ? 'Se encontró 1 posible cámara' : `Se encontraron ${scan.cameras.length} posibles cámaras`} en ${scan.network}.`}
          </p>
          <ul className={styles.foundList}>
            {scan.cameras.map(found => <li key={found.host}>
              <button type="button" className={styles.foundItem} onClick={() => pickFound(found)}>
                {found.kinds.includes('rtsp') ? <Wifi size={18} aria-hidden="true" /> : <Smartphone size={18} aria-hidden="true" />}
                <span><strong className="tabular">{found.host}</strong><span>{found.kinds.map(kind => kindLabel[kind]).join(' · ')}</span></span>
                <span className={styles.use}>Usar</span>
              </button>
            </li>)}
          </ul>
        </motion.div>}
      </AnimatePresence>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.modes} role="group" aria-label="Tipo de cámara">
          <button type="button" className={styles.mode} aria-pressed={mode === 'ip'} onClick={() => setMode('ip')}>
            <Wifi size={16} aria-hidden="true" />Cámara IP (Imou, Hikvision…)
          </button>
          <button type="button" className={styles.mode} aria-pressed={mode === 'url'} onClick={() => setMode('url')}>
            <Smartphone size={16} aria-hidden="true" />Celular, iVCam o URL
          </button>
        </div>
        {mode === 'ip' ? <div className={styles.fields}>
          <TextField label="Dirección IP" value={host} onChange={event => setHost(event.target.value)} required
            placeholder="192.168.100.30" inputMode="decimal" autoComplete="off" />
          <TextField label="Usuario" value={username} onChange={event => setUsername(event.target.value)} autoComplete="off" />
          <TextField label="Contraseña de la cámara" type="password" value={password} required
            onChange={event => setPassword(event.target.value)} autoComplete="new-password"
            hint="En Imou es el código de seguridad de la etiqueta de la cámara." />
        </div> : <div className={styles.fields}>
          <TextField label="Dirección o número de webcam" value={url} onChange={event => setUrl(event.target.value)} required
            placeholder="192.168.1.20:8080  ·  rtsp://…  ·  1" autoComplete="off"
            hint="iVCam en el PC aparece como webcam: escribe su número (0 o 1). IP Webcam: la dirección que muestra la app." />
        </div>}
        {services.length > 1 && <label className={styles.target}>
          <span>Usar el servicio de</span>
          <select value={targetCamera?.id ?? ''} onChange={event => setTarget(event.target.value)}>
            {services.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
          </select>
        </label>}
        <Button type="submit" icon={Plug} loading={connecting} disabled={!targetCamera}>Conectar y analizar</Button>
        {result && <p className={result.tone === 'safe' ? styles.ok : styles.error} role="status">{result.text}</p>}
      </form>
    </GlassCard>
  </div>
}
