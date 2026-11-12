import { useState, type FormEvent } from 'react'
import { Cloud, Plug, Sparkles, Wifi } from 'lucide-react'
import { Button, GlassCard, StatusPill, TextField } from '../../components/ui'
import { useResource } from '../../lib/useResource'
import {
  connectCamera, connectProblem, isLanAddress, listCameraSuggestions, listCloudCameras,
  type CameraSuggestion, type ConnectResult,
} from '../../services'
import styles from './CloudConnect.module.css'

type Answer = { kind: 'result'; address: string; result: ConnectResult } | { kind: 'error'; message: string }

function answerText(answer: Answer): string {
  if (answer.kind === 'error') return answer.message
  const { address, result } = answer
  if (result.outcome === 'connected') {
    return `Listo: ${result.camera?.name ?? 'la cámara'} quedó conectada. El video y la IA empiezan en unos segundos y se ven desde cualquier lugar.`
  }
  const where = isLanAddress(address)
    ? `${address} es una dirección de tu wifi: solo existe dentro de la finca, así que desde internet no se puede abrir.`
    : `${address} todavía no se puede abrir desde la nube por su dirección.`
  return result.outcome === 'choose'
    ? `${where} Te recomendamos conectarla por la nube de Imou, y así se verá desde cualquier lugar:`
    : `${where} No hay cámaras Imou libres en la cuenta de SmartCattle: agrega la cámara a esa cuenta en la app Imou y vuelve a intentarlo.`
}

function SuggestionItem({ item, recommended, busy, onConnect }: {
  item: CameraSuggestion; recommended: boolean; busy: boolean; onConnect: (item: CameraSuggestion) => void
}) {
  return <li className={`${styles.suggestion} ${recommended ? styles.recommended : ''}`}>
    <span className={styles.suggestionText}>
      <strong>{item.name}</strong>
      <span className="tabular">{item.model ? `${item.model} · ` : ''}Serie {item.serial}</span>
    </span>
    {recommended && <span className={styles.badge}><Sparkles size={14} aria-hidden="true" />Recomendada</span>}
    <StatusPill tone={item.online ? 'safe' : 'inactive'} label={item.online ? 'En línea' : 'Apagada'} />
    {item.cameraId
      ? <span className={styles.done}>Conectada</span>
      : <Button size="sm" icon={Plug} loading={busy} onClick={() => onConnect(item)}>Conectar</Button>}
  </li>
}

export function CloudConnect({ onChanged }: { onChanged?: () => void }) {
  const [address, setAddress] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const suggestions = useResource(signal => listCameraSuggestions({ signal }), { refreshMs: 30_000 })
  const connected = useResource(signal => listCloudCameras({ signal }), { refreshMs: 15_000 })

  const run = async (key: string, input: { address?: string; serial?: string }) => {
    setBusy(key)
    try {
      const result = await connectCamera(input)
      setAnswer({ kind: 'result', address: input.address ?? input.serial ?? '', result })
      if (result.outcome === 'connected') {
        setAddress('')
        onChanged?.()
      }
      suggestions.reload()
      connected.reload()
    } catch (error) {
      setAnswer({ kind: 'error', message: connectProblem(error) })
    } finally {
      setBusy(null)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (address.trim()) void run('form', { address })
  }
  // The address typed above goes with the camera, so its IP shows on the list.
  const connectSuggestion = (item: CameraSuggestion) => {
    const typed = address.trim() && answer?.kind === 'result' && answer.result.outcome === 'choose' ? address : undefined
    void run(item.serial, { serial: item.serial, address: typed })
  }

  const offered = answer?.kind === 'result' && answer.result.outcome === 'choose' ? answer.result.suggestions : []
  const recommended = answer?.kind === 'result' ? answer.result.recommended : null
  const free = (suggestions.data?.items ?? []).filter(item => !item.cameraId)
  const others = free.filter(item => !offered.some(offer => offer.serial === item.serial))

  return <GlassCard as="section" padding="lg" aria-labelledby="cloud-connect-title" className={styles.card}>
    <h2 id="cloud-connect-title" className={styles.title}>Conecta tu cámara</h2>
    <p className={styles.note}>Escribe la dirección IP de la cámara (la ves en la app Imou, en <em>Detalles del dispositivo</em>) o su número de serie. El sistema te dice cómo conectarla para verla desde cualquier lugar.</p>

    <form className={styles.form} onSubmit={submit}>
      <TextField label="Dirección IP o número de serie" leadingIcon={Wifi} value={address} inputMode="url"
        placeholder="192.168.1.50" autoComplete="off" spellCheck={false} maxLength={255}
        onChange={event => setAddress(event.target.value)} />
      <Button type="submit" icon={Plug} loading={busy === 'form'} disabled={!address.trim()}>Conectar</Button>
    </form>

    {answer && <div className={answer.kind === 'error' ? styles.error : styles.answer} role={answer.kind === 'error' ? 'alert' : 'status'}>
      <p>{answerText(answer)}</p>
      {offered.length > 0 && <ul className={styles.list}>
        {offered.map(item => <SuggestionItem key={item.serial} item={item} recommended={item.serial === recommended}
          busy={busy === item.serial} onConnect={connectSuggestion} />)}
      </ul>}
    </div>}

    {others.length > 0 && <div className={styles.block}>
      <h3 className={styles.subtitle}><Sparkles size={16} aria-hidden="true" />Cámaras recomendadas</h3>
      <p className={styles.note}>Estas cámaras Imou se pueden ver desde cualquier lugar. Conéctalas con un clic.</p>
      <ul className={styles.list}>
        {others.map(item => <SuggestionItem key={item.serial} item={item} recommended={free.length === 1 || item.serial === recommended}
          busy={busy === item.serial} onConnect={connectSuggestion} />)}
      </ul>
    </div>}

    {(connected.data?.length ?? 0) > 0 && <div className={styles.block}>
      <h3 className={styles.subtitle}><Cloud size={16} aria-hidden="true" />Conectadas por la nube</h3>
      <ul className={styles.list}>
        {connected.data?.map(camera => <li key={camera.id} className={styles.suggestion}>
          <span className={styles.suggestionText}>
            <strong>{camera.name}</strong>
            <span className="tabular">{camera.address ? `IP ${camera.address}` : 'Sin IP registrada'}</span>
          </span>
          <StatusPill tone={camera.status === 'online' ? 'safe' : camera.status === 'error' ? 'critical' : 'warning'}
            label={camera.status === 'online' ? 'Transmitiendo' : camera.status === 'error' ? 'Con error' : 'Abriendo video…'} />
        </li>)}
      </ul>
    </div>}
  </GlassCard>
}
