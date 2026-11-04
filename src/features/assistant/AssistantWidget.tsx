import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send, X } from 'lucide-react'
import { useReducedMotion, motion } from 'motion/react'
import { useAuth } from '../../app/auth/useAuth'
import { herdCount } from '../../live/liveState'
import { useLive } from '../../live/useLive'
import { askAssistantModel, getAlertReport, getDailyReport, type AssistantTurn } from '../../services'
import { onboardingOf, suggestionsFor } from '../onboarding/onboardingModel'
import { answer, ASSISTANT_NAME, greeting, suggestions, type AssistantData } from './assistantEngine'
import { Lucero } from './Lucero'
import styles from './AssistantWidget.module.css'

interface Message { id: number; from: 'assistant' | 'user'; text: string }

const reportData: Pick<AssistantData, 'daily' | 'alerts'> = {
  daily: async day => (await getDailyReport({ day })).data,
  alerts: async (start, end) => (await getAlertReport({ start, end })).data,
}
const HISTORY_TURNS = 8

/** Lives in the shell, so it is one tap away on every page and keeps the conversation between them. */
export function AssistantWidget() {
  const { session } = useAuth()
  const live = useLive()
  const reduce = useReducedMotion()
  const name = session?.user.name
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [usingModel, setUsingModel] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, from: 'assistant', text: greeting(name) }])
  const nextId = useRef(1)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  // Read when asked, not when the question was typed: live data changes while the answer loads.
  const facts = useRef(live)
  const offered = session ? suggestionsFor(onboardingOf(session.user.id)?.goals ?? [], suggestions) : suggestions

  useEffect(() => {
    facts.current = live
  }, [live])
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight })
  }, [messages, open])

  function push(from: Message['from'], text: string) {
    const id = nextId.current++
    setMessages(current => [...current, { id, from, text }])
  }

  async function ask(question: string) {
    const text = question.trim()
    if (!text || busy) return
    const history: AssistantTurn[] = messages.slice(1).slice(-HISTORY_TURNS).map(message => ({ role: message.from, text: message.text }))
    push('user', text)
    setDraft('')
    setBusy(true)
    try {
      const reply = await askAssistantModel(text, history)
      setUsingModel(reply !== null)
      push('assistant', reply ?? await answer(text, {
        ...reportData,
        live: () => ({
          cattleNow: herdCount(facts.current)?.total ?? null,
          cameras: facts.current.cameras.map(camera => ({ name: camera.name, online: camera.status === 'online' })),
          openAlerts: facts.current.alerts.filter(alert => alert.status === 'open').length,
        }),
      }, new Date(), name))
    } catch {
      push('assistant', 'No pude consultar los datos de la finca en este momento. Revisa la conexión e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void ask(draft)
  }

  if (!open) {
    return <button type="button" className={styles.launcher} onClick={() => setOpen(true)} aria-label={`Abrir el asistente ${ASSISTANT_NAME}`}>
      <Lucero size={56} />
      <span className={styles.launcherName}>{ASSISTANT_NAME}</span>
    </button>
  }

  return <motion.section className={styles.panel} role="dialog" aria-label={`Asistente ${ASSISTANT_NAME}`}
    initial={reduce ? false : { opacity: 0, transform: 'translateY(12px) scale(0.97)' }}
    animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
    transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
    <header className={styles.head}>
      <Lucero size={52} mood={busy ? 'thinking' : 'idle'} />
      <span className={styles.title}><strong>{ASSISTANT_NAME}</strong>
        <small>{usingModel === false ? 'Modo básico: reglas con los datos de tu finca' : 'Responde con los datos de tu finca'}</small></span>
      <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Cerrar el asistente">
        <X size={20} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </header>
    <div className={styles.log} ref={log} role="log" aria-live="polite">
      {messages.map(message => <p key={message.id} className={message.from === 'user' ? styles.user : styles.assistant}>{message.text}</p>)}
      {busy && <p className={styles.assistant}>Consultando…</p>}
    </div>
    {messages.length === 1 && <div className={styles.suggestions}>
      {offered.map(text => <button key={text} type="button" className={styles.suggestion} onClick={() => void ask(text)}>{text}</button>)}
    </div>}
    <form className={styles.form} onSubmit={submit}>
      <input ref={input} className={styles.input} value={draft} onChange={event => setDraft(event.target.value)}
        placeholder="Escribe tu pregunta" aria-label="Tu pregunta" maxLength={300} />
      <button type="submit" className={styles.send} disabled={busy || draft.trim() === ''} aria-label="Enviar">
        <Send size={20} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </form>
  </motion.section>
}
