"""Cuts images from an image generator into sprites with a transparent background.

Frames of one character in a row (a walk cycle) -> one even strip:
    python3 tools/cut_sprite.py strip assets/raw/buddy-walk.webp assets/buddy-walk.png 4

Different objects in a row (weapons) -> a separate file for each:
    python3 tools/cut_sprite.py items assets/raw/weapons-1.webp assets/weapons revolver,bat,sword 0.5
The last number is the scale and may be omitted. Weapons must be cut at exactly 0.5: the game
derives their size on the arena from it (ART_PX in src/render.js). Interface frames are cut at 1,
because they get stretched over big panels. Everything else is sized by the game, so scale only affects sharpness.

If the image has real transparency, it is used as is. If the background is painted (white or
a fake checkerboard), it is removed by a flood fill from the edges over light colourless pixels.
The fill stops at the dark outline, so white areas inside the drawing (a badge, bat tape) stay.
Frames and objects are found by the empty gaps between them.
"""

import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Layout of a strip cell: its height, the height of the standing character and the row where the soles rest.
# The game relies on exactly these numbers (see CELL in src/render.js).
CELL_H, STAND_H, BASELINE = 256, 232, 240

# How much to shrink objects when no scale is given on the command line.
ITEM_SCALE = 0.32


def load(src, legs_gap=False, holes=False):
    img = Image.open(src)
    if "A" in img.getbands():
        alpha = np.asarray(img.getchannel("A"))
        if (alpha < 16).mean() > 0.05:
            # the transparency is real; throw away the barely visible dirt in the background
            out = img.convert("RGBA")
            out.putalpha(Image.fromarray(np.where(alpha < 24, 0, alpha).astype(np.uint8)))
            return out
    return cut_background(img.convert("RGB"), legs_gap, holes)


def cut_background(img, legs_gap=False, holes=False):
    rgb = np.asarray(img).astype(np.int16)
    light = rgb.min(axis=2) > 205
    gray = (rgb.max(axis=2) - rgb.min(axis=2)) < 22
    # 255 — looks like background, 0 — definitely the drawing. copy: otherwise the image is read-only
    mask = Image.fromarray(np.where(light & gray, 255, 0).astype(np.uint8)).copy()
    w, h = mask.size
    edge = [(x, y) for x in range(0, w, 16) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 16) for x in (0, w - 1)]
    for seed in edge:
        if mask.getpixel(seed) == 255:
            ImageDraw.floodfill(mask, seed, 128)
    if legs_gap:
        # The gap between the legs is not reached by the edge fill: the outline encloses it. So in the
        # bottom third, where the character has nothing white, big light islands count as background too.
        low = int(h * 0.68)
        while True:
            rest = np.argwhere(np.asarray(mask)[low:] == 255)
            if not len(rest):
                break
            y, x = rest[0]
            ImageDraw.floodfill(mask, (int(x), int(y) + low), 64)
            area = int((np.asarray(mask) == 64).sum())
            mask = mask.point(lambda v, to=128 if area >= 60 else 32: to if v == 64 else v)
    if holes:
        # Background can show through an object: a trigger guard, a chainsaw handle.
        # Such an island is almost white and completely colourless. Light metal is darker, and white
        # highlights and shirts in this style are slightly cream, so the rule leaves them alone.
        brightness = rgb.min(axis=2)
        tint = rgb.max(axis=2) - rgb.min(axis=2)
        while True:
            rest = np.argwhere(np.asarray(mask) == 255)
            if not len(rest):
                break
            y, x = rest[0]
            ImageDraw.floodfill(mask, (int(x), int(y)), 64)
            island = np.asarray(mask) == 64
            is_bg = island.sum() >= 60 and brightness[island].mean() >= 236 and tint[island].mean() < 4
            mask = mask.point(lambda v, to=128 if is_bg else 32: to if v == 64 else v)
    bg = Image.fromarray(np.where(np.asarray(mask) == 128, 255, 0).astype(np.uint8))
    # eat the light fringe around the outline and soften the edge a little
    bg = bg.filter(ImageFilter.MaxFilter(5))
    out = img.convert("RGBA")
    out.putalpha(Image.eval(bg, lambda v: 255 - v).filter(ImageFilter.GaussianBlur(1)))
    return out


def runs(flags, min_len=10, max_gap=8):
    """Runs of consecutive True values; small gaps are merged, small debris is dropped."""
    found, start = [], None
    for i, on in enumerate(list(flags) + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if found and start - found[-1][1] <= max_gap:
                found[-1] = (found[-1][0], i)
            else:
                found.append((start, i))
            start = None
    return [r for r in found if r[1] - r[0] >= min_len]


def find_parts(sheet, count):
    """Bounding boxes of objects or frames, left to right."""
    solid = np.asarray(sheet)[..., 3] > 40
    cols = runs(solid.any(axis=0))
    if len(cols) != count:
        sys.exit(f"expected parts: {count}, found: {len(cols)} — {cols}")
    parts = []
    for x0, x1 in cols:
        rows = np.flatnonzero(solid[:, x0:x1].any(axis=1))
        parts.append({"x0": x0, "x1": x1, "top": int(rows[0]), "bottom": int(rows[-1]) + 1})
    return parts, solid


def shrink(img, scale):
    size = (round(img.width * scale), round(img.height * scale))
    # RGBa has premultiplied alpha, so that shrinking does not produce a light halo
    return img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def strip(src, dst, frames):
    sheet = load(src, legs_gap=True)
    cells, solid = find_parts(sheet, frames)
    for c in cells:
        # the centre is measured on the upper part of the frame: a stepping boot must not shift the torso
        upper = solid[c["top"] : c["top"] + int((c["bottom"] - c["top"]) * 0.55), c["x0"] : c["x1"]]
        xs = np.flatnonzero(upper.any(axis=0))
        c["cx"] = c["x0"] + (xs[0] + xs[-1] + 1) / 2

    baseline = min(c["bottom"] for c in cells)  # soles of the standing frame
    stand = next(c for c in cells if c["bottom"] == baseline)
    scale = STAND_H / (baseline - stand["top"])
    half = max(max(c["cx"] - c["x0"], c["x1"] - c["cx"]) for c in cells) * scale
    cell_w = 2 * (math.ceil(half) + 4)

    out = Image.new("RGBA", (cell_w * frames, CELL_H))
    for i, c in enumerate(cells):
        crop = shrink(sheet.crop((c["x0"], c["top"], c["x1"], c["bottom"])), scale)
        x = round(i * cell_w + cell_w / 2 - (c["cx"] - c["x0"]) * scale)
        y = round(BASELINE - (baseline - c["top"]) * scale)
        if y < 0 or y + crop.height > CELL_H:
            sys.exit(f"frame {i + 1} does not fit the cell vertically: y={y}, height={crop.height}")
        out.alpha_composite(crop, (x, y))
        print(f"frame {i + 1}: top {y}, bottom {y + crop.height}")
    out.save(dst)
    print(f"saved {out.size}, cell {cell_w}x{CELL_H}, scale {scale:.3f} -> {dst}")


def items(src, outdir, names, scale=ITEM_SCALE):
    sheet = load(src, holes=True)
    parts, _ = find_parts(sheet, len(names))
    os.makedirs(outdir, exist_ok=True)
    for name, p in zip(names, parts):
        out = shrink(sheet.crop((p["x0"], p["top"], p["x1"], p["bottom"])), scale)
        path = os.path.join(outdir, name + ".png")
        out.save(path)
        print(f"{name}: box in the source {p['x0']},{p['top']} — {p['x1']},{p['bottom']}, saved {out.size} -> {path}")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "strip" and len(sys.argv) == 5:
        strip(sys.argv[2], sys.argv[3], int(sys.argv[4]))
    elif mode == "items" and len(sys.argv) in (5, 6):
        items(sys.argv[2], sys.argv[3], sys.argv[4].split(","), *[float(v) for v in sys.argv[5:]])
    else:
        sys.exit(__doc__)
