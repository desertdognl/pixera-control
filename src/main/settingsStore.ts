import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cloneSettings, DEFAULT_SETTINGS, type AppSettings, type ConnectionMode, type ViewMode } from '../shared/types'

const FILE_NAME = 'settings.json'

function settingsPath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

function isMode(value: unknown): value is ConnectionMode {
  return value === 'demo' || value === 'json-tcp-auto'
}

function isViewMode(value: unknown): value is ViewMode {
  return value === 'list' || value === 'director'
}

export function loadSettings(): AppSettings {
  try {
    if (!existsSync(settingsPath())) return cloneSettings()
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<AppSettings>
    return cloneSettings({
      ...DEFAULT_SETTINGS,
      ...raw,
      host: String(raw.host || DEFAULT_SETTINGS.host),
      port: Math.min(65535, Math.max(1, Math.round(Number(raw.port) || DEFAULT_SETTINGS.port))),
      mode: isMode(raw.mode) ? raw.mode : DEFAULT_SETTINGS.mode,
      alwaysOnTop: Boolean(raw.alwaysOnTop),
      appearance: raw.appearance === 'light' ? 'light' : 'dark',
      viewMode: isViewMode(raw.viewMode) ? raw.viewMode : DEFAULT_SETTINGS.viewMode,
      timelinePadOrder: Array.isArray(raw.timelinePadOrder)
        ? raw.timelinePadOrder.map((id) => String(id)).filter(Boolean)
        : [],
      directorHiddenTimelineIds: Array.isArray(raw.directorHiddenTimelineIds)
        ? raw.directorHiddenTimelineIds.map((id) => String(id)).filter(Boolean)
        : [],
      lockedTimelineIds: Array.isArray(raw.lockedTimelineIds)
        ? raw.lockedTimelineIds.map((id) => String(id)).filter(Boolean)
        : [],
      confirmStop: raw.confirmStop !== false,
      fadeOnStop: raw.fadeOnStop !== false,
      fadeOnStopSeconds: Math.min(
        10,
        Math.max(0.2, Number(raw.fadeOnStopSeconds) || DEFAULT_SETTINGS.fadeOnStopSeconds)
      )
    })
  } catch {
    return cloneSettings()
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  const next = cloneSettings(settings)
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2))
  return next
}
