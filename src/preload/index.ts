import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, ControlCommand, ControlState } from '../shared/types'

export interface ControlApi {
  getSettings: () => Promise<AppSettings>
  getState: () => Promise<ControlState>
  getAppVersion: () => Promise<string>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>
  connect: () => Promise<ControlState>
  disconnect: () => Promise<ControlState>
  refresh: () => Promise<ControlState>
  command: (command: ControlCommand) => Promise<ControlState>
  setFullscreen: (value: boolean) => Promise<boolean>
  openUrl: (url: string) => Promise<boolean>
  onState: (handler: (state: ControlState) => void) => () => void
  onSettings: (handler: (settings: AppSettings) => void) => () => void
}

const api: ControlApi = {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getState: () => ipcRenderer.invoke('get-state'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  connect: () => ipcRenderer.invoke('connect'),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  refresh: () => ipcRenderer.invoke('refresh'),
  command: (command) => ipcRenderer.invoke('command', command),
  setFullscreen: (value) => ipcRenderer.invoke('set-fullscreen', value),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  onState: (handler) => {
    const listener = (_event: unknown, state: ControlState) => handler(state)
    ipcRenderer.on('control-state', listener)
    return () => ipcRenderer.removeListener('control-state', listener)
  },
  onSettings: (handler) => {
    const listener = (_event: unknown, next: AppSettings) => handler(next)
    ipcRenderer.on('settings', listener)
    return () => ipcRenderer.removeListener('settings', listener)
  }
}

contextBridge.exposeInMainWorld('control', api)
