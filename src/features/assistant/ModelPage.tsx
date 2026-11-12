import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAssistant } from './assistantContext'
import { ASSISTANT_NAME } from './assistantEngine'
import { Lucero } from './Lucero'
import styles from './ModelPage.module.css'

/** What POST /api/assistant/messages accepts. */
const QUESTION_MAX = 500

/** The whole page for asking: the same conversation as the floating panel, with room to read it. */
export function ModelPage() {
  const { messages, busy, status, offered, ask, clear } = useAssistant()
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
    <PageHeader title="Modelo de IA" description="Pregunta por tu ganado, tus cámaras y tus alertas." />
    <section className={styles.chat} aria-label={`Conversación con ${ASSISTANT_NAME}`}>
      <header className={styles.head}>
        <Lucero size={52} mood={busy ? 'thinking' : 'idle'} />
        <span className={styles.title}><strong>{ASSISTANT_NAME}</strong><small>{status}</small></span>
        {asked && <button type="button" className={styles.clear} onClick={clear} disabled={busy}>
          <Trash2 size={18} strokeWidth={2.25} aria-hidden="true" />Limpiar
        </button>}
      </header>
      <div className={styles.log} ref={log} role="log" aria-live="polite">
        {messages.map(message => <p key={message.id} className={message.from === 'user' ? styles.user : styles.assistant}>{message.text}</p>)}
        {busy && <p className={styles.assistant}>Consultando…</p>}
        {!asked && <div className={styles.suggestions}>
          {offered.map(text => <button key={text} type="button" className={styles.suggestion} onClick={() => void ask(text)}>{text}</button>)}
        </div>}
      </div>
      <form className={styles.form} onSubmit={submit}>
        <textarea className={styles.input} value={draft} rows={2} maxLength={QUESTION_MAX}
          onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown}
          placeholder="Escribe tu pregunta" aria-label="Tu pregunta" />
        <button type="submit" className={styles.send} disabled={busy || draft.trim() === ''} aria-label="Enviar">
          <Send size={22} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </form>
    </section>
    <p className={styles.note}>Enter envía y Shift + Enter baja de línea. {ASSISTANT_NAME} no reemplaza al veterinario.</p>
  </div>
}
