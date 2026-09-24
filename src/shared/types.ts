export type ConnectionMode = 'demo' | 'json-tcp-auto'
export type Appearance = 'dark' | 'light'
export type ViewMode = 'list' | 'director'
export type Transport = 'play' | 'pause' | 'stop' | 'unknown'
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export const SITE_URL = 'https://desertdog.nl'

export interface AppSettings {
  host: string
  port: number
  mode: ConnectionMode
  alwaysOnTop: boolean
  appearance: Appearance
  viewMode: ViewMode
  timelinePadOrder: string[]
  directorHiddenTimelineIds: string[]
  lockedTimelineIds: string[]
  confirmStop: boolean
  fadeOnStop: boolean
  fadeOnStopSeconds: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  host: '127.0.0.1',
  port: 1400,
  mode: 'demo',
  alwaysOnTop: false,
  appearance: 'dark',
  viewMode: 'list',
  timelinePadOrder: [],
  directorHiddenTimelineIds: [],
  lockedTimelineIds: [],
  confirmStop: true,
  fadeOnStop: true,
  fadeOnStopSeconds: 1
}

export function cloneSettings(settings: AppSettings = DEFAULT_SETTINGS): AppSettings {
  return {
    ...settings,
    lockedTimelineIds: [...settings.lockedTimelineIds],
    timelinePadOrder: [...settings.timelinePadOrder],
    directorHiddenTimelineIds: [...settings.directorHiddenTimelineIds]
  }
}

export interface CueItem {
  id: string
  name: string
  timeSeconds: number
}

export interface LayerItem {
  id: string
  name: string
  opacity: number
  muted: boolean
}

export interface TimelineItem {
  id: string
  name: string
  transport: Transport
  positionSeconds: number
  durationSeconds: number
  countdownSeconds: number | null
  opacity: number
  currentCueId: string
  cues: CueItem[]
  layers: LayerItem[]
}

export interface ControlState {
  status: ConnectionStatus
  error: string | null
  projectName: string
  selectedTimelineId: string
  armed: boolean
  timelines: TimelineItem[]
  updatedAt: number
}

export const EMPTY_CONTROL_STATE: ControlState = {
  status: 'disconnected',
  error: null,
  projectName: '',
  selectedTimelineId: '',
  armed: false,
  timelines: [],
  updatedAt: 0
}

export type ControlCommand =
  | { type: 'select'; timelineId: string }
  | { type: 'play'; timelineId: string }
  | { type: 'pause'; timelineId: string }
  | { type: 'stop'; timelineId: string; fadeSeconds?: number }
  | { type: 'opacity'; timelineId: string; value: number }
  | { type: 'layer-opacity'; timelineId: string; layerId: string; value: number }
  | { type: 'layer-mute'; timelineId: string; layerId: string; muted: boolean }
  | { type: 'go'; timelineId: string; cueId: string }
  | { type: 'prev'; timelineId: string }
  | { type: 'next'; timelineId: string }
  | { type: 'arm'; armed: boolean }
  | {
      type: 'global'
      mode: 'play' | 'pause' | 'stop'
      lockedIds: string[]
      fadeSeconds?: number
    }

export const MODE_LABELS: Record<ConnectionMode, string> = {
  demo: 'Demo (no Pixera needed)',
  'json-tcp-auto': 'Pixera JSON/TCP'
}
