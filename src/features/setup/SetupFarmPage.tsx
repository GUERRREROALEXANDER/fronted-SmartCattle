import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, Fence, LandPlot, LogOut, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { describeApiError } from '../../api/errors'
import { useAuth } from '../../app/auth/useAuth'
import { Button, TextField } from '../../components/ui'
import { can } from '../../lib/permissions'
import { useResource } from '../../lib/useResource'
import { duration, ease } from '../../motion'
import { listAllCameras, setUpFarm, type FarmSetupLot } from '../../services'
import { AuthLayout } from '../auth/AuthLayout'
import { CameraConnect } from '../cameras/CameraConnect'
import styles from './SetupFarmPage.module.css'

type Step = 'kind' | 'details' | 'cameras'
type Kind = 'farm' | 'lot'

const copy: Record<Step, { title: string; description: string }> = {
  kind: { title: '¿Tienes una finca?', description: 'Cuéntanos qué vas a vigilar. Lo usamos para nombrar tu panel; no hay datos de ejemplo.' },
  details: { title: 'Ponle nombre', description: 'Así aparecerá en el panel, en el potrero 3D y en las alertas.' },
  cameras: { title: 'Conecta tus cámaras', description: 'Escribe la IP de la cámara o búscala en tu red. La IA empieza a contar el ganado en cuanto ve la imagen.' },
}

/**
 * First run after signing up: is this a whole farm (with lots) or a single lot? Saves it to the backend,
 * then offers to connect the cameras by IP so the YOLO service starts analysing them.
 */
export function SetupFarmPage() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [step, setStep] = useState<Step>('kind')
  const [kind, setKind] = useState<Kind>('farm')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [lots, setLots] = useState<FarmSetupLot[]>([{ name: '', cameraId: null }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const cameras = useResource(signal => listAllCameras({ signal }), { refreshMs: 10_000 })
  const cameraList = cameras.data ?? []
  const isOwner = session ? can(session.user.role, 'farm:edit') : false

  const choose = (value: Kind) => {
    setKind(value)
    setError('')
    setStep('details')
  }
  const updateLot = (index: number, patch: Partial<FarmSetupLot>) =>
    setLots(current => current.map((lot, i) => i === index ? { ...lot, ...patch } : lot))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setError(kind === 'farm' ? 'Escribe el nombre de la finca.' : 'Escribe el nombre del lote.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await setUpFarm({ kind, name, location, lots })
      setStep('cameras')
    } catch (failure) {
      const { title, description } = describeApiError(failure)
      setError(`${title}. ${description}`)
    } finally {
      setSaving(false)
    }
  }

  const swap = {
    initial: { opacity: 0, transform: reduce ? 'none' : 'translateX(12px)' },
    animate: { opacity: 1, transform: 'translateX(0px)' },
    exit: { opacity: 0, transform: reduce ? 'none' : 'translateX(-12px)' },
    transition: { duration: reduce ? duration.micro : duration.state, ease: ease.out },
  }

  if (!isOwner) return <AuthLayout mode="setup-worker" title="Tu finca aún no está registrada"
    description="Solo el dueño puede registrar la finca. Pídele que entre con su cuenta y la cree; luego verás aquí el panel."
    footer={<button type="button" className={styles.link} onClick={() => void logout()}><LogOut size={14} aria-hidden="true" />Cerrar sesión</button>}>
    <p className={styles.note}>Cuando la finca exista, vuelve a entrar y se abrirá el panel solo.</p>
  </AuthLayout>

  return <AuthLayout mode={`setup-${step}`} title={copy[step].title} description={copy[step].description} wide={step === 'cameras'}
    footer={<span className={styles.steps}>Paso {step === 'kind' ? 1 : step === 'details' ? 2 : 3} de 3</span>}>
    <AnimatePresence mode="wait" initial={false}>
      {step === 'kind' && <motion.div key="kind" className={styles.choices} {...swap}>
        <button type="button" className={styles.choice} onClick={() => choose('farm')}>
          <LandPlot size={26} strokeWidth={1.75} aria-hidden="true" />
          <span><strong>Sí, tengo una finca</strong><span>Con uno o varios lotes, cada uno con su cámara.</span></span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className={styles.choice} onClick={() => choose('lot')}>
          <Fence size={26} strokeWidth={1.75} aria-hidden="true" />
          <span><strong>No, solo un lote</strong><span>Un potrero o corral, por ejemplo «Lote de Jesús».</span></span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </motion.div>}

      {step === 'details' && <motion.form key="details" className={styles.form} onSubmit={save} noValidate {...swap}>
        <TextField label={kind === 'farm' ? 'Nombre de la finca' : 'Nombre del lote'} value={name} required autoFocus
          onChange={event => setName(event.target.value)} placeholder={kind === 'farm' ? 'Ej.: Finca La Esperanza' : 'Ej.: Lote de Jesús'}
          autoComplete="off" maxLength={120} />
        <TextField label="Ubicación (opcional)" value={location} onChange={event => setLocation(event.target.value)}
          placeholder="Vereda, municipio" autoComplete="off" maxLength={200} />

        {kind === 'farm' && <fieldset className={styles.lots}>
          <legend>Lotes de la finca</legend>
          {lots.map((lot, index) => <div key={index} className={styles.lotRow}>
            <TextField label={`Lote ${index + 1}`} value={lot.name} placeholder="Ej.: Potrero norte" autoComplete="off" maxLength={120}
              onChange={event => updateLot(index, { name: event.target.value })} />
            <label className={styles.select}>
              <span>Cámara</span>
              <select value={lot.cameraId ?? ''} onChange={event => updateLot(index, { cameraId: event.target.value || null })}>
                <option value="">Sin cámara</option>
                {cameraList.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
              </select>
            </label>
            {lots.length > 1 && <button type="button" className={styles.remove} aria-label={`Quitar lote ${index + 1}`}
              onClick={() => setLots(current => current.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true" /></button>}
          </div>)}
          <button type="button" className={styles.link} onClick={() => setLots(current => [...current, { name: '', cameraId: null }])}>
            <Plus size={14} aria-hidden="true" />Agregar otro lote
          </button>
        </fieldset>}

        {kind === 'lot' && <label className={styles.select}>
          <span>Cámara que vigila el lote</span>
          <select value={lots[0]?.cameraId ?? ''} onChange={event => updateLot(0, { cameraId: event.target.value || null })}>
            <option value="">La conecto después</option>
            {cameraList.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
          </select>
        </label>}

        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <Button type="button" variant="ghost" icon={ArrowLeft} onClick={() => setStep('kind')}>Atrás</Button>
          <Button type="submit" loading={saving}>Guardar y seguir</Button>
        </div>
      </motion.form>}

      {step === 'cameras' && <motion.div key="cameras" className={styles.form} {...swap}>
        <CameraConnect cameras={cameraList} onChanged={cameras.reload} />
        <div className={styles.actions}>
          <Button type="button" onClick={() => navigate('/', { replace: true })}>Ir al panel</Button>
        </div>
      </motion.div>}
    </AnimatePresence>
  </AuthLayout>
}
