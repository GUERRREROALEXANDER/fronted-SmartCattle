import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send, X } from 'lucide-react'
import { useReducedMotion, motion } from 'motion/react'
import { useLocation } from 'react-router'
import { MODEL_PAGE_PATH } from '../../app/navigation'
import { useAssistant } from './assistantContext'
import { ASSISTANT_NAME } from './assistantEngine'
import { Lucero } from './Lucero'
import styles from './AssistantWidget.module.css'

/** The conversation one tap away on every page, except the one that already shows it in full. */
export function AssistantWidget() {
  const { messages, busy, status, offered, ask } = useAssistant()
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
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
        <small>{status}</small></span>
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
