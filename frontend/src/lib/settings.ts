export type ApiSettings = {
  apiBaseUrl: string
  apiKey: string
}

const STORAGE_KEY = 'ventra_settings_v1'

export const DEFAULT_SETTINGS: ApiSettings = {
  apiBaseUrl: 'http://localhost:8000',
  apiKey: 'dev-secret'
}

export function loadSettings(): ApiSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULT_SETTINGS

  try {
    const parsed = JSON.parse(raw) as Partial<ApiSettings>
    return {
      apiBaseUrl: parsed.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl,
      apiKey: parsed.apiKey || DEFAULT_SETTINGS.apiKey
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: ApiSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function isSettingsValid(settings: ApiSettings) {
  try {
    new URL(settings.apiBaseUrl)
    return Boolean(settings.apiKey)
  } catch {
    return false
  }
}