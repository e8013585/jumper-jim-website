"""
Builds the web-optimized images for the Jumper Jim site from the original
brand artwork in /assets. The originals are never modified.

Usage (from the project root):
    python scripts/optimize-images.py

Requires Pillow (pip install pillow) built with WebP support.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets"
OUT = ROOT / "images"
OUT.mkdir(exist_ok=True)

BRAND_YELLOW = (255, 199, 9)
BRAND_GREEN = (101, 188, 70)
BRAND_RED = (215, 24, 42)
BRAND_BLACK = (17, 17, 17)
CREAM = (255, 251, 234)

# name -> (source file, output widths for WebP, width of the PNG fallback)
IMAGES = {
    "jumper-jim-logo": ("jumper-jim-logo.png", [360, 560, 800, 1120], 800),
    "jumper-jim-wordmark": ("jumper-jim-title-brand.png", [200, 320, 480, 640], 480),
    "jumper-jim-mascot": ("jumper-jim-emblem-icon.png", [240, 360, 520, 720], 520),
    "jumper-jim-good-cars": ("good-cars-happier-people-footer.png", [280, 420, 600, 840], 600),
}


def trim(im: Image.Image, pad_ratio: float = 0.015) -> Image.Image:
    """Crop away the empty transparent margin, leaving a small breathing pad."""
    im = im.convert("RGBA")
    bbox = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    pad = int(max(im.size) * pad_ratio)
    left, top, right, bottom = bbox
    return im.crop(
        (
            max(left - pad, 0),
            max(top - pad, 0),
            min(right + pad, im.width),
            min(bottom + pad, im.height),
        )
    )


def resize(im: Image.Image, width: int) -> Image.Image:
    if width >= im.width:
        return im.copy()
    height = round(im.height * width / im.width)
    return im.resize((width, height), Image.LANCZOS)


def save_webp(im: Image.Image, path: Path) -> None:
    im.save(path, "WEBP", quality=88, method=6, alpha_quality=100)


def save_png(im: Image.Image, path: Path) -> None:
    im.save(path, "PNG", optimize=True)


def build_responsive_sets() -> dict:
    sizes = {}
    for name, (src, widths, png_width) in IMAGES.items():
        base = trim(Image.open(SRC / src))
        sizes[name] = base.size
        for w in widths:
            save_webp(resize(base, w), OUT / f"{name}-{w}.webp")
        save_png(resize(base, png_width), OUT / f"{name}-{png_width}.png")
        ratio = base.height / base.width
        print(f"{name}: trimmed {base.size}, aspect h/w = {ratio:.4f}")
    return sizes


def square_on(bg, im: Image.Image, size: int, fill_ratio: float) -> Image.Image:
    """Center `im` on a square canvas so it fills `fill_ratio` of the side."""
    canvas = Image.new("RGBA", (size, size), bg)
    target = int(size * fill_ratio)
    scale = target / max(im.size)
    art = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def build_icons() -> None:
    mascot = trim(Image.open(SRC / "jumper-jim-emblem-icon.png"), pad_ratio=0.0)

    # Transparent favicons (browser tabs)
    fav = square_on((0, 0, 0, 0), mascot, 512, 1.0)
    fav.save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    save_png(fav.resize((32, 32), Image.LANCZOS), ROOT / "favicon-32x32.png")

    # Solid-background icons (iOS home screen / Android install)
    white = (255, 255, 255, 255)
    save_png(square_on(white, mascot, 180, 0.86).convert("RGB"), ROOT / "apple-touch-icon.png")
    save_png(square_on(white, mascot, 192, 0.86), ROOT / "icon-192.png")
    save_png(square_on(white, mascot, 512, 0.86), ROOT / "icon-512.png")
    # Maskable icon keeps the art inside the 80% safe zone
    save_png(square_on(BRAND_YELLOW + (255,), mascot, 512, 0.70), ROOT / "icon-maskable-512.png")


def build_og_image() -> None:
    """1200x630 social share card: logo on a comic sunburst."""
    w, h = 1200, 630
    card = Image.new("RGBA", (w, h), CREAM + (255,))
    draw = ImageDraw.Draw(card)

    # Sunburst rays
    cx, cy = w // 2, h // 2
    rays = 28
    r = 1400
    for i in range(rays):
        if i % 2:
            continue
        a0 = 2 * math.pi * i / rays
        a1 = 2 * math.pi * (i + 1) / rays
        draw.polygon(
            [(cx, cy), (cx + r * math.cos(a0), cy + r * math.sin(a0)), (cx + r * math.cos(a1), cy + r * math.sin(a1))],
            fill=(255, 226, 120, 255),
        )

    # Brand stripe along the bottom: green / yellow / red with a black edge
    draw.rectangle([0, h - 34, w, h], fill=BRAND_BLACK)
    third = w // 3
    draw.rectangle([0, h - 28, third, h], fill=BRAND_GREEN)
    draw.rectangle([third, h - 28, third * 2, h], fill=BRAND_YELLOW)
    draw.rectangle([third * 2, h - 28, w, h], fill=BRAND_RED)

    logo = trim(Image.open(SRC / "jumper-jim-logo.png"))
    scale = min((w * 0.78) / logo.width, ((h - 60) * 0.92) / logo.height)
    logo = logo.resize((round(logo.width * scale), round(logo.height * scale)), Image.LANCZOS)
    card.alpha_composite(logo, ((w - logo.width) // 2, (h - 34 - logo.height) // 2))

    card.convert("RGB").save(OUT / "og-jumper-jim.jpg", "JPEG", quality=86, optimize=True, progressive=True)


if __name__ == "__main__":
    build_responsive_sets()
    build_icons()
    build_og_image()
    total = sum(p.stat().st_size for p in OUT.iterdir())
    print(f"Wrote {len(list(OUT.iterdir()))} files to images/ ({total / 1024:.0f} KB total)")
