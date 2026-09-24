import { useEffect, useState } from 'react'
import {
  EMPTY_CONTROL_STATE,
  MODE_LABELS,
  SITE_URL,
  cloneSettings,
  type AppSettings,
  type ControlCommand,
  type ControlState,
  type ConnectionMode,
  type LayerItem,
  type TimelineItem,
  type Transport,
  type ViewMode
} from '@shared/types'
import { APP_VERSION } from '@shared/version'
import { DemoShow } from '@shared/demoShow'
import type { ControlApi } from '../../preload/index'

function createLocalControl(): ControlApi {
  const engine = new DemoShow()
  let settings = cloneSettings()
  let live = engine.snapshot()
  const stateListeners = new Set<(state: ControlState) => void>()
  const settingsListeners = new Set<(settings: AppSettings) => void>()
  const timer = window.setInterval(() => {
    live = engine.snapshot()
    for (const listener of stateListeners) listener(live)
  }, 200)
  void timer
  return {
    getSettings: async () => settings,
    getState: async () => live,
    getAppVersion: async () => APP_VERSION,
    saveSettings: async (next) => {
      settings = next
      for (const listener of settingsListeners) listener(settings)
      return settings
    },
    connect: async () => live,
    disconnect: async () => live,
    refresh: async () => {
      live = engine.snapshot()
      for (const listener of stateListeners) listener(live)
      return live
    },
    command: async (command) => {
      live = engine.command(command)
      for (const listener of stateListeners) listener(live)
      return live
    },
    setFullscreen: async (value) => {
      if (value) await document.documentElement.requestFullscreen?.()
      else if (document.fullscreenElement) await document.exitFullscreen()
      return !!document.fullscreenElement
    },
    openUrl: async (url) => {
      window.open(url, '_blank', 'noopener,noreferrer')
      return true
    },
    onState: (handler) => {
      stateListeners.add(handler)
      return () => stateListeners.delete(handler)
    },
    onSettings: (handler) => {
      settingsListeners.add(handler)
      return () => settingsListeners.delete(handler)
    }
  }
}

const control = window.control ?? createLocalControl()

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function orderTimelines(timelines: TimelineItem[], order: string[]): TimelineItem[] {
  const byId = new Map(timelines.map((item) => [item.id, item]))
  const seen = new Set<string>()
  const ordered: TimelineItem[] = []
  for (const id of order) {
    const item = byId.get(id)
    if (item) {
      ordered.push(item)
      seen.add(id)
    }
  }
  for (const item of timelines) {
    if (!seen.has(item.id)) ordered.push(item)
  }
  return ordered
}

function LockMark({ locked }: { locked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="lock-icon">
      {locked ? (
        <>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 7.5-1.8" fill="none" stroke="currentColor" strokeWidth="2" />
        </>
      )}
    </svg>
  )
}

function TransportMark({ mode }: { mode: Transport }) {
  return (
    <span className={`tmark tmark-${mode}`} title={mode} aria-label={mode}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        {mode === 'play' ? <polygon points="18,13 18,35 36,24" /> : null}
        {mode === 'pause' ? (
          <>
            <rect x="15" y="13" width="6.5" height="22" rx="1.6" />
            <rect x="26.5" y="13" width="6.5" height="22" rx="1.6" />
          </>
        ) : null}
        {mode === 'stop' ? <rect x="15" y="15" width="18" height="18" rx="3" /> : null}
        {mode === 'unknown' ? <circle cx="24" cy="24" r="5.5" /> : null}
      </svg>
    </span>
  )
}

function BrandLink({ src, alt, className }: { src: string; alt: string; className: string }) {
  return (
    <a
      className={className}
      href={SITE_URL}
      title="desertdog.nl"
      onClick={(event) => {
        event.preventDefault()
        void control.openUrl(SITE_URL)
      }}
    >
      <img src={src} alt={alt} />
    </a>
  )
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => cloneSettings())
  const [draft, setDraft] = useState<AppSettings>(() => cloneSettings())
  const [live, setLive] = useState<ControlState>(EMPTY_CONTROL_STATE)
  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [appVersion, setAppVersion] = useState(APP_VERSION)
  const [selectedCueId, setSelectedCueId] = useState('')
  const [globalStopArmed, setGlobalStopArmed] = useState(false)
  const [globalOpen, setGlobalOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dragPadId, setDragPadId] = useState<string | null>(null)
  const [armedByTimeline, setArmedByTimeline] = useState<Record<string, string>>({})
  const [directorEdit, setDirectorEdit] = useState(false)

  useEffect(() => {
    const offState = control.onState(setLive)
    const offSettings = control.onSettings((value) => {
      setSettings(value)
      setDraft(value)
    })
    void (async () => {
      const [nextSettings, nextState, version] = await Promise.all([
        control.getSettings(),
        control.getState(),
        control.getAppVersion()
      ])
      setSettings(nextSettings)
      setDraft(nextSettings)
      setLive(nextState)
      setAppVersion(version)
      if (nextSettings.mode === 'demo' && nextState.status !== 'connected') {
        setLive(await control.connect())
      }
    })()
    return () => {
      offState()
      offSettings()
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = draft.appearance
    document.documentElement.style.colorScheme = draft.appearance
  }, [draft.appearance])

  const selected = live.timelines.find((item) => item.id === live.selectedTimelineId) || live.timelines[0]
  const orderedTimelines = orderTimelines(live.timelines, settings.timelinePadOrder)
  const hiddenDirectorIds = new Set(settings.directorHiddenTimelineIds || [])
  const visibleDirectorTimelines = orderedTimelines.filter((item) => !hiddenDirectorIds.has(item.id))
  const hiddenDirectorTimelines = orderedTimelines.filter((item) => hiddenDirectorIds.has(item.id))
  const currentCue = selected?.cues.find((cue) => cue.id === selected.currentCueId)
  const selectedCue =
    selected?.cues.find((cue) => cue.id === selectedCueId) ||
    currentCue ||
    selected?.cues[0]
  const selectedIndex = selected && selectedCue ? selected.cues.findIndex((cue) => cue.id === selectedCue.id) : -1
  const nextCue = selected && selectedIndex >= 0 ? selected.cues[selectedIndex + 1] : undefined
  const prevCue = selected && selectedIndex > 0 ? selected.cues[selectedIndex - 1] : undefined
  const goLabel = selectedCue?.name?.trim() ? `GO · ${selectedCue.name.trim()}` : 'GO'
  const viewMode: ViewMode = settings.viewMode === 'director' ? 'director' : 'list'

  useEffect(() => {
    if (!selected) {
      setSelectedCueId('')
      return
    }
    const stillThere = selected.cues.some((cue) => cue.id === selectedCueId)
    if (!stillThere) setSelectedCueId(selected.currentCueId || selected.cues[0]?.id || '')
  }, [selected, selectedCueId])

  useEffect(() => {
    if (!globalStopArmed) return
    const timer = window.setTimeout(() => setGlobalStopArmed(false), 3000)
    return () => window.clearTimeout(timer)
  }, [globalStopArmed])

  async function persist(next: AppSettings) {
    const saved = await control.saveSettings(next)
    setSettings(saved)
    setDraft(saved)
  }

  async function send(command: ControlCommand) {
    if (
      (command.type === 'play' || command.type === 'pause' || command.type === 'stop') &&
      settings.lockedTimelineIds.includes(command.timelineId)
    ) {
      return
    }
    setLive(await control.command(command))
  }

  async function globalTransport(mode: 'play' | 'pause' | 'stop') {
    if (mode === 'stop') {
      if (settings.confirmStop && !globalStopArmed) {
        setGlobalStopArmed(true)
        return
      }
      setGlobalStopArmed(false)
    } else {
      setGlobalStopArmed(false)
    }
    setLive(
      await control.command({
        type: 'global',
        mode,
        lockedIds: settings.lockedTimelineIds
      })
    )
  }

  async function toggleLock(timelineId: string) {
    const locked = settings.lockedTimelineIds.includes(timelineId)
    const lockedTimelineIds = locked
      ? settings.lockedTimelineIds.filter((id) => id !== timelineId)
      : [...settings.lockedTimelineIds, timelineId]
    await persist({ ...settings, lockedTimelineIds })
  }

  async function refreshShow() {
    if (refreshing || live.status !== 'connected') return
    setRefreshing(true)
    try {
      setLive(await control.refresh())
    } finally {
      setRefreshing(false)
    }
  }

  async function setViewMode(next: ViewMode) {
    await persist({ ...settings, viewMode: next })
  }

  async function reorderPads(fromId: string, toId: string) {
    if (fromId === toId) return
    const ids = orderedTimelines.map((item) => item.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, fromId)
    await persist({ ...settings, timelinePadOrder: next })
  }

  async function hideDirectorPad(timelineId: string) {
    if (settings.directorHiddenTimelineIds.includes(timelineId)) return
    await persist({
      ...settings,
      directorHiddenTimelineIds: [...settings.directorHiddenTimelineIds, timelineId]
    })
  }

  async function showDirectorPad(timelineId: string) {
    await persist({
      ...settings,
      directorHiddenTimelineIds: settings.directorHiddenTimelineIds.filter((id) => id !== timelineId)
    })
  }

  function armedCueFor(timeline: TimelineItem) {
    const armedId = armedByTimeline[timeline.id]
    return (
      timeline.cues.find((cue) => cue.id === armedId) ||
      timeline.cues.find((cue) => cue.id === timeline.currentCueId) ||
      timeline.cues[0]
    )
  }

  function setArmedFor(timelineId: string, cueId: string) {
    setArmedByTimeline((current) => ({ ...current, [timelineId]: cueId }))
  }

  return (
    <div className={`app ${viewMode === 'director' ? 'is-director' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <BrandLink className="brand-mark" src="./icon.png" alt="Desert Dog" />
          <div>
            <h1>Pixera Control</h1>
            <p>v{appVersion}</p>
          </div>
        </div>
        <div className="status-cluster">
          <span className={`pill safe-live ${live.status === 'connected' ? 'safe' : 'off'}`}>
            {live.status === 'connected' && settings.mode === 'demo'
              ? 'DEMO · SAFE'
              : live.status === 'connected'
                ? 'LIVE'
                : 'OFFLINE'}
          </span>
          <span className="pill">
            <span className={`dot ${live.status}`} />
            {live.status === 'connected'
              ? 'Connected'
              : live.status === 'connecting'
                ? 'Connecting'
                : live.status === 'error'
                  ? 'Error'
                  : 'Disconnected'}
          </span>
          {settings.mode !== 'demo' ? (
            <span
              className="pill endpoint"
              title={
                live.projectName && live.projectName !== `${settings.host}:${settings.port}`
                  ? `${settings.host}:${settings.port}`
                  : 'Pixera JSON/TCP'
              }
            >
              {live.status === 'connected' && live.projectName
                ? live.projectName
                : `${settings.host}:${settings.port}`}
            </span>
          ) : live.status === 'connected' && live.projectName ? (
            <span className="pill endpoint" title="Demo">
              {live.projectName}
            </span>
          ) : null}
        </div>
        <div className="toolbar">
          {live.status === 'connected' ? (
            <>
              <div className="view-toggle" role="group" aria-label="View">
                <button
                  className={`ghost pressable ${viewMode === 'list' ? 'is-active-view' : ''}`}
                  onClick={() => void setViewMode('list')}
                >
                  List
                </button>
                <button
                  className={`ghost pressable ${viewMode === 'director' ? 'is-active-view' : ''}`}
                  onClick={() => void setViewMode('director')}
                >
                  Director
                </button>
              </div>
              <button
                className="ghost pressable"
                disabled={refreshing}
                title="Reload timelines and cues from Pixera"
                onClick={() => void refreshShow()}
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </>
          ) : null}
          <button
            className="ghost"
            onClick={async () => {
              const next = !fullscreen
              await control.setFullscreen(next)
              setFullscreen(next)
            }}
          >
            {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
          <button className="ghost" onClick={() => setOpen(true)}>
            Settings
          </button>
        </div>
      </header>

      {live.error ? <div className="error-banner">{live.error}</div> : null}

      <main className={`board ${viewMode === 'director' ? 'board-director' : ''}`}>
        {live.status !== 'connected' ? (
          <div className="empty">
            <p className="kicker">Control</p>
            <h2>
              {live.status === 'connecting'
                ? `Connecting to ${settings.host}:${settings.port}`
                : settings.mode === 'demo'
                  ? 'Connect in Demo to load timelines and cues'
                  : 'Save and connect to load timelines'}
            </h2>
            <p>
              {settings.mode === 'demo'
                ? 'Demo fills a show on this computer and never opens a socket.'
                : 'JSON/TCP uses the IP and port in Settings. The same port Pixera Dashboard uses.'}
            </p>
          </div>
        ) : viewMode === 'director' ? (
          <section className="director-grid">
            <header className="director-head">
              <div>
                <h2>Director</h2>
                <p className="help">
                  {directorEdit
                    ? 'Hide pads you do not need. Show hidden ones below.'
                    : 'Drag pads to reorder. Each pad has its own GO.'}
                </p>
              </div>
              <div className="director-head-actions">
                <button
                  className={`ghost pressable ${directorEdit ? 'is-active-view' : ''}`}
                  aria-pressed={directorEdit}
                  onClick={() => setDirectorEdit((open) => !open)}
                >
                  {directorEdit ? 'Done' : 'Edit'}
                </button>
                <button
                  className={`ghost pressable global-toggle ${globalOpen ? 'is-open' : ''}`}
                  aria-expanded={globalOpen}
                  onClick={() => {
                    setGlobalOpen((open) => !open)
                    setGlobalStopArmed(false)
                  }}
                >
                  {globalOpen ? 'Hide controls' : 'Control all'}
                </button>
              </div>
            </header>
            {globalOpen ? (
              <div className="global-bar director-global">
                <p className="global-warn">Applies to unlocked timelines only.</p>
                <div className="cue-actions">
                  <button className="ghost pressable" onClick={() => void globalTransport('play')}>
                    Play all
                  </button>
                  <button className="ghost pressable" onClick={() => void globalTransport('pause')}>
                    Pause all
                  </button>
                  <button
                    className={`ghost pressable ${globalStopArmed ? 'is-confirm-stop' : ''}`}
                    onClick={() => void globalTransport('stop')}
                  >
                    {globalStopArmed ? 'Sure?' : 'Stop all'}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="director-pads">
              {visibleDirectorTimelines.map((timeline) => {
                const armed = armedCueFor(timeline)
                const armedIndex = armed ? timeline.cues.findIndex((cue) => cue.id === armed.id) : -1
                const padPrev = armedIndex > 0 ? timeline.cues[armedIndex - 1] : undefined
                const padNext =
                  armedIndex >= 0 && armedIndex < timeline.cues.length - 1
                    ? timeline.cues[armedIndex + 1]
                    : undefined
                return (
                  <DirectorPad
                    key={timeline.id}
                    timeline={timeline}
                    locked={settings.lockedTimelineIds.includes(timeline.id)}
                    confirmStop={settings.confirmStop}
                    armed={armed}
                    editing={directorEdit}
                    dragging={dragPadId === timeline.id}
                    onDragStart={() => setDragPadId(timeline.id)}
                    onDragEnd={() => setDragPadId(null)}
                    onDropPad={() => {
                      if (dragPadId) void reorderPads(dragPadId, timeline.id)
                      setDragPadId(null)
                    }}
                    onToggleLock={() => void toggleLock(timeline.id)}
                    onHide={() => void hideDirectorPad(timeline.id)}
                    onCommand={(type) => void send({ type, timelineId: timeline.id })}
                    onPrev={() => padPrev && setArmedFor(timeline.id, padPrev.id)}
                    onNext={() => padNext && setArmedFor(timeline.id, padNext.id)}
                    onGo={() =>
                      armed && void send({ type: 'go', timelineId: timeline.id, cueId: armed.id })
                    }
                    canPrev={!!padPrev}
                    canNext={!!padNext}
                  />
                )
              })}
            </div>
            {directorEdit && hiddenDirectorTimelines.length ? (
              <div className="director-hidden">
                <h3>Hidden</h3>
                <div className="director-hidden-list">
                  {hiddenDirectorTimelines.map((timeline) => (
                    <div key={timeline.id} className="director-hidden-row">
                      <span>{timeline.name}</span>
                      <button
                        type="button"
                        className="ghost pressable"
                        onClick={() => void showDirectorPad(timeline.id)}
                      >
                        Show
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {directorEdit && !visibleDirectorTimelines.length && !hiddenDirectorTimelines.length ? (
              <p className="help">No timelines connected.</p>
            ) : null}
            {!directorEdit && !visibleDirectorTimelines.length ? (
              <p className="help">All timelines are hidden. Tap Edit to show them again.</p>
            ) : null}
          </section>
        ) : (
          <>
            <section className="pane">
              <header className="pane-head">
                <div>
                  <h2>Timelines</h2>
                </div>
                <button
                  className={`ghost pressable global-toggle ${globalOpen ? 'is-open' : ''}`}
                  aria-expanded={globalOpen}
                  onClick={() => {
                    setGlobalOpen((open) => !open)
                    setGlobalStopArmed(false)
                  }}
                >
                  {globalOpen ? 'Hide controls' : 'Control all'}
                </button>
              </header>
              {globalOpen ? (
                <div className="global-bar">
                  <p className="global-warn">Applies to unlocked timelines only.</p>
                  <div className="cue-actions">
                    <button className="ghost pressable" onClick={() => void globalTransport('play')}>
                      Play all
                    </button>
                    <button className="ghost pressable" onClick={() => void globalTransport('pause')}>
                      Pause all
                    </button>
                    <button
                      className={`ghost pressable ${globalStopArmed ? 'is-confirm-stop' : ''}`}
                      onClick={() => void globalTransport('stop')}
                    >
                      {globalStopArmed ? 'Sure?' : 'Stop all'}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="pane-scroll">
                {live.timelines.map((timeline) => (
                  <TimelineRow
                    key={timeline.id}
                    timeline={timeline}
                    selected={timeline.id === selected?.id}
                    locked={settings.lockedTimelineIds.includes(timeline.id)}
                    confirmStop={settings.confirmStop}
                    onSelect={() => void send({ type: 'select', timelineId: timeline.id })}
                    onToggleLock={() => void toggleLock(timeline.id)}
                    onCommand={(type) => void send({ type, timelineId: timeline.id })}
                    onOpacity={(value) => void send({ type: 'opacity', timelineId: timeline.id, value })}
                    onLayerOpacity={(layerId, value) =>
                      void send({ type: 'layer-opacity', timelineId: timeline.id, layerId, value })
                    }
                    onLayerMute={(layerId, muted) =>
                      void send({ type: 'layer-mute', timelineId: timeline.id, layerId, muted })
                    }
                  />
                ))}
              </div>
            </section>
            <section className="pane">
              <header className="pane-head">
                <div>
                  <p className="kicker">Cues</p>
                  <h2>{selected?.name || 'No timeline'}</h2>
                </div>
                <div className="cue-actions">
                  <button
                    className="ghost pressable"
                    disabled={!selected || !prevCue}
                    onClick={() => prevCue && setSelectedCueId(prevCue.id)}
                  >
                    Previous
                  </button>
                  <button
                    className="ghost pressable"
                    disabled={!selected || !nextCue}
                    onClick={() => nextCue && setSelectedCueId(nextCue.id)}
                  >
                    Next
                  </button>
                  <button
                    className="go pressable"
                    disabled={!selected || !selectedCue}
                    title={selectedCue?.name?.trim() || undefined}
                    onClick={() =>
                      selected &&
                      selectedCue &&
                      void send({ type: 'go', timelineId: selected.id, cueId: selectedCue.id })
                    }
                  >
                    {goLabel}
                  </button>
                </div>
              </header>
              <div className="pane-scroll">
                {selected?.cues.map((cue, index) => {
                  const playing = cue.id === selected.currentCueId
                  const armed = cue.id === selectedCue?.id
                  return (
                    <button
                      key={cue.id}
                      className={`cue-row pressable ${playing ? 'is-current' : ''} ${armed ? 'is-selected' : ''}`}
                      onClick={() => setSelectedCueId(cue.id)}
                    >
                      <span className="cue-time">{formatClock(cue.timeSeconds)}</span>
                      <span className="cue-name">{cue.name || `Cue ${index + 1}`}</span>
                      {playing ? (
                        <span className="cue-now">Now</span>
                      ) : armed ? (
                        <span className="cue-armed">Armed</span>
                      ) : (
                        <span className="cue-go">Select</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </main>

      <BrandLink className="corner-logo" src="./logo_full_white.png" alt="Desert Dog" />

      {open ? (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-scroll">
              <h2>Settings</h2>
              <p className="help">
                Demo stays on this computer. JSON/TCP connects to the Pixera API port, usually 1400.
              </p>
              <div className="field">
                <label htmlFor="mode">Mode</label>
                <select
                  id="mode"
                  value={draft.mode}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, mode: event.target.value as ConnectionMode }))
                  }
                >
                  <option value="demo">{MODE_LABELS.demo}</option>
                  <option value="json-tcp-auto">{MODE_LABELS['json-tcp-auto']}</option>
                </select>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="host">IP address</label>
                  <input
                    id="host"
                    value={draft.host}
                    disabled={draft.mode === 'demo'}
                    onChange={(event) => setDraft((current) => ({ ...current, host: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="port">Port</label>
                  <input
                    id="port"
                    type="number"
                    value={draft.port}
                    disabled={draft.mode === 'demo'}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, port: Number(event.target.value) }))
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label>Appearance</label>
                <div className="theme-toggle">
                  <button
                    className={draft.appearance === 'dark' ? 'primary' : 'ghost'}
                    onClick={() => setDraft((current) => ({ ...current, appearance: 'dark' }))}
                  >
                    Dark
                  </button>
                  <button
                    className={draft.appearance === 'light' ? 'primary' : 'ghost'}
                    onClick={() => setDraft((current) => ({ ...current, appearance: 'light' }))}
                  >
                    Light
                  </button>
                </div>
              </div>
              <div className="check">
                <label htmlFor="confirm-stop">Confirm Stop (press twice)</label>
                <input
                  id="confirm-stop"
                  type="checkbox"
                  checked={draft.confirmStop !== false}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, confirmStop: event.target.checked }))
                  }
                />
              </div>
              <div className="check">
                <label htmlFor="fade-stop">Fade on Stop</label>
                <input
                  id="fade-stop"
                  type="checkbox"
                  checked={draft.fadeOnStop !== false}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, fadeOnStop: event.target.checked }))
                  }
                />
              </div>
              {draft.fadeOnStop !== false ? (
                <div className="field">
                  <label htmlFor="fade-seconds">Fade duration (seconds)</label>
                  <input
                    id="fade-seconds"
                    type="number"
                    min={0.2}
                    max={10}
                    step={0.1}
                    value={draft.fadeOnStopSeconds}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        fadeOnStopSeconds: Number(event.target.value) || 1
                      }))
                    }
                  />
                </div>
              ) : null}
              <div className="check">
                <label htmlFor="top">Always on top</label>
                <input
                  id="top"
                  type="checkbox"
                  checked={draft.alwaysOnTop}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, alwaysOnTop: event.target.checked }))
                  }
                />
              </div>
              <BrandLink className="settings-logo" src="./logo_full_white.png" alt="Desert Dog" />
              <p className="help">Pixera Control v{appVersion}</p>
            </div>
            <div className="drawer-footer">
              <div className="drawer-actions">
                <button
                  className="primary"
                  onClick={async () => {
                    await persist(draft)
                    setLive(await control.connect())
                    setOpen(false)
                  }}
                >
                  Save and connect
                </button>
                <button className="ghost" onClick={() => void persist(draft)}>
                  Save
                </button>
                <button className="ghost" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function DirectorPad({
  timeline,
  locked,
  confirmStop,
  armed,
  editing,
  dragging,
  onDragStart,
  onDragEnd,
  onDropPad,
  onToggleLock,
  onHide,
  onCommand,
  onPrev,
  onNext,
  onGo,
  canPrev,
  canNext
}: {
  timeline: TimelineItem
  locked: boolean
  confirmStop: boolean
  armed: TimelineItem['cues'][number] | undefined
  editing: boolean
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDropPad: () => void
  onToggleLock: () => void
  onHide: () => void
  onCommand: (type: 'play' | 'pause' | 'stop') => void
  onPrev: () => void
  onNext: () => void
  onGo: () => void
  canPrev: boolean
  canNext: boolean
}) {
  const [stopArmed, setStopArmed] = useState(false)
  const goLabel = armed?.name?.trim() ? `GO · ${armed.name.trim()}` : 'GO'
  const current = timeline.cues.find((cue) => cue.id === timeline.currentCueId)

  useEffect(() => {
    if (!stopArmed) return
    const timer = window.setTimeout(() => setStopArmed(false), 3000)
    return () => window.clearTimeout(timer)
  }, [stopArmed])

  function requestStop() {
    if (locked) return
    if (!confirmStop || stopArmed) {
      setStopArmed(false)
      onCommand('stop')
      return
    }
    setStopArmed(true)
  }

  return (
    <article
      className={`director-pad ${locked ? 'is-locked' : ''} ${dragging ? 'is-dragging' : ''} ${editing ? 'is-editing' : ''}`}
      draggable={!editing}
      onDragStart={(event) => {
        if (editing) {
          event.preventDefault()
          return
        }
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (editing) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        if (editing) return
        event.preventDefault()
        onDropPad()
      }}
    >
      <header className="director-pad-top">
        {!editing ? (
          <span className="director-drag" title="Drag to reorder" aria-hidden="true">
            ⋮⋮
          </span>
        ) : null}
        <div className="director-pad-title">
          <TransportMark mode={timeline.transport} />
          <div>
            <strong>{timeline.name}</strong>
            <p>{current?.name || (timeline.cues.length ? 'Cue' : '—')}</p>
          </div>
        </div>
        {editing ? (
          <button type="button" className="ghost pressable director-hide" onClick={onHide}>
            Hide
          </button>
        ) : (
          <button
            className={`lock-btn pressable ${locked ? 'is-locked' : ''}`}
            title={locked ? 'Unlock transport' : 'Lock transport'}
            aria-pressed={locked}
            onClick={onToggleLock}
          >
            <LockMark locked={locked} />
          </button>
        )}
      </header>
      {!editing ? (
        <>
          <div className="director-clock">
            <span>{formatClock(timeline.positionSeconds)}</span>
            <span className="timeline-next">
              {timeline.countdownSeconds == null
                ? '—'
                : `next ${formatClock(timeline.countdownSeconds)}`}
            </span>
          </div>
          <div className={`transport-row ${locked ? 'is-locked' : ''}`}>
            <button
              className={`transport-btn pressable ${timeline.transport === 'play' ? 'is-active is-play' : ''}`}
              disabled={locked}
              onClick={() => {
                setStopArmed(false)
                onCommand('play')
              }}
            >
              Play
            </button>
            <button
              className={`transport-btn pressable ${timeline.transport === 'pause' ? 'is-active is-pause' : ''}`}
              disabled={locked}
              onClick={() => {
                setStopArmed(false)
                onCommand('pause')
              }}
            >
              Pause
            </button>
            <button
              className={`transport-btn pressable ${timeline.transport === 'stop' ? 'is-active is-stop' : ''} ${stopArmed ? 'is-confirm' : ''}`}
              disabled={locked}
              onClick={requestStop}
            >
              {stopArmed ? 'Sure?' : 'Stop'}
            </button>
          </div>
          <div className="director-cue">
            <span className="director-armed" title={armed?.name || undefined}>
              {armed ? armed.name || 'Armed cue' : 'No cues'}
            </span>
            <div className="cue-actions">
              <button className="ghost pressable" disabled={!canPrev} onClick={onPrev}>
                Prev
              </button>
              <button className="ghost pressable" disabled={!canNext} onClick={onNext}>
                Next
              </button>
            </div>
            <button
              className="go pressable"
              disabled={!armed}
              title={armed?.name?.trim() || undefined}
              onClick={onGo}
            >
              {goLabel}
            </button>
          </div>
        </>
      ) : (
        <p className="help director-edit-hint">Hidden pads stay connected; they only leave this view.</p>
      )}
    </article>
  )
}

function TimelineRow({
  timeline,
  selected,
  locked,
  confirmStop,
  onSelect,
  onToggleLock,
  onCommand,
  onOpacity,
  onLayerOpacity,
  onLayerMute
}: {
  timeline: TimelineItem
  selected: boolean
  locked: boolean
  confirmStop: boolean
  onSelect: () => void
  onToggleLock: () => void
  onCommand: (type: 'play' | 'pause' | 'stop') => void
  onOpacity: (value: number) => void
  onLayerOpacity: (layerId: string, value: number) => void
  onLayerMute: (layerId: string, muted: boolean) => void
}) {
  const progress = timeline.durationSeconds ? timeline.positionSeconds / timeline.durationSeconds : 0
  const current = timeline.cues.find((cue) => cue.id === timeline.currentCueId)
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null)
  const [layerOpacityDraft, setLayerOpacityDraft] = useState<Record<string, number>>({})
  const [stopArmed, setStopArmed] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const opacity = opacityDraft ?? timeline.opacity ?? 1
  const layers = timeline.layers || []

  useEffect(() => {
    setOpacityDraft(null)
  }, [timeline.id, timeline.opacity])

  useEffect(() => {
    setLayerOpacityDraft({})
  }, [timeline.id, timeline.layers])

  useEffect(() => {
    if (!stopArmed) return
    const timer = window.setTimeout(() => setStopArmed(false), 3000)
    return () => window.clearTimeout(timer)
  }, [stopArmed])

  function requestStop() {
    if (locked) return
    if (!confirmStop || stopArmed) {
      setStopArmed(false)
      onCommand('stop')
      return
    }
    setStopArmed(true)
  }

  return (
    <article className={`timeline-card ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}>
      <div className="timeline-top">
        <button className="timeline-select" onClick={onSelect}>
          <div className="timeline-title">
            <TransportMark mode={timeline.transport} />
            <div>
              <strong>{timeline.name}</strong>
              <p>{current?.name || (timeline.cues.length ? 'Cue' : '—')}</p>
            </div>
          </div>
          <span className="timeline-clock">
            <span>{formatClock(timeline.positionSeconds)}</span>
            <span className="timeline-next">
              {timeline.countdownSeconds == null ? '—' : `next ${formatClock(timeline.countdownSeconds)}`}
            </span>
          </span>
        </button>
        <button
          className={`lock-btn pressable ${locked ? 'is-locked' : ''}`}
          title={locked ? 'Unlock transport' : 'Lock transport'}
          aria-label={locked ? 'Unlock transport' : 'Lock transport'}
          aria-pressed={locked}
          onClick={onToggleLock}
        >
          <LockMark locked={locked} />
        </button>
      </div>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
      </div>
      <div className={`transport-row ${locked ? 'is-locked' : ''}`}>
        <button
          className={`transport-btn pressable ${timeline.transport === 'play' ? 'is-active is-play' : ''}`}
          disabled={locked}
          onClick={() => {
            setStopArmed(false)
            onCommand('play')
          }}
        >
          Play
        </button>
        <button
          className={`transport-btn pressable ${timeline.transport === 'pause' ? 'is-active is-pause' : ''}`}
          disabled={locked}
          onClick={() => {
            setStopArmed(false)
            onCommand('pause')
          }}
        >
          Pause
        </button>
        <button
          className={`transport-btn pressable ${timeline.transport === 'stop' ? 'is-active is-stop' : ''} ${stopArmed ? 'is-confirm' : ''}`}
          disabled={locked}
          onClick={requestStop}
        >
          {stopArmed ? 'Sure?' : 'Stop'}
        </button>
      </div>
      <div className="opacity-block">
        <div className="opacity-row">
          {layers.length ? (
            <button
              type="button"
              className={`opacity-flip pressable ${layersOpen ? 'is-open' : ''}`}
              aria-expanded={layersOpen}
              aria-label={layersOpen ? 'Hide layers' : 'Show layers'}
              onClick={() => setLayersOpen((open) => !open)}
            >
              <span className="opacity-tri" aria-hidden="true" />
              <span>Opacity</span>
            </button>
          ) : (
            <label htmlFor={`opacity-${timeline.id}`}>Opacity</label>
          )}
          <input
            id={`opacity-${timeline.id}`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(opacity * 100)}
            onChange={(event) => {
              const next = Number(event.target.value) / 100
              setOpacityDraft(next)
              onOpacity(next)
            }}
            onPointerUp={() => setOpacityDraft(null)}
            onBlur={() => setOpacityDraft(null)}
          />
          <output htmlFor={`opacity-${timeline.id}`}>{Math.round(opacity * 100)}%</output>
        </div>
        {layers.length && layersOpen ? (
          <div className="layer-list">
            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                timelineId={timeline.id}
                layer={layer}
                draft={layerOpacityDraft[layer.id]}
                onDraft={(value) =>
                  setLayerOpacityDraft((current) => ({ ...current, [layer.id]: value }))
                }
                onClearDraft={() =>
                  setLayerOpacityDraft((current) => {
                    const next = { ...current }
                    delete next[layer.id]
                    return next
                  })
                }
                onOpacity={(value) => onLayerOpacity(layer.id, value)}
                onMute={(muted) => onLayerMute(layer.id, muted)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function LayerRow({
  timelineId,
  layer,
  draft,
  onDraft,
  onClearDraft,
  onOpacity,
  onMute
}: {
  timelineId: string
  layer: LayerItem
  draft: number | undefined
  onDraft: (value: number) => void
  onClearDraft: () => void
  onOpacity: (value: number) => void
  onMute: (muted: boolean) => void
}) {
  const opacity = draft ?? layer.opacity ?? 1
  const inputId = `layer-opacity-${timelineId}-${layer.id}`
  return (
    <div className={`layer-row ${layer.muted ? 'is-muted' : ''}`}>
      <span className="layer-name" title={layer.name}>
        {layer.name}
      </span>
      <input
        id={inputId}
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(opacity * 100)}
        onChange={(event) => {
          const next = Number(event.target.value) / 100
          onDraft(next)
          onOpacity(next)
        }}
        onPointerUp={onClearDraft}
        onBlur={onClearDraft}
      />
      <output htmlFor={inputId}>{Math.round(opacity * 100)}%</output>
      <button
        type="button"
        className={`ghost pressable layer-mute ${layer.muted ? 'is-active' : ''}`}
        aria-pressed={layer.muted}
        onClick={() => onMute(!layer.muted)}
      >
        {layer.muted ? 'Unmute' : 'Mute'}
      </button>
    </div>
  )
}
