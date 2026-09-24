# Pixera Control — project notes for agents

This folder is a **separate Electron app** from Pixera Dashboard. Open this folder as its own Cursor workspace when working on Control. Do not edit timer code from here, and do not put Control features into the Dashboard repo.

## Paths

- Project root: `/Users/arnoudbeuse/Documents/Cursor/DD Tools/Pixera Control`
- Sibling timer (read-only reference): `../Pixera Dashboard`
- Local Mac app: `release/mac-arm64/Pixera Control.app`
- Public releases: https://github.com/desertdognl/pixera-control/releases

## Product boundary

| | Dashboard (timer) | Control (this app) |
| --- | --- | --- |
| Role | Read-only showcaller countdown | Director / playback / GO |
| Poll | Light Compound reads only | Heavier list + writes; own loop |
| Risk | Must never send Play/Pause/Stop/GO | Sends transport and cue GO |

Never share a poll loop with the timer. Throttle Pixera calls. Prefer Compound / name-based methods over clip-span and cue-handle storms (those crashed Pixera during Dashboard development).

## Look and brand

- Same Desert Dog visual language as Dashboard (CSS tokens, topbar, settings drawer style).
- Wordmark: `resources/logo_full_white.png`
- App mark: Desert Dog yellow geometry + **play badge** (not the timer clock). Rebuild with `npm run icon:mac` → `overlay-play-icon.py` then `make-mac-icon.py` (macOS 26: 1024 canvas, 824 squircle, 100px inset).

## Docs to keep in this repo only

- `CHANGELOG.md` — every user-facing change
- `BACKLOG.md` — Control work only
- `README.md` — operator / install / connect
- `.cursor/rules/` — Control agent rules

## Version + local Mac app

When shipping a user-visible change in the same turn:

1. Bump `package.json` + `src/shared/version.ts`
2. Update `CHANGELOG.md` (+ README version line if needed)
3. `npm run pack:mac`
4. Tell the user to quit and reopen `release/mac-arm64/Pixera Control.app`

See `.cursor/rules/version-bumps.mdc`.

## Pixera notes (learned with Dashboard)

- JSON/TCP on port **1400** (same as Companion). Framing: try **pxr1** first; older **dl / 0xPX** exists.
- HTTP/TCP port **0** means off. OSC is send-only — not for live readback.
- Last timer build proven live against Pixera: **Dashboard 0.6.0**. Control has since been used live; still treat heavy API use carefully.
- Demo mode must never open a TCP socket.

## Commands

```bash
npm install
npm run dev
npm test
npm run pack:mac
npm run dist:mac
npm run dist:win
```
