import { safeStorage } from './safeStorage'

// What this browser keeps for the person signed in. A shared PC must not show one account's videos to the next.
const OWNER_KEY = 'smartcattle.account.owner'
const ACCOUNT_KEYS = ['smartcattle.videos.analyses', 'smartcattle.videos.safeZone', 'smartcattle.whatsapp.pending']

export function forgetAccountData(): void {
  ACCOUNT_KEYS.forEach(key => safeStorage.remove(key))
  safeStorage.remove(OWNER_KEY)
}

/** Call on signing in: what another account left behind goes away, what this one left stays. */
export function claimAccountData(userId: string): void {
  if (safeStorage.getJson<string>(OWNER_KEY) !== userId) ACCOUNT_KEYS.forEach(key => safeStorage.remove(key))
  safeStorage.setJson(OWNER_KEY, userId)
}
