# Changelog

All notable changes to Pixera Control are documented here.


## 0.2.5 — 2026-09-24

### Changed
- Top bar shows Pixera project name when connected; hover still shows host:port

## 0.2.4 — 2026-09-24

### Changed
- Layer opacity / mute sits under Opacity with a triangle disclosure (collapsed by default; works with one layer too)

## 0.2.3 — 2026-09-24

### Changed
- Per-layer opacity / mute is collapsed behind Layers by default

## 0.2.2 — 2026-09-24

### Added
- Per-layer opacity slider and Mute / Unmute under each timeline (loaded on connect / Refresh)

## 0.2.1 — 2026-09-24

### Changed
- GO button shows the armed cue name when Pixera provides one (`GO · Intro`); blank cues stay `GO`

## 0.2.0 — 2026-09-24

### Changed
- Connect with IP and port in Settings (manual entry only)

## 0.1.16 — 2026-09-24

### Added
- Refresh in the top bar reloads timeline names and cues from Pixera (polling only updates transport/position)

## 0.1.15 — 2026-09-24

### Changed
- Polling follows selected + playing timelines every tick; unlocked idle rotate; locked idle only about every 8 ticks

## 0.1.14 — 2026-09-24

### Changed
- Global transport toggle reads Control all / Hide controls

## 0.1.13 — 2026-09-24

### Changed
- Global Play / Pause / Stop is collapsed behind All… by default

## 0.1.12 — 2026-09-24

### Added
- Global Play all / Pause all / Stop all for unlocked timelines (Stop uses confirm + fade settings)

## 0.1.11 — 2026-09-24

### Added
- Soft stop: fade timeline opacity out, then stop, then restore opacity (Settings: Fade on Stop + duration)

## 0.1.10 — 2026-09-24

### Changed
- Confirm Stop toggle sits directly under Appearance in Settings

## 0.1.9 — 2026-09-24

### Added
- Confirm Stop: first press arms Sure?, second press within 3 s stops (toggle in Settings)

## 0.1.8 — 2026-09-24

### Added
- Opacity slider per timeline (Pixera timeline opacity)

### Changed
- Light mode timeline cards use white cards instead of muddy grey

## 0.1.7 — 2026-09-24

### Added
- Per-timeline transport lock in the app: toggle icon disables Play / Pause / Stop so a background timeline cannot be stopped by accident

## 0.1.6 — 2026-09-24

### Changed
- IP and port sit in the top bar next to connection status
- Cue pane shows the timeline name large, with Cues as the kicker

## 0.1.5 — 2026-09-24

### Fixed
- GO and transport feel snappy: UI updates immediately, writes jump ahead of polling
- GO works when cue names are blank by applying the cue handle
- Poll only refreshes the selected timeline each tick, and rotates the rest

## 0.1.4 — 2026-09-24

### Changed
- Cue list click arms a cue; GO fires it
- Previous / Next move the armed cue without starting it
- Play / Pause / Stop show the active transport and press in when clicked

## 0.1.3 — 2026-09-24

### Added
- Time until the next cue on each timeline
- Cue list from cue handles when cue names are blank

## 0.1.2 — 2026-09-24

### Fixed
- JSON/TCP mode opens a real pxr1 connection instead of refusing with the on-hold message

## 0.1.1 — 2026-09-22

Demo-only work. Not live-tested against Pixera.


## 0.1.0 — 2026-09-22

Demo-only work. Not live-tested against Pixera.

### Added
- Demo show that automatically fills three timelines with cues
- Play / Pause / Stop per timeline, cue list, GO, previous / next
