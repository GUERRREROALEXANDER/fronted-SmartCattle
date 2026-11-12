import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../app/auth/useAuth'
import { herdCount } from '../../live/liveState'
import { useLive } from '../../live/useLive'
import { askAssistantModel, getAlertReport, getDailyReport, type AssistantTurn } from '../../services'
import { onboardingOf, suggestionsFor } from '../onboarding/onboardingModel'
import { answer, greeting, suggestions, type AssistantData } from './assistantEngine'
import { AssistantContext, type AssistantMessage } from './assistantContext'

const reportData: Pick<AssistantData, 'daily' | 'alerts'> = {
  daily: async day => (await getDailyReport({ day })).data,
  alerts: async (start, end) => (await getAlertReport({ start, end })).data,
}
const HISTORY_TURNS = 8

/** Lives in the shell, so the floating panel and the model page show one conversation, kept between pages. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const live = useLive()
  const name = session?.user.name
  const [busy, setBusy] = useState(false)
  const [usingModel, setUsingModel] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [{ id: 0, from: 'assistant', text: greeting(name) }])
  const nextId = useRef(1)
  // Read when asked, not when the question was typed: live data changes while the answer loads.
  const facts = useRef(live)

  useEffect(() => {
    facts.current = live
  }, [live])

  function push(from: AssistantMessage['from'], text: string) {
    const id = nextId.current++
    setMessages(current => [...current, { id, from, text }])
  }

  async function ask(question: string) {
    const text = question.trim()
    if (!text || busy) return
    const history: AssistantTurn[] = messages.slice(1).slice(-HISTORY_TURNS).map(message => ({ role: message.from, text: message.text }))
    push('user', text)
    setBusy(true)
    try {
      const reply = await askAssistantModel(text, history)
      setUsingModel(reply !== null)
      push('assistant', reply ?? await answer(text, {
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

  function clear() {
    setMessages([{ id: 0, from: 'assistant', text: greeting(name) }])
    setUsingModel(null)
  }

  return <AssistantContext.Provider value={{
    messages,
    busy,
    status: usingModel === false ? 'Modo básico: reglas con los datos de tu finca' : 'Responde con los datos de tu finca',
    offered: session ? suggestionsFor(onboardingOf(session.user.id)?.goals ?? [], suggestions) : suggestions,
    ask,
    clear,
  }}>{children}</AssistantContext.Provider>
}
