export interface SafeStorage {
  getJson<T>(key: string): T | null
  setJson<T>(key: string, value: T): void
  remove(key: string): void
}

export function createSafeStorage(getStorage: () => Storage = () => globalThis.localStorage): SafeStorage {
  const memory = new Map<string, string>()
  // Stay in memory after a failure so stale persisted values cannot restore a session.
  let memoryOnly = false

  return {
    getJson<T>(key: string): T | null {
      let value = memory.get(key) ?? null
      if (!memoryOnly) {
        try {
          value = getStorage().getItem(key)
          if (value === null) memory.delete(key)
          else memory.set(key, value)
        } catch { memoryOnly = true }
      }
      try { return value === null ? null : JSON.parse(value) as T }
      catch { return null }
    },
    setJson<T>(key: string, value: T) {
      const serialized = JSON.stringify(value)
      memory.set(key, serialized)
      if (!memoryOnly) {
        try { getStorage().setItem(key, serialized) }
        catch { memoryOnly = true }
      }
    },
    remove(key: string) {
      memory.delete(key)
      if (!memoryOnly) {
        try { getStorage().removeItem(key) }
        catch { memoryOnly = true }
      }
    },
  }
}

export const safeStorage = createSafeStorage()
