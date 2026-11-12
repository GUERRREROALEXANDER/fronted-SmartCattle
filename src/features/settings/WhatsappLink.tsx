import { useState, type FormEvent } from 'react'
import { useAuth } from '../../app/auth/useAuth'
import { useResource } from '../../lib/useResource'
import {
  confirmWhatsappCode, forgetPendingWhatsapp, getWhatsappContact, pendingWhatsapp, removeWhatsappNumber, setWhatsappEnabled,
  startWhatsappVerification, whatsappProblem, type WhatsappContact,
} from '../../services'
import { normalizePhone, validatePhone } from '../auth/validation'
import styles from './SettingsPage.module.css'

function Linked({ contact, onChanged }: { contact: WhatsappContact; onChanged: (next: WhatsappContact | null) => void }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function act(change: () => Promise<WhatsappContact | null>) {
    setBusy(true)
    setProblem(null)
    try {
      onChanged(await change())
    } catch (error) {
      setProblem(whatsappProblem(error))
    } finally {
      setBusy(false)
    }
  }

  return <div className={styles.notifications}>
    <p>Las alertas llegan a <strong className="tabular">{contact.phone}</strong>.</p>
    <label className={styles.check}>
      <input type="checkbox" checked={contact.enabled} disabled={busy}
        onChange={event => void act(() => setWhatsappEnabled(event.target.checked))} /> Enviarme alertas por WhatsApp
    </label>
    <div className={styles.actions}>
      <button type="button" className={styles.action} disabled={busy}
        onClick={() => void act(async () => { await removeWhatsappNumber(); return null })}>Quitar número</button>
    </div>
    {problem && <p className={styles.note} role="alert">{problem}</p>}
  </div>
}

function Verify({ onLinked }: { onLinked: (contact: WhatsappContact) => void }) {
  const { isDemoMode } = useAuth()
  const [pending] = useState(() => pendingWhatsapp())
  const [phone, setPhone] = useState(pending ?? '+57')
  // A number given when signing up already had its code sent.
  const [codeSent, setCodeSent] = useState(pending !== null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function send(event: FormEvent) {
    event.preventDefault()
    const invalid = validatePhone(phone)
    if (invalid) {
      setMessage(invalid)
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      await startWhatsappVerification(normalizePhone(phone))
      setCodeSent(true)
      setCode('')
    } catch (error) {
      setMessage(whatsappProblem(error))
    } finally {
      setBusy(false)
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const contact = await confirmWhatsappCode(code)
      forgetPendingWhatsapp()
      onLinked(contact)
    } catch (error) {
      setMessage(whatsappProblem(error))
    } finally {
      setBusy(false)
    }
  }

  return <div className={styles.notifications}>
    <form className={styles.notifications} onSubmit={send} noValidate>
      <label className={styles.field}>
        <span>Tu número de WhatsApp</span>
        <input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+573001234567" autoComplete="tel" inputMode="tel" />
      </label>
      <div className={styles.actions}>
        <button type="submit" className={styles.action} disabled={busy}>{codeSent ? 'Enviar otro código' : 'Enviarme un código'}</button>
      </div>
    </form>
    {codeSent && <form className={styles.notifications} onSubmit={confirm}>
      <label className={styles.field}>
        <span>Código de 6 dígitos</span>
        <input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
      </label>
      <p className={styles.note}>
        {isDemoMode
          ? 'En la demostración no se envía ningún mensaje: escribe 6 dígitos cualesquiera.'
          : 'Llega por WhatsApp mientras el servicio de avisos esté encendido, y vence en unos minutos.'}
      </p>
      <div className={styles.actions}>
        <button type="submit" className={styles.action} disabled={busy || code.length !== 6}>Confirmar</button>
      </div>
    </form>}
    {message && <p className={styles.note} role="alert">{message}</p>}
  </div>
}

/** The number that receives alerts, which only counts once its owner proves they hold it. */
export function WhatsappLink() {
  const stored = useResource(signal => getWhatsappContact({ signal }))
  const [changed, setChanged] = useState<{ contact: WhatsappContact | null } | null>(null)
  if (stored.status === 'loading') return null
  if (stored.status === 'error' && !changed) return <p className={styles.note} role="alert">{whatsappProblem(stored.error)}</p>
  const contact = changed ? changed.contact : stored.data
  return contact
    ? <Linked contact={contact} onChanged={next => setChanged({ contact: next })} />
    : <Verify onLinked={next => setChanged({ contact: next })} />
}
