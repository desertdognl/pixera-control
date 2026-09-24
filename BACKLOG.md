# Backlog — Pixera Control

Live JSON/TCP is in use on a real Pixera (0.1.8). Keep transport and GO off the timer app. Prefer name/handle Compound methods; throttle reads.

## Done (live)

- [x] Scaffold Electron app with Dashboard look and logos
- [x] Demo show with timelines and cues
- [x] JSON/TCP connect (pxr1) to live Pixera
- [x] Timeline list: transport, position, next-cue countdown
- [x] Cue list from cue handles (blank names → Cue 1, Cue 2…)
- [x] Arm + GO (select cue, fire on GO)
- [x] Per-timeline Play / Pause / Stop with press + active feedback
- [x] Timeline transport lock (app-only)
- [x] Timeline opacity slider
- [x] Top bar IP:port; cue pane shows timeline name large

## Next (one by one — wait for feedback after each)

1. [x] Optional confirm on Stop (press twice) — **0.1.9 / 0.1.10**
2. [x] Soft stop: fade opacity out, then stop, then restore opacity — **0.1.11**
3. [x] Global Play / Pause / Stop (collapsed behind Control all) — **0.1.12–0.1.14**
4. [x] Follow / pin polling: selected + playing often, locked idle rarely — **0.1.15**
5. [x] Cue cache + manual Refresh for new timelines/cues — **0.1.16**
6. [x] ~~Heartbeat discovery~~ — dropped; enter IP/port manually — **0.2.0**
7. [x] Named GO when cues have real names — **0.2.1**
8. [x] Per-layer opacity / mute — **0.2.2**

## Later

- [ ] Multi-timeline director page (side-by-side pads)
- [ ] Companion-style custom GO grid
- [ ] Optional OSC send for fire-and-forget GO
- [x] Show project name from Pixera instead of host:port as project label — **0.2.5**
- [ ] Mac notarized / signed installer for handoff
