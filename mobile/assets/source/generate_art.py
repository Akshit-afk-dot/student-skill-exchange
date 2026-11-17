"""
Generates the app icon, Android adaptive icon layers, splash mark, favicon and the
Google Play listing graphics. Run from mobile/:  python assets/source/generate_art.py

The mark is two opposing arrows: the two-way exchange the app is built around. Everything
is drawn at 4x and scaled down, so edges stay smooth.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'assets'
STORE = ROOT / 'store'

# The app's own palette (src/theme/palette.ts, light theme). Solid, not a gradient: the
# icon should look like the app it opens, and the app does not use gradients.
PRIMARY = (0x50, 0x54, 0xB1)  # primary
WHITE = (255, 255, 255)  # onPrimary
TINT = (0xE1, 0xE0, 0xFF)  # primaryContainer: the second arrow, so it reads as two people

SS = 4  # supersampling factor


def stroke(draw, a, b, thickness):
    """A straight stroke with round ends."""
    draw.line([a, b], fill=255, width=thickness)
    r = thickness / 2
    for x, y in (a, b):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=255)


def arrow_mask(canvas, cx, cy, length, head, thickness, pointing_right):
    """Mask of one arrow centred on (cx, cy), at the final size. Drawn large, scaled down."""
    big = Image.new('L', (canvas[0] * SS, canvas[1] * SS), 0)
    draw = ImageDraw.Draw(big)
    half = length / 2 * SS
    x, y = cx * SS, cy * SS
    t = round(thickness * SS)
    h = head * SS
    tip = (x + half, y) if pointing_right else (x - half, y)
    tail = (x - half, y) if pointing_right else (x + half, y)
    back = -h if pointing_right else h
    stroke(draw, tail, tip, t)
    stroke(draw, tip, (tip[0] + back, y - h), t)
    stroke(draw, tip, (tip[0] + back, y + h), t)
    return big.resize(canvas, Image.LANCZOS)


def draw_mark(img, cx, cy, scale, top=WHITE, bottom=TINT):
    """
    Draws the two arrows centred on (cx, cy). At scale 1 the mark is about 560 wide and
    400 tall. The pair is staggered sideways, so it has a point symmetry rather than
    looking like a generic swap icon.
    """
    length, head, thick = 400 * scale, 112 * scale, 62 * scale
    gap = 105 * scale
    stagger = 44 * scale
    for (dx, dy, right, colour) in (
        (stagger, -gap, True, top),
        (-stagger, gap, False, bottom),
    ):
        mask = arrow_mask(img.size, cx + dx, cy + dy, length, head, thick, right)
        img.paste(Image.new(img.mode, img.size, colour + ((255,) if img.mode == 'RGBA' else ())), (0, 0), mask)


def app_icon(size=1024):
    """Full-bleed and opaque: iOS rejects icons with transparency, and masks the corners itself."""
    img = Image.new('RGB', (size, size), PRIMARY)
    draw_mark(img, size / 2, size / 2, size / 1024 * 1.12)
    return img


def transparent_mark(size, scale, top=WHITE, bottom=TINT):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_mark(img, size / 2, size / 2, scale, top, bottom)
    return img


def feature_graphic():
    """1024x500, opaque, as Play requires. No text: the store shows the name right beside it."""
    w, h = 1024, 500
    img = Image.new('RGBA', (w, h), PRIMARY + (255,))
    mark = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw_mark(mark, w / 2, h / 2, 0.68)
    return Image.alpha_composite(img, mark).convert('RGB')


def main():
    STORE.mkdir(exist_ok=True)

    icon = app_icon()
    icon.save(ASSETS / 'icon.png', optimize=True)
    icon.resize((48, 48), Image.LANCZOS).save(ASSETS / 'favicon.png', optimize=True)
    icon.resize((512, 512), Image.LANCZOS).save(STORE / 'play-icon-512.png', optimize=True)

    # Android keeps adaptive icon content inside the middle 61% of the canvas, because
    # launchers crop the rest into circles, squircles and so on.
    Image.new('RGB', (1024, 1024), PRIMARY).save(ASSETS / 'android-icon-background.png', optimize=True)
    transparent_mark(1024, 0.92).save(ASSETS / 'android-icon-foreground.png', optimize=True)
    transparent_mark(1024, 0.92, WHITE, WHITE).save(ASSETS / 'android-icon-monochrome.png', optimize=True)

    # White on the indigo splash background (app.json), small because it is shown centred.
    transparent_mark(1024, 0.8).save(ASSETS / 'splash-icon.png', optimize=True)

    feature_graphic().save(STORE / 'feature-graphic-1024x500.png', optimize=True)
    print('Generated icons and store graphics.')


if __name__ == '__main__':
    main()
