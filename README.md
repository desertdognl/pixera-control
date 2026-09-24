# Pixera Control

Director / playback control for **Pixera 25+**. Separate from the showcaller timer so a GO cannot live on the same screen as the countdown.

Current version: **1.0.0** — see [CHANGELOG.md](CHANGELOG.md).

## Features

- Connect in **Demo** (no Pixera) or **JSON/TCP** to a live Pixera
- **List** — timelines + cue list with GO
- **Director** — side-by-side timeline pads (reorder, hide/show)
- **Grid** — custom GO buttons (each fires one cue)
- Per-timeline Play / Pause / Stop, opacity, layer mute
- Dark / light, always on top

## Download

Pixera Control is a director / GO pad for Pixera 25+ shows (macOS and Windows).

Get the latest build from the [GitHub Releases](https://github.com/desertdognl/pixera-control/releases) page:

| Platform | File |
| --- | --- |
| macOS (Apple Silicon) | `Pixera-Control-1.0.0-mac-arm64.zip` |
| Windows (64-bit) | `Pixera-Control-1.0.0-win-x64.exe` (installer) or `.zip` (portable) |

Version numbers in the filenames match the release tag.

---

## macOS — first open (unsigned build)

The Mac app is **not** notarized (no Apple Developer signing yet). Gatekeeper will block it until you clear quarantine.

### 1. Download and unzip

Download the `.zip` from Releases, then double-click to unzip. You get `Pixera Control.app`.

### 2. Clear Gatekeeper quarantine (Terminal)

Open **Terminal** and run (adjust the path if you moved the app):

```bash
# If the app is in Downloads:
xattr -cr ~/Downloads/Pixera\ Control.app

# Or if you already put it in Applications:
xattr -cr "/Applications/Pixera Control.app"
```

What this does: removes the “downloaded from the internet” quarantine flag so macOS allows the app to launch.

Check that the flag is gone:

```bash
xattr -l "/Applications/Pixera Control.app"
```

You should see little or no `com.apple.quarantine` output.

### 3. First launch

1. Move `Pixera Control.app` to **Applications** (optional but recommended).
2. **Right-click** (or Control-click) the app → **Open**.
3. Confirm **Open** in the dialog.

After that, normal double-click works.

### If macOS still says the app is damaged / can’t be opened

```bash
xattr -cr "/Applications/Pixera Control.app"
sudo spctl --master-disable
```

Then try **Open** again. Re-enable Gatekeeper when done:

```bash
sudo spctl --master-enable
```

Prefer only `xattr -cr` when possible; `spctl` is a broader system switch.

### Apple Silicon only

The published Mac build is **arm64** (M1 / M2 / M3 / M4). Intel Macs are not covered in this release.

---

## Windows — first open (unsigned build)

The Windows build is **not** code-signed. SmartScreen may warn.

### Installer (`.exe`)

1. Run `Pixera-Control-*-win-x64.exe`.
2. If **Windows protected your PC** appears → **More info** → **Run anyway**.
3. Finish the installer and start **Pixera Control** from the Start menu.

### Portable (`.zip`)

1. Unzip the archive.
2. Run `Pixera Control.exe`.
3. Same SmartScreen steps if prompted (*More info* → *Run anyway*).

---

## Connect to Pixera

1. Open **Settings**.
2. Mode: **Pixera JSON/TCP**.
3. Enter the Pixera machine **IP** and port (**1400** by default — same as Pixera Dashboard).
4. Save / connect.
5. Use **Refresh** if timelines or cues changed in Pixera.

**Demo** mode fills a sample show on this computer and never opens a network socket.

---

## Develop (optional)

```bash
npm install
npm run dev
```

Build locally:

```bash
# macOS app (Apple Silicon)
npm run pack:mac

# macOS zip for distribution
npm run dist:mac

# Windows (run on Windows, or via CI)
npm run dist:win
```
