import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { join } from 'node:path'
import { APP_VERSION } from '../shared/version'
import {
  EMPTY_CONTROL_STATE,
  SITE_URL,
  cloneSettings,
  type AppSettings,
  type ControlCommand,
  type ControlState
} from '../shared/types'
import { DemoShow } from '../shared/demoShow'
import { LiveSession } from './liveSession'
import { loadSettings, saveSettings } from './settingsStore'
import { requestLocalNetworkAccess } from './localNetworkAccess'
import { clearDebugLog, exportDebugLog, setDebugLogEnabled, debugLog } from './sessionLogger'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let settings: AppSettings = cloneSettings()
let live: ControlState = { ...EMPTY_CONTROL_STATE }
let demo: DemoShow | null = null
let session: LiveSession | null = null
let tick: NodeJS.Timeout | null = null
let connectGeneration = 0

function iconPath(): string {
  return isDev
    ? join(process.cwd(), 'resources/icon.png')
    : join(__dirname, '../renderer/icon.png')
}

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 880,
    minHeight: 560,
    show: false,
    backgroundColor: settings.appearance === 'light' ? '#f3f5f8' : '#0b0f14',
    title: `Pixera Control v${APP_VERSION}`,
    autoHideMenuBar: true,
    icon: iconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.setAlwaysOnTop(settings.alwaysOnTop)
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function emit(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('control-state', live)
  }
}

function startDemo(): void {
  demo = new DemoShow()
  live = demo.snapshot()
  emit()
  if (tick) clearInterval(tick)
  tick = setInterval(() => {
    if (!demo) return
    live = demo.snapshot()
    emit()
  }, 200)
}

function stopSession(): void {
  connectGeneration += 1
  if (tick) clearInterval(tick)
  tick = null
  demo = null
  const closing = session
  session = null
  void closing?.close()
  live = { ...EMPTY_CONTROL_STATE, status: 'disconnected', updatedAt: Date.now() }
  emit()
}

async function connectLive(): Promise<ControlState> {
  const generation = ++connectGeneration
  if (tick) clearInterval(tick)
  tick = null
  demo = null
  const previous = session
  session = null
  void previous?.close()
  const host = settings.host.trim()
  const port = settings.port
  live = {
    ...EMPTY_CONTROL_STATE,
    status: 'connecting',
    projectName: `${host}:${port}`,
    updatedAt: Date.now()
  }
  emit()
  const next = new LiveSession()
  try {
    live = await next.connect(host, port)
    if (generation !== connectGeneration) {
      await next.close()
      return live
    }
    session = next
    session.setLockedIds(settings.lockedTimelineIds)
    session.setOnChange(() => {
      if (!session) return
      live = session.snapshot()
      emit()
    })
    emit()
    tick = setInterval(() => {
      session?.setLockedIds(settings.lockedTimelineIds)
      void session?.poll().then((state) => {
        if (!session) return
        live = state
        emit()
      })
    }, 900)
    return live
  } catch (error) {
    await next.close()
    const message = error instanceof Error ? error.message : String(error)
    console.log(`[pixera] connect failed: ${message}`)
    if (generation !== connectGeneration) return live
    live = {
      ...EMPTY_CONTROL_STATE,
      status: 'error',
      error: message,
      projectName: `${host}:${port}`,
      updatedAt: Date.now()
    }
    emit()
    return live
  }
}

app.whenReady().then(() => {
  settings = loadSettings()
  setDebugLogEnabled(settings.debugLogging === true)
  requestLocalNetworkAccess()
  createWindow()
  if (settings.mode === 'demo') startDemo()
  else void connectLive()

  ipcMain.handle('get-settings', () => settings)
  ipcMain.handle('get-state', () => live)
  ipcMain.handle('get-app-version', () => APP_VERSION)
  ipcMain.handle('save-settings', (_event, next: AppSettings) => {
    const prevLog = settings.debugLogging === true
    settings = saveSettings(next)
    if ((settings.debugLogging === true) !== prevLog) {
      setDebugLogEnabled(settings.debugLogging === true)
    }
    mainWindow?.setAlwaysOnTop(settings.alwaysOnTop)
    mainWindow?.webContents.send('settings', settings)
    return settings
  })
  ipcMain.handle('connect', () => {
    debugLog('CMD', 'connect', { mode: settings.mode, host: settings.host, port: settings.port })
    if (settings.mode !== 'demo') return connectLive()
    stopSession()
    startDemo()
    return live
  })
  ipcMain.handle('disconnect', () => {
    debugLog('CMD', 'disconnect')
    stopSession()
    return live
  })
  ipcMain.handle('refresh', async () => {
    debugLog('CMD', 'refresh')
    if (demo) {
      live = demo.snapshot()
      emit()
      return live
    }
    if (!session) return live
    live = await session.refresh()
    emit()
    return live
  })
  ipcMain.handle('command', async (_event, command: ControlCommand) => {
    debugLog('CMD', 'command', command)
    if (demo) {
      live = demo.command(command)
      emit()
      return live
    }
    if (!session) return live
    let nextCommand = command
    if (command.type === 'stop' && settings.fadeOnStop) {
      nextCommand = { ...command, fadeSeconds: settings.fadeOnStopSeconds }
    }
    if (command.type === 'global' && command.mode === 'stop' && settings.fadeOnStop) {
      nextCommand = { ...command, fadeSeconds: settings.fadeOnStopSeconds }
    }
    live = await session.command(nextCommand)
    emit()
    return live
  })
  ipcMain.handle('export-debug-log', () => exportDebugLog())
  ipcMain.handle('clear-debug-log', () => {
    clearDebugLog()
    return true
  })
  ipcMain.handle('set-fullscreen', (_event, value: boolean) => {
    mainWindow?.setFullScreen(value)
    return mainWindow?.isFullScreen() ?? false
  })
  ipcMain.handle('open-url', async (_event, url: string) => {
    if (url === SITE_URL) await shell.openExternal(url)
    return true
  })
})

app.on('window-all-closed', () => {
  stopSession()
  if (process.platform !== 'darwin') app.quit()
})
