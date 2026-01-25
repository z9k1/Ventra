export type FrontendSettings = {
  apiBaseUrl: string
  apiKey: string
  useProxy: boolean
}

const STORAGE_KEY = 'ventra_settings'

export const DEFAULT_SETTINGS: FrontendSettings = {
  apiBaseUrl: 'http://localhost:8000',
  apiKey: 'dev-secret',
  useProxy: true
}

export function loadSettings(): FrontendSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return DEFAULT_SETTINGS
  }
  try {
    return JSON.parse(stored) as FrontendSettings
  } catch (error) {
    window.localStorage.removeItem(STORAGE_KEY)
    return DEFAULT_SETTINGS
  }
}

export function persistSettings(updated: FrontendSettings) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function resetSettings() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(STORAGE_KEY)
}
