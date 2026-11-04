import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowRight, Check, Link2, Tag } from 'lucide-react'
import { Link } from 'react-router'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import pasture from '../../assets/login/pasture-dusk-2400.jpg'
import { useDocumentTitle } from '../../app/useDocumentTitle'
import { PrintedCow } from '../../components/herd/PrintedCow'
import { BrandMark } from '../../components/ui'
import { Lucero } from '../assistant/Lucero'
import { isWebGLAvailable } from '../pasture3d/scene/webgl'
import styles from './LandingPage.module.css'

const LandingScene = lazy(() => import('./LandingScene').then(module => ({ default: module.LandingScene })))

const FLY_END = 0.16
const MAX_SCALE = 60

interface Layout { box: string; fit: string; lines: { text: string; x: number; y: number; size: number }[]; through: number; char: number }
const WIDE: Layout = {
  box: '0 0 1600 900',
  fit: 'xMidYMid slice',
  lines: [{ text: 'TU GANADO', x: 800, y: 420, size: 400 }, { text: 'A LA VISTA', x: 800, y: 820, size: 400 }],
  through: 1, char: 7, // the I of VISTA, a solid stroke to fly through
}
const TALL: Layout = {
  // A phone's proportions, fitted whole: the four lines sit between the top bar and the copy under them.
  box: '0 0 780 1688',
  fit: 'xMidYMid meet',
  lines: [
    { text: 'TU', x: 390, y: 385, size: 270 }, { text: 'GANADO', x: 390, y: 665, size: 270 },
    { text: 'A LA', x: 390, y: 945, size: 270 }, { text: 'VISTA', x: 390, y: 1225, size: 270 },
  ],
  through: 3, char: 1,
}

/** The ink field with the headline cut out of it. Scrolling flies through one letter into the pasture. */
function LetterMask({ progress }: { progress: MotionValue<number> }) {
  const [layout, setLayout] = useState(() => globalThis.innerWidth < globalThis.innerHeight ? TALL : WIDE)
  const [origin, setOrigin] = useState('50% 50%')
  const lines = useRef<(SVGTextElement | null)[]>([])
  useEffect(() => {
    const onResize = () => setLayout(globalThis.innerWidth < globalThis.innerHeight ? TALL : WIDE)
    globalThis.addEventListener('resize', onResize)
    return () => globalThis.removeEventListener('resize', onResize)
  }, [])
  // Measured once the type is real: the zoom's center has to fall inside a letter's stroke.
  useEffect(() => {
    let live = true
    void document.fonts.load('400 100px Anton').then(() => {
      const box = lines.current[layout.through]?.getExtentOfChar(layout.char)
      if (live && box) setOrigin(`${box.x + box.width / 2}px ${box.y + box.height / 2}px`)
    })
    return () => { live = false }
  }, [layout])
  const scale = useTransform(progress, [0, FLY_END], [0, 1], { clamp: true })
  const transform = useTransform(scale, value => `scale(${MAX_SCALE ** (value * value)})`)
  const opacity = useTransform(progress, [FLY_END * 0.86, FLY_END], [1, 0])
  const display = useTransform(progress, value => value >= FLY_END ? 'none' : 'block')
  return <motion.svg className={styles.mask} viewBox={layout.box} preserveAspectRatio={layout.fit} aria-hidden="true" style={{ opacity, display }}>
    <defs>
      <mask id="letters" maskUnits="userSpaceOnUse" x="-100%" y="-100%" width="300%" height="300%">
        <rect x="-100%" y="-100%" width="300%" height="300%" fill="white" />
        <motion.g style={{ transform, transformOrigin: origin }}>
          {layout.lines.map((line, index) => <text key={line.text} ref={node => { lines.current[index] = node }} x={line.x} y={line.y} fontSize={line.size}
            fill="black" textAnchor="middle" fontFamily="Anton">{line.text}</text>)}
        </motion.g>
      </mask>
    </defs>
    <rect x="-100%" y="-100%" width="300%" height="300%" fill="var(--ink-tinta)" mask="url(#letters)" />
  </motion.svg>
}

function Beat({ progress, from, to, title, children, right = false }: { progress: MotionValue<number>; from: number; to: number; title: string; children: ReactNode; right?: boolean }) {
  const fade = 0.025
  const opacity = useTransform(progress, [from, from + fade, to - fade, to], [0, 1, 1, 0])
  const transform = useTransform(progress, [from, from + fade], ['scale(1.04)', 'scale(1)'])
  const visibility = useTransform(progress, value => value > from && value < to ? 'visible' : 'hidden')
  return <motion.article className={styles.beat} data-right={right || undefined} style={{ opacity, transform, visibility }}>
    <h2 className={styles.beatTitle}>{title}</h2>
    <p className={styles.beatText}>{children}</p>
  </motion.article>
}

function Stage() {
  const reduce = useReducedMotion() === true
  const [webgl] = useState(isWebGLAvailable)
  const track = useRef<HTMLDivElement>(null)
  const { scrollYProgress: progress } = useScroll({ target: track, offset: ['start start', 'end end'] })
  const [breached, setBreached] = useState(false)
  const [hinted, setHinted] = useState(false)
  useMotionValueEvent(progress, 'change', value => setHinted(value > 0.01))
  const heroOpacity = useTransform(progress, [0, 0.05], [1, 0])
  const heroVisibility = useTransform(progress, value => value < 0.05 ? 'visible' : 'hidden')

  return <section ref={track} className={styles.track} data-reduce={reduce || undefined} aria-label="Cómo funciona">
    <div className={styles.stage} data-breached={breached || undefined}>
      <img className={styles.photo} src={pasture} alt="" />
      {webgl && <div className={styles.canvas}>
        <Suspense fallback={null}><LandingScene progress={progress} reduceMotion={reduce} onBreach={setBreached} /></Suspense>
      </div>}

      {reduce
        ? <div className={styles.staticHero}><p className={styles.staticTitle} aria-hidden="true">Tu ganado a la vista</p></div>
        : <LetterMask progress={progress} />}

      <motion.div className={styles.heroCopy} style={reduce ? undefined : { opacity: heroOpacity, visibility: heroVisibility }}>
        <p className={styles.heroLead}>Cuida tu finca con las cámaras que ya tienes. Sin collares, sin chapetas electrónicas, sin GPS.</p>
        <div className={styles.heroActions}>
          <Link className={styles.cta} to="/register">Crear cuenta<ArrowRight size={22} aria-hidden="true" /></Link>
          {!hinted && <span className={styles.hint}><ArrowDown size={18} aria-hidden="true" />Baja despacio</span>}
        </div>
      </motion.div>

      {!reduce && <>
        <Beat progress={progress} from={0.17} to={0.38} title="La cámara ve. La IA cuenta.">
          Conecta tu cámara y SmartCattle detecta cada animal en la imagen, en vivo.
        </Beat>
        <Beat progress={progress} from={0.4} to={0.6} title="Si se echa, la ves echada." right>
          El potrero 3D muestra lo que la IA reporta de cada vaca: de pie, caminando o echada. No una animación de relleno.
        </Beat>
        <Beat progress={progress} from={0.64} to={0.9} title="Se salió: te enteras.">
          La cerca se marca en rojo, salta la alerta y vas directo a la cámara para verificar.
        </Beat>
      </>}
      {webgl && <p className={styles.simulated}>Simulación ilustrativa</p>}
    </div>
  </section>
}

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return <motion.div className={className}
    initial={reduce ? false : { opacity: 0, transform: 'scale(1.03)' }}
    whileInView={{ opacity: 1, transform: 'scale(1)' }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}>{children}</motion.div>
}

export function LandingPage() {
  useDocumentTitle()
  const reduce = useReducedMotion()
  return <div className={styles.page}>
    <header className={styles.bar}>
      <BrandMark size="md" tone="on-dark" />
      <nav className={styles.barLinks} aria-label="Cuenta">
        <Link className={styles.login} to="/login">Ingresar</Link>
        <Link className={styles.register} to="/register">Crear cuenta</Link>
      </nav>
    </header>

    <main>
      <h1 className="visually-hidden">Tu ganado a la vista: monitoreo de fincas con cámaras e inteligencia artificial</h1>
      <Stage />

      {reduce && <section className={styles.block} data-ink="verde" aria-label="Cómo funciona">
        <ul className={styles.plain}>
          <li><strong>La cámara ve. La IA cuenta.</strong> Conecta tu cámara y SmartCattle detecta cada animal, en vivo.</li>
          <li><strong>Si se echa, la ves echada.</strong> El potrero 3D muestra lo que la IA reporta de cada vaca.</li>
          <li><strong>Se salió: te enteras.</strong> La cerca se marca en rojo y vas directo a la cámara para verificar.</li>
        </ul>
      </section>}

      <section className={styles.block} data-ink="maiz" aria-labelledby="camera-title">
        <Reveal className={styles.split}>
          <h2 id="camera-title" className={styles.blockTitle}>Un nombre. Un enlace. Listo.</h2>
          <div className={styles.miniForm} aria-hidden="true">
            <p className={styles.miniField}><Tag size={20} /><span>Potrero norte</span></p>
            <p className={styles.miniField}><Link2 size={20} /><span>rtsp://192.168.1.20</span></p>
            <p className={styles.miniSubmit}><Check size={20} strokeWidth={3} />Conectada</p>
          </div>
        </Reveal>
        <p className={styles.blockText}>También sirve la cámara de un celular, sin dirección ni contraseña. Si tu cámara IP pide clave, te la preguntamos solo en ese momento.</p>
      </section>

      <section className={styles.block} data-ink="fucsia" aria-labelledby="report-title">
        <Reveal className={styles.split}>
          <h2 id="report-title" className={styles.blockTitle}>Tu día, ya resumido.</h2>
          <figure className={styles.sample}>
            <figcaption className={styles.sampleTag}>Ejemplo con datos ficticios</figcaption>
            <ul className={styles.sampleRows}>
              <li><PrintedCow posture="lying" /><span>Echado</span><strong>52 %</strong></li>
              <li><PrintedCow posture="standing" /><span>De pie</span><strong>31 %</strong></li>
              <li><PrintedCow posture="walking" /><span>Caminando</span><strong>17 %</strong></li>
            </ul>
          </figure>
        </Reveal>
        <p className={styles.blockText}>Tiempo observado, máximo de animales a la vista, qué hizo el ganado y las alertas del día. Lo arma el sistema solo. No es un diagnóstico veterinario.</p>
      </section>

      <section className={styles.block} data-ink="cobalto" aria-labelledby="lucero-title">
        <Reveal className={styles.split}>
          <div className={styles.luceroHead}>
            <Lucero size={120} mood="speaking" />
            <h2 id="lucero-title" className={styles.blockTitle}>Pregúntale a Lucero.</h2>
          </div>
          <div className={styles.chat}>
            <p className={styles.chatTag}>Ejemplo de conversación</p>
            <p className={styles.chatYou}>¿Qué pasó anoche?</p>
            <p className={styles.chatHer}>Las cámaras observaron 9 horas, con un máximo de 12 animales a la vista. Hubo 1 alerta y ya está atendida.</p>
          </div>
        </Reveal>
        <p className={styles.blockText}>Tu asistente responde con los datos de tu finca: cómo está el ganado, qué pasó y cómo conectar una cámara.</p>
      </section>

      <section className={styles.close} data-ink="verde" aria-labelledby="close-title">
        <h2 id="close-title" className={styles.closeTitle}>Empieza con una cámara.</h2>
        <Link className={styles.cta} to="/register">Crear cuenta<ArrowRight size={22} aria-hidden="true" /></Link>
        <div className={styles.parade} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map(index => <span key={index} className={styles.paradeCow} style={{ animationDelay: `${index * -7}s` }}><PrintedCow posture="walking" /></span>)}
        </div>
      </section>
    </main>
  </div>
}
