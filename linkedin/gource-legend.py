# SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
# SPDX-License-Identifier: GPL-3.0-or-later
"""Draw the overlays for the "names" Gource clip.

    python3 gource-legend.py WIDTH HEIGHT BACKGROUND.png LEGEND.png LABEL=COLOUR=COUNT ...

BACKGROUND.png is a soft night-sky gradient handed to Gource; LEGEND.png is a light,
half-transparent panel with one coloured dot per file group, laid over the video by ffmpeg.
"""

import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONTS = "/usr/share/fonts/noto"


def background(width: int, height: int, path: str) -> None:
    """Deep blue at the top fading to aubergine, with a faint glow behind the tree."""
    top, bottom = (14, 18, 40), (38, 16, 46)
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / (height - 1)
        draw.line([(0, y), (width, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    glow = Image.new("L", (width, height), 0)
    r = min(width, height) * 0.38
    ImageDraw.Draw(glow).ellipse([width / 2 - r, height / 2 - r, width / 2 + r, height / 2 + r], fill=60)
    glow = glow.filter(ImageFilter.GaussianBlur(r / 2))
    image = Image.composite(Image.new("RGB", (width, height), (70, 60, 120)), image, glow)
    image.save(path)


def legend(width: int, height: int, path: str, groups: list[tuple[str, str, int]]) -> None:
    """Rounded frosted panel in the top-left corner: title, then one row per group."""
    scale = width / 1080
    title = ImageFont.truetype(f"{FONTS}/NotoSans-Bold.ttf", round(30 * scale))
    label = ImageFont.truetype(f"{FONTS}/NotoSans-Regular.ttf", round(27 * scale))
    count = ImageFont.truetype(f"{FONTS}/NotoSans-Bold.ttf", round(27 * scale))
    pad, row, dot, margin = round(26 * scale), round(44 * scale), round(11 * scale), round(36 * scale)
    label_width = max(label.getlength(name) for name, _, _ in groups)
    count_width = max(count.getlength(str(n)) for _, _, n in groups)
    panel_w = round(pad * 2 + dot * 2 + pad * 0.7 + label_width + pad + count_width)
    panel_h = round(pad * 2 + row * 1.15 + row * len(groups) - row * 0.25)

    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    box = [margin, margin, margin + panel_w, margin + panel_h]
    ImageDraw.Draw(shadow).rounded_rectangle(box, radius=pad, fill=(0, 0, 0, 70))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(pad * 0.6)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(box, radius=pad, fill=(255, 255, 255, 46), outline=(255, 255, 255, 110), width=2)

    x, y = margin + pad, margin + pad
    draw.text((x, y), "Files by type", font=title, fill=(255, 255, 255, 240))
    y += round(row * 1.15)
    for name, colour, n in groups:
        rgb = tuple(int(colour[i : i + 2], 16) for i in (0, 2, 4))
        cy = y + row * 0.36
        draw.ellipse([x - dot * 0.5, cy - dot * 1.5, x + dot * 2.5, cy + dot * 1.5], fill=rgb + (60,))
        draw.ellipse([x, cy - dot, x + dot * 2, cy + dot], fill=rgb + (255,))
        draw.text((x + dot * 2 + pad * 0.7, y), name, font=label, fill=(255, 255, 255, 225))
        draw.text((margin + panel_w - pad - count.getlength(str(n)), y), str(n), font=count, fill=rgb + (255,))
        y += row
    image.save(path)


def main() -> None:
    width, height = int(sys.argv[1]), int(sys.argv[2])
    groups = []
    for spec in sys.argv[5:]:
        name, colour, n = spec.split("=")
        groups.append((name, colour, int(n)))
    background(width, height, sys.argv[3])
    legend(width, height, sys.argv[4], groups)


if __name__ == "__main__":
    main()
