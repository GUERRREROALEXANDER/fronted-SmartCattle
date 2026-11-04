import { useState, type FormEvent } from 'react'
import { useResource } from '../../lib/useResource'
import { getNotificationSettings, saveNotificationSettings, sendNotificationTest } from '../../services'
import type { NotificationChannel, NotificationSettings, Severity } from '../../types/domain'
import styles from './SettingsPage.module.css'

const channelLabel: Record<NotificationChannel, string> = { whatsapp: 'WhatsApp', telegram: 'Telegram' }
const severityOptions: { value: Severity; label: string }[] = [
  { value: 'info', label: 'Todas' },
  { value: 'warning', label: 'Advertencias y críticas' },
  { value: 'critical', label: 'Solo críticas' },
]

function Fields({ saved, onSaved }: { saved: NotificationSettings; onSaved: (next: NotificationSettings) => void }) {
  const [enabled, setEnabled] = useState(saved.enabled)
  const [phone, setPhone] = useState(saved.whatsappPhone ?? '')
  const [chat, setChat] = useState(saved.telegramChatId ?? '')
  const [minSeverity, setMinSeverity] = useState(saved.minSeverity)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const available = saved.channelsAvailable
  const missing = (['whatsapp', 'telegram'] as const).filter(channel => !available.includes(channel))

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      onSaved(await saveNotificationSettings({ enabled, whatsappPhone: phone.trim() || null, telegramChatId: chat.trim() || null, minSeverity }))
      setResult('Guardado.')
    } catch {
      setResult('No se pudo guardar. Revisa que el número empiece por + y el código del país, por ejemplo +573001234567.')
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setResult(null)
    try {
      const results = await sendNotificationTest()
      setResult(results.length === 0
        ? 'No hay ningún canal listo para enviar.'
        : results.map(item => `${channelLabel[item.channel]}: ${item.sent ? 'enviado' : 'no se pudo enviar'}`).join(' · '))
    } catch {
      setResult('No hay ningún canal listo: guarda un destinatario de un canal activo en el servidor.')
    } finally {
      setBusy(false)
    }
  }

  return <form className={styles.notifications} onSubmit={save}>
    <label className={styles.check}>
      <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Avisarme fuera de la aplicación
    </label>
    <label className={styles.field}>
      <span>WhatsApp (con código de país)</span>
      <input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+573001234567" autoComplete="tel" pattern="\+[1-9][0-9]{7,14}" />
    </label>
    <label className={styles.field}>
      <span>Telegram (identificador del chat)</span>
      <input inputMode="numeric" value={chat} onChange={event => setChat(event.target.value)} pattern="-?[0-9]{1,20}" />
    </label>
    <label className={styles.field}>
      <span>Qué alertas enviar</span>
      <select value={minSeverity} onChange={event => setMinSeverity(event.target.value as Severity)}>
        {severityOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <div className={styles.actions}>
      <button type="submit" className={styles.action} disabled={busy}>Guardar</button>
      <button type="button" className={styles.action} disabled={busy} onClick={() => void test()}>Enviar prueba</button>
    </div>
    {result && <p className={styles.note} role="status">{result}</p>}
    {missing.length > 0 && <p className={styles.note}>
      {missing.map(channel => channelLabel[channel]).join(' y ')}: {missing.length === 1 ? 'no está activo' : 'no están activos'} en el servidor todavía; {missing.length === 1 ? 'necesita' : 'necesitan'} sus credenciales.
    </p>}
  </form>
}

/** Where the owner gets alerts outside the app. */
export function NotificationSettingsForm() {
  const settings = useResource(signal => getNotificationSettings({ signal }))
  const [saved, setSaved] = useState<NotificationSettings | null>(null)
  const current = saved ?? settings.data
  if (settings.status === 'loading') return null
  if (!current) return <p className={styles.note}>Los avisos por WhatsApp o Telegram no están disponibles en este servidor.</p>
  return <Fields saved={current} onSaved={setSaved} />
}
