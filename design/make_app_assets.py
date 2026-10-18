"""Usage: python3 design/make_app_assets.py  (run from the repo root or mobile/)

Builds the iOS app icon (1024×1024, opaque — App Store requirement) and the
launch screen image from public/brand/foodnesi-mark.png.
"""
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MARK = os.path.join(ROOT, 'public', 'brand', 'foodnesi-mark.png')
XC = os.path.join(ROOT, 'mobile', 'ios', 'App', 'App', 'Assets.xcassets')
CREAM = (250, 248, 242, 255)  # --background of the web app

mark = Image.open(MARK).convert('RGBA')


def compose(size: int, scale: float, bg) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), bg)
    inner = round(size * scale)
    m = mark.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - inner) // 2, (size - inner) // 2))
    return canvas.convert('RGB')


compose(1024, 0.74, (255, 255, 255, 255)).save(os.path.join(XC, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), optimize=True)
splash = compose(2732, 0.16, CREAM)
for name in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
    splash.save(os.path.join(XC, 'Splash.imageset', name), optimize=True)
print('iOS icon + splash written')
