import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { forgetPendingWhatsapp, pendingWhatsapp } from '../../services'
import { Button, Notice } from '../ui'
import styles from './AppShell.module.css'

/** A number given when signing up receives nothing until its code is written back, so it is worth saying. */
export function WhatsappReminder() {
  const { pathname } = useLocation()
  const [dismissed, setDismissed] = useState(false)
  const phone = pendingWhatsapp()
  if (!phone || dismissed || pathname === '/settings') return null
  return <Notice className={styles.reminder} tone="info" title="Falta confirmar tu WhatsApp"
    action={<Button variant="ghost" size="sm" onClick={() => {
      forgetPendingWhatsapp()
      setDismissed(true)
    }}>Ahora no</Button>}>
    Las alertas no llegarán a {phone} hasta que escribas su código en <Link to="/settings#account">Ajustes</Link>.
  </Notice>
}
