import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { describeApiError } from '../../api/errors'
import { ApiError } from '../../api/errors'
import { Button, TextField } from '../../components/ui'
import { AuthLayout } from '../auth/AuthLayout'
import { addressProblem, savePairedCamera } from '../../services'
import styles from './CameraConnect.module.css'

/**
 * What the QR on the Cameras page opens on a phone. There is no session here: the code in the link stands in for one,
 * once, and only to save this camera in the account that showed the QR.
 */
export function PhonePairPage() {
  const [params] = useSearchParams()
  const code = params.get('code') ?? ''
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState(code ? '' : 'Este enlace no es válido. Escanea el QR de la página de cámaras.')
  const [done, setDone] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const wrong = addressProblem(address)
    if (wrong) {
      setProblem(wrong)
      return
    }
    setSaving(true)
    setProblem('')
    try {
      await savePairedCamera(code, name, address)
      setDone(true)
    } catch (error) {
      setProblem(error instanceof ApiError && error.status === 403
        ? 'Este QR ya se usó o venció. Genera otro en la página de cámaras y vuelve a escanearlo.'
        : describeApiError(error).description)
    } finally {
      setSaving(false)
    }
  }

  return <AuthLayout mode="phone" title="Agregar esta cámara" description="Se guarda en la cuenta que mostró el QR." footer={null}>
    {done
      ? <p className={styles.ok} role="status">Listo. Vuelve al PC y pulsa Conectar en «{name}». Deja este celular enchufado y con la app abierta.</p>
      : <form className={styles.form} onSubmit={submit}>
        <ol className={styles.steps}>
          <li>Instala <strong>IP Webcam</strong> (Android) o una app que muestre una dirección de video.</li>
          <li>Ábrela y pulsa <strong>Iniciar servidor</strong>.</li>
          <li>Escribe aquí la dirección que aparece en la pantalla.</li>
        </ol>
        <TextField label="Nombre de la cámara" value={name} onChange={event => setName(event.target.value)} required maxLength={80}
          placeholder="Corral del ternero" autoComplete="off" />
        <TextField label="Dirección que muestra la app" value={address} onChange={event => setAddress(event.target.value)} required
          placeholder="192.168.1.20:8080" inputMode="url" autoComplete="off" autoCapitalize="none" />
        {problem && <p className={styles.error} role="alert">{problem}</p>}
        <Button type="submit" loading={saving} disabled={!code}>Guardar cámara</Button>
      </form>}
  </AuthLayout>
}
