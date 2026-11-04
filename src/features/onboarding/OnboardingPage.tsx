import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Cctv, Smartphone, Clock } from 'lucide-react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useAuth } from '../../app/auth/useAuth'
import { useDocumentTitle } from '../../app/useDocumentTitle'
import { PrintedCow } from '../../components/herd/PrintedCow'
import { ease } from '../../motion'
import { Lucero } from '../assistant/Lucero'
import { ASSISTANT_NAME, firstName } from '../assistant/assistantEngine'
import { GOALS, saveOnboarding, START_PAGES, type Goal, type StartPage } from './onboardingModel'
import styles from './OnboardingPage.module.css'

type Step = 'hello' | 'goals' | 'start' | 'camera'
const INK: Record<Step, string> = { hello: 'verde', goals: 'fucsia', start: 'cobalto', camera: 'maiz' }

export function OnboardingPage() {
  useDocumentTitle()
  const { session, can } = useAuth()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [step, setStep] = useState<Step>('hello')
  const [goals, setGoals] = useState<Goal[]>([])
  const [start, setStart] = useState<StartPage>('/')
  const name = firstName(session?.user.name)
  const configures = can('cameras:configure')
  const steps: Step[] = configures ? ['hello', 'goals', 'start', 'camera'] : ['hello', 'goals', 'start']
  const index = steps.indexOf(step)

  const finish = (to: string) => {
    if (session) saveOnboarding(session.user.id, { goals, start })
    navigate(to, { replace: true })
  }
  const next = () => {
    const following = steps[index + 1]
    if (following) setStep(following)
    else finish(start)
  }
  const toggle = (goal: Goal) => setGoals(current => current.includes(goal) ? current.filter(item => item !== goal) : [...current, goal])

  return <main className={styles.page} data-ink={INK[step]}>
    <div className={styles.head}>
      <button type="button" className={styles.skip} onClick={() => finish('/')}>Saltar por ahora</button>
    </div>

    <AnimatePresence mode="wait" initial={false}>
      <motion.section key={step} className={styles.card} aria-labelledby="onboarding-question"
        initial={{ opacity: 0, transform: reduce ? 'none' : 'scale(1.03)' }}
        animate={{ opacity: 1, transform: 'scale(1)' }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}>
        <div className={styles.voice}>
          <Lucero size={72} mood="speaking" />
          <p className={styles.who}>{ASSISTANT_NAME}, tu asistente</p>
        </div>

        {step === 'hello' && <>
          <h1 id="onboarding-question" className={styles.question}>¡Hola{name ? `, ${name}` : ''}!</h1>
          <p className={styles.lead}>
            Te ayudo a cuidar tu finca con las cámaras que ya tienes. Son tres preguntas rápidas para mostrarte primero lo que te importa.
          </p>
          <PrintedCow posture="walking" className={styles.cow} />
        </>}

        {step === 'goals' && <>
          <h1 id="onboarding-question" className={styles.question}>¿Qué quieres vigilar?</h1>
          <p className={styles.lead}>Elige todo lo que quieras. Lo pondré primero en tu panel y en mis sugerencias.</p>
          <div className={styles.options} role="group" aria-label="Lo que quieres vigilar">
            {GOALS.map(goal => <button key={goal.id} type="button" className={styles.option} aria-pressed={goals.includes(goal.id)} onClick={() => toggle(goal.id)}>
              <span className={styles.optionTitle}>{goal.title}</span>
              <span>{goal.detail}</span>
              {goals.includes(goal.id) && <Check className={styles.tick} size={24} strokeWidth={3} aria-hidden="true" />}
            </button>)}
          </div>
        </>}

        {step === 'start' && <>
          <h1 id="onboarding-question" className={styles.question}>¿Qué quieres ver al entrar?</h1>
          <div className={styles.options} role="radiogroup" aria-label="Página de inicio">
            {START_PAGES.map(page => <button key={page.id} type="button" role="radio" aria-checked={start === page.id} className={styles.option} onClick={() => setStart(page.id)}>
              <span className={styles.optionTitle}>{page.title}</span>
              <span>{page.detail}</span>
              {start === page.id && <Check className={styles.tick} size={24} strokeWidth={3} aria-hidden="true" />}
            </button>)}
          </div>
        </>}

        {step === 'camera' && <>
          <h1 id="onboarding-question" className={styles.question}>¿Conectamos tu primera cámara?</h1>
          <p className={styles.lead}>Solo le pones un nombre y pegas su enlace. También sirve un celular.</p>
          <div className={styles.options}>
            <button type="button" className={styles.option} onClick={() => finish('/cameras')}>
              <Cctv size={28} aria-hidden="true" /><span className={styles.optionTitle}>Tengo una cámara</span><span>Con su enlace o su IP.</span>
            </button>
            <button type="button" className={styles.option} onClick={() => finish('/cameras?con=celular')}>
              <Smartphone size={28} aria-hidden="true" /><span className={styles.optionTitle}>Usaré un celular</span><span>Sin enlace ni contraseña.</span>
            </button>
            <button type="button" className={styles.option} onClick={() => finish(start)}>
              <Clock size={28} aria-hidden="true" /><span className={styles.optionTitle}>Más tarde</span><span>Te lo recordaré en Cámaras.</span>
            </button>
          </div>
        </>}

        <div className={styles.actions}>
          {index > 0 && <button type="button" className={styles.back} onClick={() => setStep(steps[index - 1])}>
            <ArrowLeft size={20} aria-hidden="true" />Atrás
          </button>}
          {step !== 'camera' && <button type="button" className={styles.next} onClick={next}>
            {step === 'hello' ? 'Empecemos' : 'Seguir'}<ArrowRight size={20} aria-hidden="true" />
          </button>}
          <p className={styles.progress}>Paso {index + 1} de {steps.length}</p>
        </div>
      </motion.section>
    </AnimatePresence>
  </main>
}
