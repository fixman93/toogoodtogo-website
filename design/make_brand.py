"""Usage: python3 design/make_brand.py   (from the repo root)

Builds every brand asset from the new "foODnesi" artwork in src/assets/images:
- web logos (wordmark for the header, light version for dark backgrounds, full logo with the slogan),
- the "OD + leaf" app symbol, favicons, PWA icons, the e-mail logo,
- the iOS app icon and launch screen,
- an optimized hero banner (WebP, desktop + mobile crop).

The source PNGs are concept crops (see src/assets/images/README.txt); re-run this
script after replacing them with final exports.
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'src', 'assets', 'images')
WEB = os.path.join(SRC, 'web')
PUBLIC = os.path.join(ROOT, 'public')
XC = os.path.join(ROOT, 'mobile', 'ios', 'App', 'App', 'Assets.xcassets')
os.makedirs(WEB, exist_ok=True)

CREAM = (250, 248, 242, 255)   # --background of the web app
GREEN = (15, 61, 46, 255)      # logo dark green

logo = Image.open(os.path.join(SRC, 'foodnesi-logo-transparent.png')).convert('RGBA')


def keep(img, test):
    """Keep only pixels whose colour passes `test` (removes bits of neighbouring letters)."""
    a = np.asarray(img).astype(int).copy()
    a[..., 3] = np.where(test(a[..., 0], a[..., 1], a[..., 2]), a[..., 3], 0)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def trim(img, threshold=30):
    return img.crop(img.getchannel('A').point(lambda v: 255 if v > threshold else 0).getbbox())


def width(img, w):
    return img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)


orange = lambda r, g, b: (r > g + 40) & (r > b + 80)
green = lambda r, g, b: (g > r + 15) & (g > b + 20)

# --- Logos ---------------------------------------------------------------
# The orange accents right of the "i" are cut off in the concept crop: drop everything right of the leaf.
clean = logo.copy()
a = np.asarray(clean).copy()
a[:, 716:, 3] = 0
clean = Image.fromarray(a, 'RGBA')

full = trim(clean)                      # with "DOBRA HRANA. MANJE OTPADA."
wordmark = trim(clean.crop((0, 0, clean.width, 232)))  # letters + leaf only (header)


def on_dark(img):
    """Dark-green letters → cream, orange and leaf unchanged (for dark backgrounds)."""
    a = np.asarray(img).astype(int).copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    text = ~orange(r, g, b) & ~green(r, g, b)
    for i, v in enumerate(CREAM[:3]):
        a[..., i] = np.where(text, v, a[..., i])
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def save_png(img, path):
    # 256-colour palette keeps transparency and makes the logos 3–4× smaller.
    img.quantize(256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)


save_png(width(wordmark, 480), os.path.join(WEB, 'foodnesi-wordmark.png'))           # header (shown ~150 px wide)
save_png(width(on_dark(wordmark), 480), os.path.join(WEB, 'foodnesi-wordmark-light.png'))
save_png(width(full, 720), os.path.join(WEB, 'foodnesi-logo-full.png'))              # auth pages
save_png(width(on_dark(full), 720), os.path.join(WEB, 'foodnesi-logo-full-light.png'))
save_png(width(full, 480), os.path.join(PUBLIC, 'brand', 'foodnesi-logo.png'))       # e-mail header

# --- Symbol: "OD" + leaf ---------------------------------------------------
od = trim(keep(logo.crop((186, 40, 418, 224)), orange))
leaf = trim(keep(logo.crop((630, 10, 722, 125)), green))


def symbol(size, bg, scale=0.66):
    canvas = Image.new('RGBA', (size, size), bg)
    w = round(size * scale)
    o = width(od, w)
    lw = round(w * 0.30)
    l = width(leaf, lw)
    ox = (size - w) // 2 - round(size * 0.02)
    oy = (size - o.height) // 2 + round(size * 0.08)
    canvas.alpha_composite(o, (ox, oy))
    canvas.alpha_composite(l, (ox + w - round(lw * 0.75), oy - round(l.height * 0.82)))
    return canvas


CLEAR = (0, 0, 0, 0)
save_png(symbol(256, CLEAR, 0.9), os.path.join(WEB, 'foodnesi-symbol.png'))
save_png(symbol(256, CLEAR, 0.9), os.path.join(PUBLIC, 'brand', 'foodnesi-mark.png'))
# App icons: opaque dark green tile (iOS/Android round the corners themselves).
symbol(180, GREEN).convert('RGB').save(os.path.join(PUBLIC, 'apple-touch-icon.png'), optimize=True)
symbol(192, GREEN).convert('RGB').save(os.path.join(PUBLIC, 'icon-192.png'), optimize=True)
symbol(512, GREEN).convert('RGB').save(os.path.join(PUBLIC, 'icon-512.png'), optimize=True)
# Maskable: Android may crop to a circle — keep the symbol inside the 80% safe zone.
symbol(512, GREEN, 0.5).convert('RGB').save(os.path.join(PUBLIC, 'icon-maskable-512.png'), optimize=True)
# Browser tab: transparent, the symbol fills the square.
save_png(symbol(32, CLEAR, 0.92), os.path.join(PUBLIC, 'favicon-32.png'))
symbol(256, CLEAR, 0.92).save(os.path.join(PUBLIC, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])

# --- iOS -------------------------------------------------------------------
if os.path.isdir(XC):
    symbol(1024, GREEN).convert('RGB').save(os.path.join(XC, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), optimize=True)
    splash = Image.new('RGBA', (2732, 2732), CREAM)
    f = width(full, 1100)
    splash.alpha_composite(f, ((2732 - f.width) // 2, (2732 - f.height) // 2))
    for name in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
        splash.convert('RGB').save(os.path.join(XC, 'Splash.imageset', name), optimize=True)

# --- Android ---------------------------------------------------------------
RES = os.path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res')
if os.path.isdir(RES):
    densities = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
    for name, k in densities.items():
        folder = os.path.join(RES, f'mipmap-{name}')
        os.makedirs(folder, exist_ok=True)
        # Legacy launcher icon (48 dp) and its round twin.
        legacy = symbol(round(48 * k), GREEN)
        legacy.convert('RGB').save(os.path.join(folder, 'ic_launcher.png'), optimize=True)
        mask = Image.new('L', legacy.size, 0)
        from PIL import ImageDraw
        ImageDraw.Draw(mask).ellipse((0, 0, legacy.width - 1, legacy.height - 1), fill=255)
        round_icon = Image.new('RGBA', legacy.size, (0, 0, 0, 0))
        round_icon.paste(legacy, (0, 0), mask)
        round_icon.save(os.path.join(folder, 'ic_launcher_round.png'), optimize=True)
        # Adaptive icon foreground (108 dp; the launcher may crop to ~66 %, keep the symbol inside).
        symbol(round(108 * k), CLEAR, 0.46).save(os.path.join(folder, 'ic_launcher_foreground.png'), optimize=True)
    with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0F3D2E</color>\n</resources>\n')
    # Launch screen: logo with the slogan on cream, same size as each existing splash.png.
    for folder in os.listdir(RES):
        path = os.path.join(RES, folder, 'splash.png')
        if not folder.startswith('drawable') or not os.path.isfile(path):
            continue
        w, h = Image.open(path).size
        canvas = Image.new('RGBA', (w, h), CREAM)
        f = width(full, round(min(w, h) * 0.6))
        canvas.alpha_composite(f, ((w - f.width) // 2, (h - f.height) // 2))
        canvas.convert('RGB').save(path, optimize=True)

# --- Hero banner -------------------------------------------------------------
banner = Image.open(os.path.join(SRC, 'foodnesi-website-banner.png')).convert('RGB')
banner = banner.crop((0, 13, banner.width, banner.height))  # white strip + thin dark line at the top edge of the crop
banner.save(os.path.join(WEB, 'hero.webp'), quality=82, method=6)
# Phones: the bag with groceries (right part), taller crop.
banner.crop((945, 0, 1708, banner.height)).save(os.path.join(WEB, 'hero-mobile.webp'), quality=82, method=6)

for name in sorted(os.listdir(WEB)):
    print(f'{name:32} {os.path.getsize(os.path.join(WEB, name)) // 1024} KB')
print('public icons, e-mail logo' + (', iOS icon/splash' if os.path.isdir(XC) else '') + (', Android icons/splash' if os.path.isdir(RES) else '') + ' written')
