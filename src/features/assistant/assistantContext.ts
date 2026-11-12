import { createContext, useContext } from 'react'

export interface AssistantMessage { id: number; from: 'assistant' | 'user'; text: string }

export interface AssistantConversation {
  messages: readonly AssistantMessage[]
  busy: boolean
  /** One line on what is answering: the model, or the local rules when it is not available. */
  status: string
  /** What to offer before the first question. */
  offered: readonly string[]
  ask: (question: string) => Promise<void>
  clear: () => void
}

export const AssistantContext = createContext<AssistantConversation | null>(null)

export function useAssistant(): AssistantConversation {
  const conversation = useContext(AssistantContext)
  if (!conversation) throw new Error('useAssistant must be used inside AssistantProvider')
  return conversation
}
