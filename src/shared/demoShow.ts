import type { ControlCommand, ControlState, CueItem, LayerItem, TimelineItem, Transport } from './types'
import { EMPTY_CONTROL_STATE } from './types'

function cues(prefix: string, names: string[], spacing: number): CueItem[] {
  return names.map((name, index) => ({
    id: `${prefix}-${index + 1}`,
    name,
    timeSeconds: index * spacing
  }))
}

function layers(prefix: string, names: string[]): LayerItem[] {
  return names.map((name, index) => ({
    id: `${prefix}-L${index + 1}`,
    name,
    opacity: 1,
    muted: false
  }))
}

function timeline(
  id: string,
  name: string,
  names: string[],
  spacing: number,
  transport: Transport,
  positionSeconds: number,
  layerNames: string[]
): TimelineItem {
  const list = cues(id, names, spacing)
  const durationSeconds = list.length * spacing
  const current = list.reduce((best, cue) => (cue.timeSeconds <= positionSeconds ? cue : best), list[0])
  return {
    id,
    name,
    transport,
    positionSeconds,
    durationSeconds,
    countdownSeconds: (() => {
      const upcoming = list.find((cue) => cue.timeSeconds > positionSeconds)
      return upcoming ? upcoming.timeSeconds - positionSeconds : null
    })(),
    opacity: 1,
    currentCueId: current.id,
    cues: list,
    layers: layers(id, layerNames)
  }
}

export class DemoShow {
  private selectedId = 'show'
  private armed = false
  private lastTick = Date.now()
  private timelines: TimelineItem[] = [
    timeline(
      'show',
      'Show Timeline',
      ['1.01 House open', '1.02 Walk in', '2.01 Speaker', '3.01 Band', '4.01 Logo'],
      90,
      'play',
      42,
      ['Content', 'GFX']
    ),
    timeline('overlay', 'Overlay', ['Lower third in', 'Lower third out', 'Bumper'], 40, 'pause', 8, [
      'Titles',
      'Bug'
    ]),
    timeline('imag', 'IMAG', ['Cam 1', 'Cam 2', 'Wide'], 60, 'stop', 0, ['Camera', 'Key'])
  ]

  snapshot(): ControlState {
    this.tick()
    return {
      ...EMPTY_CONTROL_STATE,
      status: 'connected',
      error: null,
      projectName: 'Demo Show',
      selectedTimelineId: this.selectedId,
      armed: this.armed,
      timelines: this.timelines.map((item) => ({
        ...item,
        cues: item.cues.map((cue) => ({ ...cue })),
        layers: item.layers.map((layer) => ({ ...layer }))
      })),
      updatedAt: Date.now()
    }
  }

  command(command: ControlCommand): ControlState {
    if (command.type === 'select') this.selectedId = command.timelineId
    if (command.type === 'arm') this.armed = command.armed
    if (command.type === 'global') {
      const locked = new Set(command.lockedIds)
      for (const timelineItem of this.timelines) {
        if (locked.has(timelineItem.id)) continue
        if (command.mode === 'play') timelineItem.transport = 'play'
        if (command.mode === 'pause') timelineItem.transport = 'pause'
        if (command.mode === 'stop') {
          timelineItem.transport = 'stop'
          timelineItem.positionSeconds = 0
          timelineItem.currentCueId = timelineItem.cues[0]?.id || ''
          timelineItem.opacity = 1
        }
      }
      return this.snapshot()
    }
    const targetId =
      command.type === 'arm' || command.type === 'select' ? this.selectedId : command.timelineId
    const timelineItem = this.timelines.find((item) => item.id === targetId)
    if (!timelineItem) return this.snapshot()

    if (command.type === 'play') timelineItem.transport = 'play'
    if (command.type === 'pause') timelineItem.transport = 'pause'
    if (command.type === 'opacity') {
      timelineItem.opacity = Math.min(1, Math.max(0, command.value))
    }
    if (command.type === 'layer-opacity') {
      const layer = timelineItem.layers.find((item) => item.id === command.layerId)
      if (layer) layer.opacity = Math.min(1, Math.max(0, command.value))
    }
    if (command.type === 'layer-mute') {
      const layer = timelineItem.layers.find((item) => item.id === command.layerId)
      if (layer) layer.muted = command.muted
    }
    if (command.type === 'stop') {
      timelineItem.transport = 'stop'
      timelineItem.positionSeconds = 0
      timelineItem.currentCueId = timelineItem.cues[0]?.id || ''
      if (command.fadeSeconds && command.fadeSeconds > 0) timelineItem.opacity = 1
    }
    if (command.type === 'go') {
      const cue = timelineItem.cues.find((item) => item.id === command.cueId)
      if (cue) {
        timelineItem.positionSeconds = cue.timeSeconds
        timelineItem.currentCueId = cue.id
        timelineItem.transport = 'play'
      }
    }
    if (command.type === 'prev' || command.type === 'next') {
      const index = timelineItem.cues.findIndex((item) => item.id === timelineItem.currentCueId)
      const nextIndex =
        command.type === 'next'
          ? Math.min(timelineItem.cues.length - 1, index + 1)
          : Math.max(0, index - 1)
      const cue = timelineItem.cues[nextIndex]
      if (cue) {
        timelineItem.positionSeconds = cue.timeSeconds
        timelineItem.currentCueId = cue.id
      }
    }
    this.selectedId = timelineItem.id
    return this.snapshot()
  }

  private tick(): void {
    const now = Date.now()
    const dt = Math.min(0.25, (now - this.lastTick) / 1000)
    this.lastTick = now
    for (const timelineItem of this.timelines) {
      if (timelineItem.transport !== 'play') continue
      timelineItem.positionSeconds = Math.min(
        timelineItem.durationSeconds,
        timelineItem.positionSeconds + dt
      )
      const current = timelineItem.cues.reduce(
        (best, cue) => (cue.timeSeconds <= timelineItem.positionSeconds ? cue : best),
        timelineItem.cues[0]
      )
      if (current) timelineItem.currentCueId = current.id
      const upcoming = timelineItem.cues.find((cue) => cue.timeSeconds > timelineItem.positionSeconds)
      timelineItem.countdownSeconds = upcoming ? upcoming.timeSeconds - timelineItem.positionSeconds : null
      if (timelineItem.positionSeconds >= timelineItem.durationSeconds) {
        timelineItem.transport = 'pause'
      }
    }
  }
}
