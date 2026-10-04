import { useEffect } from 'react'
import { useMatches } from 'react-router'

export function useDocumentTitle() {
  const matches = useMatches()
  const handle = [...matches].reverse().find(match => {
    const value = match.handle
    return typeof value === 'object' && value !== null && 'title' in value && typeof value.title === 'string'
  })?.handle as { title: string } | undefined
  const title = handle?.title ?? 'Inicio'

  useEffect(() => {
    document.title = `${title} · SmartCattle`
  }, [title])
}
