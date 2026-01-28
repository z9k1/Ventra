export type VentraSettings = {
  apiBaseUrl: string
  apiKey: string
}

const STORAGE_KEY = 'ventrasim_ventra_settings_v1'

export const DEFAULT_VENTRA_SETTINGS: VentraSettings = {
  apiBaseUrl: 'http://localhost:8000',
  apiKey: ''
}

export function loadVentraSettings(): VentraSettings {
  if (typeof window === 'undefined') return DEFAULT_VENTRA_SETTINGS

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULT_VENTRA_SETTINGS

  try {
    const parsed = JSON.parse(raw) as Partial<VentraSettings>
    return {
      apiBaseUrl: parsed.apiBaseUrl || DEFAULT_VENTRA_SETTINGS.apiBaseUrl,
      apiKey: parsed.apiKey || DEFAULT_VENTRA_SETTINGS.apiKey
    }
  } catch {
    return DEFAULT_VENTRA_SETTINGS
  }
}

export function saveVentraSettings(settings: VentraSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function buildVentraHeaders(settings: VentraSettings): Record<string, string> {
  const headers: Record<string, string> = {}
  if (settings.apiBaseUrl?.trim()) headers['x-api-base-url'] = settings.apiBaseUrl.trim()
  if (settings.apiKey?.trim()) headers['x-api-key'] = settings.apiKey.trim()
  return headers
}
