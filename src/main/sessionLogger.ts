import { app, dialog } from 'electron'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { APP_VERSION } from '../shared/version'

const FILE_NAME = 'debug-session.log'
const MAX_BYTES = 2_500_000

let enabled = false

function logPath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

function ensureDir(): void {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function trimIfHuge(): void {
  try {
    const path = logPath()
    if (!existsSync(path)) return
    if (statSync(path).size <= MAX_BYTES) return
    const text = readFileSync(path, 'utf8')
    const keep = text.slice(-Math.floor(MAX_BYTES * 0.6))
    writeFileSync(path, `--- log trimmed ---\n${keep}`)
  } catch {
    /* ignore */
  }
}

export function setDebugLogEnabled(value: boolean): void {
  if (value) {
    enabled = true
    ensureDir()
    debugLog('INFO', 'debug logging ON', { appVersion: APP_VERSION })
    return
  }
  if (enabled) debugLog('INFO', 'debug logging OFF')
  enabled = false
}

export function isDebugLogEnabled(): boolean {
  return enabled
}

export function clearDebugLog(): void {
  ensureDir()
  writeFileSync(logPath(), '')
  if (enabled) debugLog('INFO', 'debug log cleared', { appVersion: APP_VERSION })
}

export function getDebugLogText(): string {
  const path = logPath()
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf8')
}

export function debugLog(level: 'INFO' | 'WARN' | 'ERROR' | 'WRITE' | 'READ' | 'CMD', message: string, data?: unknown): void {
  if (!enabled) return
  try {
    ensureDir()
    trimIfHuge()
    const time = new Date().toISOString()
    let line = `${time} ${level} ${message}`
    if (data !== undefined) {
      try {
        line += ` ${JSON.stringify(data)}`
      } catch {
        line += ` [unserializable]`
      }
    }
    appendFileSync(logPath(), `${line}\n`, 'utf8')
  } catch {
    /* ignore logging failures */
  }
}

export async function exportDebugLog(): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const text = getDebugLogText()
    if (!text.trim()) {
      return { ok: false, error: 'Log is empty. Turn on debug logging and reproduce the issue first.' }
    }
    const result = await dialog.showSaveDialog({
      title: 'Export Pixera Control debug log',
      defaultPath: `pixera-control-debug-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`,
      filters: [{ name: 'Log', extensions: ['log', 'txt'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false, error: 'Export cancelled' }
    const header = [
      '# Pixera Control debug log',
      `# exported ${new Date().toISOString()}`,
      `# app ${APP_VERSION}`,
      '# format: ISO-time LEVEL message {optional json}',
      ''
    ].join('\n')
    writeFileSync(result.filePath, header + text, 'utf8')
    return { ok: true, path: result.filePath }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
