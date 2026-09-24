#!/usr/bin/env python3
"""Draw a yellow play badge on the Desert Dog mark (same spot as the timer clock)."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "resources" / "AppIcon-1024.png"
DEST = ROOT / "resources" / "icon.png"
YELLOW = (255, 220, 0, 255)
BLACK = (0, 0, 0, 255)


def main() -> None:
    base = Image.open(SRC).convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx, cy, r = 272, 736, 188
    ring = 28
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=YELLOW)
    draw.ellipse((cx - r + ring, cy - r + ring, cx + r - ring, cy + r - ring), fill=BLACK)
    play = [(cx - 40, cy - 90), (cx - 40, cy + 90), (cx + 100, cy)]
    draw.polygon(play, fill=YELLOW)
    out = Image.alpha_composite(base, overlay).convert("RGB")
    out.save(DEST)
    print(f"Wrote {DEST}")


if __name__ == "__main__":
    main()
