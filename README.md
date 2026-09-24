# Pixera Control

Director / playback pad for **Pixera 25+**. Separate from the showcaller timer so a GO cannot live on the same screen as the countdown.

Current version: **0.3.2** — see [CHANGELOG.md](CHANGELOG.md).

Rollback before Companion GO-grid: open `release/markers/Pixera Control 0.3.2 pre-go-grid.app`, or `git checkout pre-go-grid-0.3.2`.

Look, logos, and Mac icon geometry match **Pixera Dashboard**.

## What it does now

- Connects in **Demo** and **automatically fills timelines and cues**
- Per-timeline Play / Pause / Stop
- Cue list for the selected timeline, with **GO** (click a cue or the big GO)
- Previous / Next cue
- Dark / light, always on top, Desert Dog mark

## What waits for live Pixera

- Throttled poll of cue lists and GO on a live show
- Throttled poll of all timelines
- Confirm on global Stop, arm+GO, Companion-style grid

## Run

```bash
cd "/Users/arnoudbeuse/Documents/Cursor/DD Tools/Pixera Control"
npm install
npm run dev
```

Local Mac app:

```bash
npm run pack:mac
```

That writes `release/mac-arm64/Pixera Control.app`. Quit and reopen to load a new build.
