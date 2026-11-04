import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { useAuth } from '../../app/auth/useAuth'
import { herdCount } from '../../live/liveState'
import { useLive } from '../../live/useLive'
import { getAlertReport, getDailyReport } from '../../services'
import { answer, ASSISTANT_NAME, greeting, suggestions, type AssistantData } from './assistantEngine'
import styles from './AssistantWidget.module.css'

interface Message { id: number; from: 'assistant' | 'user'; text: string }

const reportData: Pick<AssistantData, 'daily' | 'alerts'> = {
  daily: async day => (await getDailyReport({ day })).data,
  alerts: async (start, end) => (await getAlertReport({ start, end })).data,
}

/** Lives in the shell, so it is one tap away on every page and keeps the conversation between them. */
export function AssistantWidget() {
  const { session } = useAuth()
  const live = useLive()
  const name = session?.user.name
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, from: 'assistant', text: greeting(name) }])
  const nextId = useRef(1)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  // Read when asked, not when the question was typed: live data changes while the answer loads.
  const facts = useRef(live)

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
    push('user', text)
    setDraft('')
    setBusy(true)
    try {
      push('assistant', await answer(text, {
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
      <MessageCircle size={22} strokeWidth={2} aria-hidden="true" />
    </button>
  }

  return <section className={styles.panel} role="dialog" aria-label={`Asistente ${ASSISTANT_NAME}`}>
    <header className={styles.head}>
      <span className={styles.badge} aria-hidden="true"><MessageCircle size={18} strokeWidth={2} /></span>
      <span className={styles.title}><strong>{ASSISTANT_NAME}</strong><small>Responde con los datos de tu finca</small></span>
      <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Cerrar el asistente">
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </header>
    <div className={styles.log} ref={log} role="log" aria-live="polite">
      {messages.map(message => <p key={message.id} className={message.from === 'user' ? styles.user : styles.assistant}>{message.text}</p>)}
      {busy && <p className={styles.assistant}>Consultando…</p>}
    </div>
    {messages.length === 1 && <div className={styles.suggestions}>
      {suggestions.map(text => <button key={text} type="button" className={styles.suggestion} onClick={() => void ask(text)}>{text}</button>)}
    </div>}
    <form className={styles.form} onSubmit={submit}>
      <input ref={input} className={styles.input} value={draft} onChange={event => setDraft(event.target.value)}
        placeholder="Escribe tu pregunta" aria-label="Tu pregunta" maxLength={300} />
      <button type="submit" className={styles.send} disabled={busy || draft.trim() === ''} aria-label="Enviar">
        <Send size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </form>
  </section>
}
