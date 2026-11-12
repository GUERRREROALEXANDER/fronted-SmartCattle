import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAssistant } from './assistantContext'
import { ASSISTANT_NAME, suggestions } from './assistantEngine'
import { LuciaRobot } from './LuciaRobot'
import styles from './ModelPage.module.css'

/** What POST /api/assistant/messages accepts. */
const QUESTION_MAX = 500

/** The whole page for asking: the same conversation as the floating panel, with room to read it. */
export function ModelPage() {
  const { messages, busy, mood, status, ask, clear } = useAssistant()
  const [draft, setDraft] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const asked = messages.length > 1

  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight })
  }, [messages, busy])

  function send() {
    if (busy || draft.trim() === '') return
    void ask(draft)
    setDraft('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    send()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return <div className={styles.page}>
    <PageHeader title="Modelo de IA" description="Pregunta por tu ganado, tus cámaras y tus alertas."
      actions={asked ? <Button variant="secondary" size="sm" icon={Trash2} disabled={busy} onClick={clear}>Limpiar</Button> : undefined} />
    <section className={styles.chat} aria-label={`Conversación con ${ASSISTANT_NAME}`}>
      <header className={styles.head}>
        <LuciaRobot mood={mood} className={styles.robot} />
        <span className={styles.title}><strong>{ASSISTANT_NAME}</strong><small>{status}</small></span>
      </header>
      <div className={styles.log} ref={log} role="log" aria-live="polite">
        {messages.map(message => <p key={message.id} className={message.from === 'user' ? styles.user : styles.assistant}>{message.text}</p>)}
        {busy && <p className={styles.assistant}>Consultando…</p>}
        {!asked && <div className={styles.suggestions}>
          {suggestions.map(text => <button key={text} type="button" className={styles.suggestion} onClick={() => void ask(text)}>{text}</button>)}
        </div>}
      </div>
      <form className={styles.form} onSubmit={submit}>
        <textarea className={styles.input} value={draft} rows={2} maxLength={QUESTION_MAX}
          onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown}
          placeholder="Escribe tu pregunta" aria-label="Tu pregunta" />
        <button type="submit" className={styles.send} disabled={busy || draft.trim() === ''} aria-label="Enviar">
          <Send size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>
    </section>
    <p className={styles.note}>Enter envía y Shift + Enter baja de línea. {ASSISTANT_NAME} no reemplaza al veterinario.</p>
  </div>
}
