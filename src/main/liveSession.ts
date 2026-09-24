import type { ControlCommand, ControlState, CueItem, LayerItem, TimelineItem, Transport } from '../shared/types'
import { EMPTY_CONTROL_STATE } from '../shared/types'
import { PixeraClient } from './pixeraClient'

const READ_GAP_MS = 20

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function transportOf(mode: number | null): Transport {
  if (mode === 1) return 'play'
  if (mode === 2) return 'pause'
  if (mode === 3) return 'stop'
  return 'unknown'
}

function transportMode(mode: 'play' | 'pause' | 'stop'): number {
  if (mode === 'play') return 1
  if (mode === 'pause') return 2
  return 3
}

function layerHandle(id: string): number | string {
  const asNum = Number(id)
  if (Number.isFinite(asNum) && String(asNum) === id) return asNum
  return id
}

export class LiveSession {
  private client = new PixeraClient()
  private readTail: Promise<unknown> = Promise.resolve()
  private writeTail: Promise<unknown> = Promise.resolve()
  private lastReadAt = 0
  private timelines: TimelineItem[] = []
  private handles = new Map<string, number | string>()
  private fpsByName = new Map<string, number>()
  private cuesLoadedAt = new Map<string, number>()
  private selectedId = ''
  private host = ''
  private port = 1400
  private projectName = ''
  private error: string | null = null
  private pollIndex = 0
  private pollTick = 0
  private lockedIds = new Set<string>()
  private busy = false
  private onChange: (() => void) | null = null

  setOnChange(handler: (() => void) | null): void {
    this.onChange = handler
  }

  setLockedIds(ids: string[]): void {
    this.lockedIds = new Set(ids)
  }

  private notify(): void {
    this.onChange?.()
  }

  async connect(host: string, port: number): Promise<ControlState> {
    this.host = host.trim()
    this.port = port
    this.projectName = ''
    this.error = null
    await this.client.connect(this.host, port)
    await this.refreshProjectName()
    await this.refreshNames(true)
    for (const timeline of this.timelines) await this.refreshOne(timeline.name)
    console.log(
      `[pixera] project ${this.projectName || '(unnamed)'} · timelines ${this.timelines.map((item) => item.name).join(', ') || '(none)'}`
    )
    return this.snapshot()
  }

  /** Reload timeline names + cues from Pixera (poll only updates transport/position). */
  async refresh(): Promise<ControlState> {
    if (!this.client.isConnected()) return this.snapshot()
    this.busy = true
    try {
      this.handles.clear()
      this.cuesLoadedAt.clear()
      await this.refreshProjectName()
      await this.refreshNames(true)
      const names = new Set(this.timelines.map((item) => item.name))
      for (const key of [...this.fpsByName.keys()]) {
        if (!names.has(key)) this.fpsByName.delete(key)
      }
      for (const timeline of this.timelines) await this.refreshOne(timeline.name)
      this.error = null
      console.log(
        `[pixera] refresh ${this.projectName || '(unnamed)'} · ${this.timelines.map((item) => item.name).join(', ') || '(none)'}`
      )
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      console.log(`[pixera] refresh failed: ${this.error}`)
    } finally {
      this.busy = false
      this.notify()
    }
    return this.snapshot()
  }

  async close(): Promise<void> {
    await this.client.close()
  }

  isConnected(): boolean {
    return this.client.isConnected()
  }

  snapshot(): ControlState {
    const endpoint = this.host ? `${this.host}:${this.port}` : ''
    return {
      ...EMPTY_CONTROL_STATE,
      status: this.client.isConnected() ? 'connected' : 'error',
      error: this.error,
      projectName: this.projectName || endpoint,
      selectedTimelineId: this.selectedId,
      timelines: this.timelines.map((item) => ({
        ...item,
        cues: item.cues.map((cue) => ({ ...cue })),
        layers: (item.layers || []).map((layer) => ({ ...layer }))
      })),
      updatedAt: Date.now()
    }
  }

  async poll(): Promise<ControlState> {
    if (!this.client.isConnected() || this.busy) return this.snapshot()
    if (!this.timelines.length) return this.snapshot()
    this.pollTick += 1

    const names = new Set<string>()
    const selected = this.timelines.find((item) => item.id === this.selectedId)
    if (selected) names.add(selected.name)

    for (const timeline of this.timelines) {
      if (timeline.transport === 'play') names.add(timeline.name)
    }

    const leftover = this.timelines.filter((item) => !names.has(item.name))
    const unlockedIdle = leftover.filter((item) => !this.lockedIds.has(item.id))
    const lockedIdle = leftover.filter((item) => this.lockedIds.has(item.id))

    if (unlockedIdle.length) {
      const timeline = unlockedIdle[this.pollIndex % unlockedIdle.length]
      this.pollIndex += 1
      names.add(timeline.name)
    } else if (lockedIdle.length && this.pollTick % 8 === 0) {
      const timeline = lockedIdle[Math.floor(this.pollTick / 8) % lockedIdle.length]
      names.add(timeline.name)
    }

    for (const name of names) await this.refreshOne(name)
    return this.snapshot()
  }

  async command(command: ControlCommand): Promise<ControlState> {
    if (command.type === 'select') {
      this.selectedId = command.timelineId
      return this.snapshot()
    }

    if (command.type === 'global') {
      const locked = new Set(command.lockedIds)
      const targets = this.timelines.filter((item) => !locked.has(item.id))
      if (!targets.length) return this.snapshot()
      if (command.mode === 'stop' && command.fadeSeconds && command.fadeSeconds > 0) {
        const jobs = targets.map((timeline) => ({
          timeline,
          restoreOpacity: timeline.opacity
        }))
        for (const job of jobs) job.timeline.opacity = 0
        void this.fireGlobalSoftStop(jobs, command.fadeSeconds)
        return this.snapshot()
      }
      for (const timeline of targets) {
        timeline.transport = command.mode
        if (command.mode === 'stop') {
          timeline.positionSeconds = 0
          timeline.countdownSeconds = timeline.cues[0] ? timeline.cues[0].timeSeconds : null
          this.markCurrentCue(timeline)
        }
      }
      void this.fireGlobalTransport(targets, command.mode)
      return this.snapshot()
    }

    const timeline = this.timelines.find((item) => item.id === ('timelineId' in command ? command.timelineId : ''))
    if (!timeline) return this.snapshot()
    this.selectedId = timeline.id

    if (command.type === 'play' || command.type === 'pause' || command.type === 'stop') {
      if (command.type === 'stop' && command.fadeSeconds && command.fadeSeconds > 0) {
        const restoreOpacity = timeline.opacity
        timeline.opacity = 0
        void this.fireSoftStop(timeline, command.fadeSeconds, restoreOpacity)
        return this.snapshot()
      }
      timeline.transport = command.type
      if (command.type === 'stop') {
        timeline.positionSeconds = 0
        timeline.countdownSeconds = timeline.cues[0] ? timeline.cues[0].timeSeconds : null
        this.markCurrentCue(timeline)
      }
      void this.fireTransport(timeline, command.type)
      return this.snapshot()
    }

    if (command.type === 'go') {
      const cue = timeline.cues.find((item) => item.id === command.cueId)
      if (cue) {
        timeline.currentCueId = cue.id
        timeline.positionSeconds = cue.timeSeconds
        timeline.transport = 'play'
        const upcoming = timeline.cues.find((item) => item.timeSeconds > cue.timeSeconds)
        timeline.countdownSeconds = upcoming ? upcoming.timeSeconds - cue.timeSeconds : null
        void this.fireGo(timeline, cue)
      }
      return this.snapshot()
    }

    if (command.type === 'opacity') {
      timeline.opacity = Math.min(1, Math.max(0, command.value))
      void this.fireOpacity(timeline, timeline.opacity)
      return this.snapshot()
    }

    if (command.type === 'layer-opacity') {
      const layer = timeline.layers.find((item) => item.id === command.layerId)
      if (layer) {
        layer.opacity = Math.min(1, Math.max(0, command.value))
        void this.fireLayerOpacity(layer)
      }
      return this.snapshot()
    }

    if (command.type === 'layer-mute') {
      const layer = timeline.layers.find((item) => item.id === command.layerId)
      if (layer) {
        layer.muted = command.muted
        void this.fireLayerMute(layer)
      }
      return this.snapshot()
    }

    return this.snapshot()
  }

  private async fireOpacity(timeline: TimelineItem, value: number): Promise<void> {
    this.busy = true
    try {
      const handle = await this.handleFor(timeline.name)
      await this.write('Pixera.Timelines.Timeline.setOpacity', { handle, value })
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      console.log(`[pixera] opacity failed: ${this.error}`)
    } finally {
      this.busy = false
      this.notify()
    }
  }

  private async fireLayerOpacity(layer: LayerItem): Promise<void> {
    this.busy = true
    try {
      await this.write('Pixera.Timelines.Layer.setOpacity', {
        handle: layerHandle(layer.id),
        value: layer.opacity
      })
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      console.log(`[pixera] layer opacity failed: ${this.error}`)
    } finally {
      this.busy = false
      this.notify()
    }
  }

  private async fireLayerMute(layer: LayerItem): Promise<void> {
    this.busy = true
    try {
      const handle = layerHandle(layer.id)
      await this.write(
        layer.muted ? 'Pixera.Timelines.Layer.muteLayer' : 'Pixera.Timelines.Layer.unMuteLayer',
        { handle }
      )
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      console.log(`[pixera] layer mute failed: ${this.error}`)
    } finally {
      this.busy = false
      this.notify()
    }
  }

  private async fireGlobalTransport(
    timelines: TimelineItem[],
    mode: 'play' | 'pause' | 'stop'
  ): Promise<void> {
    this.busy = true
    try {
      for (const timeline of timelines) {
        const handle = await this.handleFor(timeline.name)
        await this.write('Pixera.Timelines.Timeline.setTransportMode', {
          handle,
          mode: transportMode(mode)
        })
      }
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      console.log(`[pixera] global transport failed: ${this.error}`)
    } finally {
      this.busy = false
      this.notify()
    }
  }

  private async fireGlobalSoftStop(
    jobs: { timeline: TimelineItem; restoreOpacity: number }[],
    fadeSeconds: number
  ): Promise<void> {
    this.busy = true
    try {
      const prepared: { timeline: TimelineItem; handle: number | string; restoreOpacity: number; frames: number }[] =
        []
      for (const job of jobs) {
        const handle = await this.handleFor(job.timeline.name)
        const fps = await this.fpsFor(job.timeline.name)
        prepared.push({
          timeline: job.timeline,
          handle,
          restoreOpacity: job.restoreOpacity,
          frames: Math.max(1, Math.round(fadeSeconds * fps))
        })
      }
      console.log(`[pixera] global soft stop ${prepared.length} timelines fade ${fadeSeconds}s`)
      for (const item of prepared) {
        await this.write('Pixera.Timelines.Timeline.startOpacityAnimation', {
          handle: item.handle,
          fadeIn: false,
          fullFadeDuration: item.frames
        })
      }
      await new Promise((resolve) => setTimeout(resolve, Math.round(fadeSeconds * 1000)))
      for (const item of prepared) {
        await this.write('Pixera.Timelines.Timeline.setTransportMode', {
          handle: item.handle,
          mode: transportMode('stop')
        })
        await this.write('Pixera.Timelines.Timeline.setOpacity', {
          handle: item.handle,
          value: item.restoreOpacity
        })
        item.timeline.transport = 'stop'
        item.timeline.positionSeconds = 0
        item.timeline.countdownSeconds = item.timeline.cues[0] ? item.timeline.cues[0].timeSeconds : null
        item.timeline.opacity = item.restoreOpacity
        this.markCurrentCue(item.timeline)
      }
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      console.log(`[pixera] global soft stop failed: ${this.error}`)
    } finally {
      this.busy = false
      this.notify()
    }
  }

  private async fireSoftStop(
    timeline: TimelineItem,
    fadeSeconds: number,
    restoreOpacity: number
  ): Promise<void> {
    this.busy = true
    try {
      const handle = await this.handleFor(timeline.name)
      const fps = await this.fpsFor(timeline.name)
      const frames = Math.max(1, Math.round(fadeSeconds * fps))
      console.log(`[pixera] soft stop ${timeline.name} fade ${fadeSeconds}s (${frames}f)`)
      await this.write('Pixera.Timelines.Timeline.startOpacityAnimation', {
        handle,
        fadeIn: false,
        fullFadeDuration: frames
      })
      await new Promise((resolve) => setTimeout(resolve, Math.round(fadeSeconds * 1000)))
      await this.write('Pixera.Timelines.Timeline.setTransportMode', {
        handle,
        mode: transportMode('stop')
      })
      await this.write('Pixera.Timelines.Timeline.setOpacity', {
        handle,
        value: restoreOpacity
      })
      timeline.transport = 'stop'
      timeline.positionSeconds = 0
      timeline.countdownSeconds = timeline.cues[0] ? timeline.cues[0].timeSeconds : null
      timeline.opacity = restoreOpacity
      this.markCurrentCue(timeline)
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      console.log(`[pixera] soft stop failed: ${this.error}`)
    } finally {
      this.busy = false
      this.notify()
    }
  }

  private async fireTransport(timeline: TimelineItem, mode: 'play' | 'pause' | 'stop'): Promise<void> {
    this.busy = true
    try {
      const handle = await this.handleFor(timeline.name)
      await this.write('Pixera.Timelines.Timeline.setTransportMode', {
        handle,
        mode: transportMode(mode)
      })
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      console.log(`[pixera] transport failed: ${this.error}`)
    } finally {
      this.busy = false
      this.notify()
    }
  }

  private async fireGo(timeline: TimelineItem, cue: CueItem): Promise<void> {
    this.busy = true
    try {
      const cueHandle = Number(cue.id)
      if (Number.isFinite(cueHandle) && cueHandle > 0) {
        await this.write('Pixera.Timelines.Cue.apply', { handle: cueHandle })
      } else if (cue.name) {
        await this.write('Pixera.Compound.applyCueOnTimeline', {
          timelineName: timeline.name,
          cueName: cue.name
        })
      } else {
        throw new Error(`No apply path for cue on ${timeline.name}`)
      }
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      console.log(`[pixera] go failed: ${this.error}`)
    } finally {
      this.busy = false
      this.notify()
    }
  }

  private async refreshProjectName(): Promise<void> {
    const name = asString(await this.read('Pixera.Session.getProjectName'))
    this.projectName = name
  }

  private async refreshNames(force = false): Promise<void> {
    const names = await this.read<unknown>('Pixera.Timelines.getTimelineNames')
    const list = Array.isArray(names) ? names.map((name) => asString(name)).filter(Boolean) : []
    const previous = new Map(this.timelines.map((item) => [item.name, item]))
    this.timelines = list.map((name) => {
      const kept = previous.get(name)
      return (
        kept || {
          id: name,
          name,
          transport: 'unknown' as Transport,
          positionSeconds: 0,
          durationSeconds: 0,
          countdownSeconds: null,
          opacity: 1,
          currentCueId: '',
          cues: [] as CueItem[],
          layers: [] as LayerItem[]
        }
      )
    })
    if (!this.timelines.some((item) => item.id === this.selectedId)) {
      this.selectedId = this.timelines[0]?.id || ''
    }
    for (const timeline of this.timelines) {
      if (!timeline.layers) timeline.layers = []
      if (!force) {
        const loaded = this.cuesLoadedAt.get(timeline.name) || 0
        if (timeline.cues.length && Date.now() - loaded < 30000) continue
      }
      await this.loadCues(timeline)
      await this.loadLayers(timeline)
    }
  }

  private async loadCues(timeline: TimelineItem): Promise<void> {
    const handle = await this.handleFor(timeline.name)
    const fps = await this.fpsFor(timeline.name)
    const raw = await this.read<unknown>('Pixera.Timelines.Timeline.getCues', { handle })
    const cueHandles = Array.isArray(raw) ? raw.filter((item) => typeof item === 'number' && item > 0) : []
    const cues: CueItem[] = []
    for (let index = 0; index < cueHandles.length; index += 1) {
      const cueHandle = cueHandles[index] as number
      const name = asString(await this.read('Pixera.Timelines.Cue.getName', { handle: cueHandle }))
      const frames = asNumber(await this.read('Pixera.Timelines.Cue.getTime', { handle: cueHandle }))
      cues.push({
        id: String(cueHandle),
        name,
        timeSeconds: frames == null ? 0 : frames / fps
      })
    }
    cues.sort((a, b) => a.timeSeconds - b.timeSeconds)
    timeline.cues = cues
    timeline.durationSeconds = cues.length ? cues[cues.length - 1].timeSeconds : 0
    this.cuesLoadedAt.set(timeline.name, Date.now())
    console.log(`[pixera] ${timeline.name} cues ${cues.length}`)
    this.markCurrentCue(timeline)
  }

  private async loadLayers(timeline: TimelineItem): Promise<void> {
    const handle = await this.handleFor(timeline.name)
    const layers: LayerItem[] = []
    const raw = await this.read<unknown>('Pixera.Timelines.Timeline.getLayers', { handle })
    let layerHandles: Array<number | string> = []
    if (Array.isArray(raw) && raw.length) {
      layerHandles = raw.filter(
        (item) => (typeof item === 'number' && item > 0) || (typeof item === 'string' && item.trim())
      ) as Array<number | string>
    } else {
      const names = await this.read<unknown>('Pixera.Timelines.Timeline.getLayerNames', { handle })
      if (Array.isArray(names)) {
        for (const name of names.map((item) => asString(item)).filter(Boolean)) {
          layerHandles.push(`${timeline.name}.${name}`)
        }
      }
    }
    for (let index = 0; index < layerHandles.length; index += 1) {
      const layerHandleValue = layerHandles[index]
      const name =
        asString(await this.read('Pixera.Timelines.Layer.getName', { handle: layerHandleValue })) ||
        (typeof layerHandleValue === 'string' && layerHandleValue.includes('.')
          ? layerHandleValue.slice(layerHandleValue.indexOf('.') + 1)
          : `Layer ${index + 1}`)
      const opacity = asNumber(
        await this.read('Pixera.Timelines.Layer.getOpacity', { handle: layerHandleValue })
      )
      const muted = await this.read<unknown>('Pixera.Timelines.Layer.getIsLayerMuted', {
        handle: layerHandleValue
      })
      layers.push({
        id: String(layerHandleValue),
        name,
        opacity: opacity == null ? 1 : Math.min(1, Math.max(0, opacity)),
        muted: muted === true
      })
    }
    timeline.layers = layers
    console.log(`[pixera] ${timeline.name} layers ${layers.map((item) => item.name).join(', ') || '(none)'}`)
  }

  private async fpsFor(name: string): Promise<number> {
    const cached = this.fpsByName.get(name)
    if (cached) return cached
    const fps = asNumber(await this.read('Pixera.Compound.getFpsOfTimeline', { name }))
    const next = fps && fps > 0 ? fps : 60
    this.fpsByName.set(name, next)
    return next
  }

  private markCurrentCue(timeline: TimelineItem): void {
    const current = timeline.cues.reduce<CueItem | undefined>((best, cue) => {
      if (cue.timeSeconds <= timeline.positionSeconds + 0.05) return cue
      return best
    }, undefined)
    timeline.currentCueId = current?.id || timeline.cues[0]?.id || ''
  }

  private async refreshOne(name: string): Promise<void> {
    const timeline = this.timelines.find((item) => item.name === name)
    if (!timeline) return
    const mode = asNumber(
      await this.read('Pixera.Compound.getTransportModeOnTimeline', { timelineName: name })
    )
    const position = asNumber(
      await this.read('Pixera.Compound.getCurrentTimeOfTimelineInSeconds', { name })
    )
    const frames = asNumber(
      await this.read('Pixera.Compound.getCurrentCountdownOfTimeline', { name })
    )
    const opacity = asNumber(await this.read('Pixera.Timelines.Timeline.getOpacity', { handle: await this.handleFor(name) }))
    const fps = this.fpsByName.get(name) || (await this.fpsFor(name))
    if (mode != null) timeline.transport = transportOf(mode)
    if (position != null) timeline.positionSeconds = Math.max(0, position)
    timeline.countdownSeconds = frames == null ? null : Math.max(0, frames / fps)
    if (opacity != null) timeline.opacity = Math.min(1, Math.max(0, opacity))
    this.markCurrentCue(timeline)
  }

  private async handleFor(name: string): Promise<number | string> {
    const cached = this.handles.get(name)
    if (cached != null) return cached
    const handle = await this.read<unknown>('Pixera.Timelines.getTimelineFromName', { name })
    if (typeof handle === 'number' && Number.isFinite(handle)) {
      this.handles.set(name, handle)
      return handle
    }
    if (typeof handle === 'string' && handle.trim()) {
      this.handles.set(name, handle.trim())
      return handle.trim()
    }
    throw new Error(`Pixera did not return a handle for ${name}`)
  }

  private read<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T | null> {
    return this.enqueueRead(() => this.client.call<T>(method, params, 2000)).then(
      (value) => value,
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        if (message !== 'Pixera returned an API exception') {
          console.log(`[pixera] ${method} failed: ${message}`)
        }
        return null
      }
    )
  }

  private write(method: string, params?: Record<string, unknown>): Promise<unknown> {
    console.log(`[pixera] ${method}`)
    return this.enqueueWrite(() => this.client.call(method, params, 1500))
  }

  private enqueueRead<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.readTail.then(async () => {
      await this.writeTail.catch(() => undefined)
      const wait = READ_GAP_MS - (Date.now() - this.lastReadAt)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      this.lastReadAt = Date.now()
      return fn()
    })
    this.readTail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeTail.then(() => fn())
    this.writeTail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}
