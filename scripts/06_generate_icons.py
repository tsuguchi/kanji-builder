#!/usr/bin/env python3
"""Generate app icons + splash + favicon from a kanji glyph and color theme.

Outputs (overwrites in place under assets/images/):
  icon.png                       1024x1024  iOS / web / fallback
  android-icon-background.png    1024x1024  Android adaptive bg (solid)
  android-icon-foreground.png    1024x1024  Android adaptive fg (glyph)
  android-icon-monochrome.png    1024x1024  Android themed-icon (glyph)
  splash-icon.png                1024x1024  Splash centerpiece (boxed)
  favicon.png                      48x48    Web favicon

Design:
  - Brand mark: a single kanji glyph ("漢"), white on a #c66 red rounded
    square. The red matches the Reviews CTA / Due badges in-app so the
    home-screen icon and the in-app accent feel like the same product.
  - For Android adaptive icons, the foreground glyph sits inside the
    66%-of-canvas safe zone (system masks crop further), so the glyph
    is intentionally smaller than the iOS art.
  - The monochrome variant is alpha-only — Android themed icons recolor
    the glyph; any RGB we put in is ignored.

Font selection prefers a bold sans (Yu Gothic Bold) so the glyph reads
well even at favicon size. Falls back through Meiryo Bold / MS Gothic
if Yu Gothic isn't installed.

Usage:
    python scripts/06_generate_icons.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DST = PROJECT_ROOT / "assets" / "images"

GLYPH = "漢"

# #c66 — same as styles.reviewsCtaDue / styles.dueBadge in the app.
RED_RGB = (204, 102, 102)
WHITE = (255, 255, 255)

# Try a few common Windows JP fonts in preference order.
FONT_CANDIDATES = [
    "C:/Windows/Fonts/YuGothB.ttc",   # Yu Gothic Bold
    "C:/Windows/Fonts/meiryob.ttc",   # Meiryo Bold
    "C:/Windows/Fonts/YuGothM.ttc",   # Yu Gothic Medium
    "C:/Windows/Fonts/msgothic.ttc",  # MS Gothic
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    raise FileNotFoundError(
        "No usable JP font found. Install Yu Gothic / Meiryo / MS Gothic, "
        "or extend FONT_CANDIDATES in this script."
    )


def rounded_square(size: int, radius: int, fill: tuple[int, int, int]) -> Image.Image:
    """A solid rounded-square RGB image used as the iOS / splash backdrop."""
    img = Image.new("RGB", (size, size), fill)
    # Build an alpha mask the system can use if we ever switch to RGBA;
    # for now PIL's rounded_rectangle gives us the geometry only.
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    # Composite the mask in — outside the mask becomes white so the icon
    # still looks fine in containers that don't mask their own corners.
    bg = Image.new("RGB", (size, size), WHITE)
    bg.paste(img, mask=mask)
    return bg


def draw_glyph(
    img: Image.Image,
    glyph_ratio: float,
    color: tuple[int, int, int, int] | tuple[int, int, int],
) -> None:
    """Draw GLYPH centered using the given font size = glyph_ratio * canvas."""
    size = img.size[0]
    font = load_font(int(size * glyph_ratio))
    draw = ImageDraw.Draw(img)
    draw.text((size // 2, size // 2), GLYPH, fill=color, font=font, anchor="mm")


def generate_icon(size: int) -> Image.Image:
    """iOS / web icon: red rounded square + centered white glyph."""
    radius = size // 5  # ~iOS continuous-corner look
    img = rounded_square(size, radius, RED_RGB)
    draw_glyph(img, glyph_ratio=0.7, color=WHITE)
    return img


def generate_android_foreground(size: int) -> Image.Image:
    """Glyph only on transparent — Android composites it over the background.

    Adaptive icons reserve a 66%-diameter safe zone in the middle of the
    canvas; anything outside may be cropped by the system mask. We size the
    glyph for that safe zone, not the full canvas.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_glyph(img, glyph_ratio=0.45, color=(*WHITE, 255))
    return img


def generate_android_monochrome(size: int) -> Image.Image:
    """Themed icon: alpha-only glyph. Android colors it at theme apply time."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # The RGB value is ignored when the system applies its theme color; we
    # just need the alpha channel to be the glyph shape.
    draw_glyph(img, glyph_ratio=0.45, color=(255, 255, 255, 255))
    return img


def generate_android_background(size: int) -> Image.Image:
    """Solid red — Android masks this to a circle / squircle as it pleases."""
    return Image.new("RGB", (size, size), RED_RGB)


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    print(f"Writing icons to {DST.relative_to(PROJECT_ROOT)} ...")

    outputs: list[tuple[str, Image.Image]] = [
        ("icon.png", generate_icon(1024)),
        ("android-icon-background.png", generate_android_background(1024)),
        ("android-icon-foreground.png", generate_android_foreground(1024)),
        ("android-icon-monochrome.png", generate_android_monochrome(1024)),
        # Splash uses imageWidth=200 in app.json; render at 1024 and let
        # Expo downscale so it stays crisp on high-DPI screens.
        ("splash-icon.png", generate_icon(1024)),
        # Favicon stays tiny — bump glyph_ratio so the stroke remains
        # visible at 48px.
        ("favicon.png", generate_favicon(48)),
    ]

    for name, img in outputs:
        path = DST / name
        img.save(path)
        print(f"  [ok]   {name:<40} {path.stat().st_size:>7,} bytes")

    return 0


def generate_favicon(size: int) -> Image.Image:
    radius = max(2, size // 6)
    img = rounded_square(size, radius, RED_RGB)
    draw_glyph(img, glyph_ratio=0.85, color=WHITE)
    return img


if __name__ == "__main__":
    sys.exit(main())
