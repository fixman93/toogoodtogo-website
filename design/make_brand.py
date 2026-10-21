"""Usage: python3 design/make_brand.py   (from the repo root)

Builds every brand asset from the "Foodnesi" fruit-logo artwork in src/assets/images:
- web logos (wordmark for the header + a light version for dark backgrounds),
- the "fruit O" app symbol, favicons, PWA icons, the e-mail logo,
- the iOS/Android app icons and launch screens,
- an optimized hero banner (WebP, desktop + mobile crop).

Re-run it after replacing "Foodnesi Fruit Logo.png" or foodnesi-hero.jpg.
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
GREEN = (7, 63, 45, 255)       # logo dark green


def unwhite(img):
    """White background → transparent; edge pixels are un-mixed from white so they stay crisp on any colour."""
    a = np.asarray(img.convert('RGB')).astype(float)
    d = (255 - a).max(axis=2)
    alpha = np.clip((d - 12) / (110 - 12), 0, 1)
    rgb = np.where(alpha[..., None] > 0, (a - 255 * (1 - alpha[..., None])) / np.maximum(alpha[..., None], 1e-3), 0)
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def keep(img, test):
    """Keep only pixels whose colour passes `test`."""
    a = np.asarray(img).astype(int).copy()
    a[..., 3] = np.where(test(a[..., 0], a[..., 1], a[..., 2]), a[..., 3], 0)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def trim(img, threshold=30):
    return img.crop(img.getchannel('A').point(lambda v: 255 if v > threshold else 0).getbbox())


def width(img, w):
    return img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)


orange = lambda r, g, b: (r > g + 40) & (r > b + 80)
green = lambda r, g, b: (g > r + 15) & (g > b + 20) & (r > 40)   # light leaf, not the dark letters

logo = unwhite(Image.open(os.path.join(SRC, 'Foodnesi Fruit Logo.png')))

# --- Logos ---------------------------------------------------------------
wordmark = trim(logo)


def on_dark(img):
    """Dark-green letters and leaf → cream, orange and light leaf unchanged (for dark backgrounds)."""
    a = np.asarray(img).astype(int).copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    text = ~orange(r, g, b) & ~green(r, g, b)
    for i, v in enumerate(CREAM[:3]):
        a[..., i] = np.where(text, v, a[..., i])
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def save_png(img, path):
    # 256-colour palette keeps transparency and makes the logos 3–4× smaller.
    img.quantize(256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)


save_png(width(wordmark, 720), os.path.join(WEB, 'foodnesi-wordmark.png'))           # header, auth pages
save_png(width(on_dark(wordmark), 720), os.path.join(WEB, 'foodnesi-wordmark-light.png'))
save_png(width(wordmark, 480), os.path.join(PUBLIC, 'brand', 'foodnesi-logo.png'))   # e-mail header

# --- Symbol: the orange "O" with its two leaves ------------------------------
# Below y=300 only the orange belongs to the "O" (the neighbouring letters are dark green).
fruit = logo.crop((600, 120, 905, 548))
f = np.asarray(fruit).copy()
rows = np.arange(f.shape[0])[:, None] + 120
r, g, b = (f[..., i].astype(int) for i in range(3))
f[..., 3] = np.where((rows < 300) | orange(r, g, b), f[..., 3], 0)
fruit = trim(Image.fromarray(f, 'RGBA'))


def symbol(size, bg, scale=0.66, dark=None):
    """Fruit "O" centred on a square; on the dark green tile the dark leaf turns cream."""
    canvas = Image.new('RGBA', (size, size), bg)
    mark = on_dark(fruit) if (bg == GREEN if dark is None else dark) else fruit
    h = round(size * scale)
    m = mark.resize((round(mark.width * h / mark.height), h), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
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
    f = width(wordmark, 1300)
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
        symbol(round(108 * k), CLEAR, 0.5, dark=True).save(os.path.join(folder, 'ic_launcher_foreground.png'), optimize=True)
    with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#073F2D</color>\n</resources>\n')
    # Launch screen: wordmark on cream, same size as each existing splash.png.
    for folder in os.listdir(RES):
        path = os.path.join(RES, folder, 'splash.png')
        if not folder.startswith('drawable') or not os.path.isfile(path):
            continue
        w, h = Image.open(path).size
        canvas = Image.new('RGBA', (w, h), CREAM)
        f = width(wordmark, round(min(w, h) * 0.7))
        canvas.alpha_composite(f, ((w - f.width) // 2, (h - f.height) // 2))
        canvas.convert('RGB').save(path, optimize=True)

# --- Hero banner -------------------------------------------------------------
banner = Image.open(os.path.join(SRC, 'foodnesi-hero.jpg')).convert('RGB')
banner.save(os.path.join(WEB, 'hero.webp'), quality=82, method=6)
# Phones: the bag with groceries (right part).
banner.crop((700, 0, 1463, banner.height)).save(os.path.join(WEB, 'hero-mobile.webp'), quality=82, method=6)

for name in sorted(os.listdir(WEB)):
    print(f'{name:32} {os.path.getsize(os.path.join(WEB, name)) // 1024} KB')
print('public icons, e-mail logo' + (', iOS icon/splash' if os.path.isdir(XC) else '') + (', Android icons/splash' if os.path.isdir(RES) else '') + ' written')
