# Draws the NekoTun tray/window icon: the same flat cat head as ui/src/components/Logo.tsx.
# Big canvas first, then shrink = smooth edges.   Run:  uvx --with pillow python make_icon.py .
import math
import sys

from PIL import Image, ImageDraw

out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
S = 1024
K = S / 24  # Logo.tsx uses a 24×24 viewBox; K turns its numbers into pixels
MINT = (110, 231, 183, 255)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def p(x, y):
    return (x * K, y * K)


# outline: ears + sides, then the half-ellipse chin (same path as the SVG)
pts = [p(4, 3.5), p(9.2, 7.6), p(14.8, 7.6), p(20, 3.5), p(20, 13.5)]
for i in range(1, 40):
    a = math.pi * i / 40  # 0 → 180°, right side round the bottom to the left
    pts.append(p(12 + 8 * math.cos(a), 13.5 + 7.6 * math.sin(a)))
pts.append(p(4, 13.5))
d.polygon(pts, fill=MINT)

# the SVG's 1.6-wide round stroke: thick lines + round joins soften the ear tips
w = 1.6 * K
for a, b in zip(pts, pts[1:] + pts[:1]):
    d.line([a, b], fill=MINT, width=int(w))
for x, y in pts:
    d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=MINT)

# eyes: cut out (transparent), like the SVG mask
for ex in (7.6, 14):
    d.rounded_rectangle([*p(ex, 12), *p(ex + 2.4, 15.6)], radius=1.2 * K, fill=(0, 0, 0, 0))

# crop to the shape, centre it on a square with a little padding
box = img.getbbox()
side = max(box[2] - box[0], box[3] - box[1]) + 48
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(img.crop(box), ((side - (box[2] - box[0])) // 2, (side - (box[3] - box[1])) // 2))
sq.resize((256, 256), Image.LANCZOS).save(f"{out_dir}/tray.png")
print("ok")
