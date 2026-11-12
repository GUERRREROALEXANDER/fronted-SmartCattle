import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send, X } from 'lucide-react'
import { useLocation } from 'react-router'
import { MODEL_PAGE_PATH } from '../../app/navigation'
import { useAssistant } from './assistantContext'
import { ASSISTANT_NAME, suggestions } from './assistantEngine'
import { LuciaRobot } from './LuciaRobot'
import styles from './AssistantWidget.module.css'

/** The conversation one tap away on every page, except the one that already shows it in full. */
export function AssistantWidget() {
  const { messages, busy, mood, status, ask } = useAssistant()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight })
  }, [messages, open])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    void ask(draft)
    setDraft('')
  }

  if (pathname === MODEL_PAGE_PATH) return null

  if (!open) {
    return <button type="button" className={styles.launcher} onClick={() => setOpen(true)} aria-label={`Abrir el asistente ${ASSISTANT_NAME}`}>
      <span className={styles.hello} aria-hidden="true">Hola, soy {ASSISTANT_NAME}</span>
      <LuciaRobot mood={mood} className={styles.launcherRobot} />
    </button>
  }

  return <section className={styles.panel} role="dialog" aria-label={`Asistente ${ASSISTANT_NAME}`}>
    <header className={styles.head}>
      <LuciaRobot mood={mood} className={styles.headRobot} />
      <span className={styles.title}><strong>{ASSISTANT_NAME}</strong><small>{status}</small></span>
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
