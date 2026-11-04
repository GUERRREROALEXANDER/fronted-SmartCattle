import { dataMode } from '../api/config'
import { ApiError } from '../api/errors'
import { postJson } from '../api/httpClient'
import type { ServiceOptions } from './options'

export interface AssistantTurn { role: 'user' | 'assistant'; text: string }

/**
 * Asks the backend's language model, which answers from this account's farm data (POST /api/assistant/messages).
 * Null means it is not available here (no key on the server, or an older server), and the rules answer instead.
 */
export async function askAssistantModel(question: string, history: readonly AssistantTurn[], options: ServiceOptions = {}): Promise<string | null> {
  if ((options.mode ?? dataMode) === 'mock') return null
  try {
    const body = await postJson<{ reply?: unknown }>('/api/assistant/messages', {
      message: question, history, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota',
    }, { ...options, timeoutMs: 45_000 })
    return typeof body.reply === 'string' && body.reply.trim() ? body.reply : null
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error
    return null
  }
}
