"""Usage: python3 design/make_icons.py design/brand-source/Foodnesi_Logo.png public/brand

Build the Foodnesi icon set from the symbol in Foodnesi_Logo.png (white background → transparent)."""
import sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
logo = Image.open(src).convert('RGB')

def color_to_alpha(img):
    """Remove the white background: transparent only where the pixel is (nearly) white,
    so light colours (the leaf, the orange accents) stay fully opaque; anti-aliased
    edges are un-blended from white so they don't leave a light halo."""
    a = np.asarray(img).astype(np.float64) / 255.0
    dist = np.max(1.0 - a, axis=2)                       # 0 = white, 1 = far from white
    alpha = np.clip((dist - 0.03) / 0.17, 0, 1)          # ramp only over the edge band
    safe = np.where(alpha > 0, alpha, 1)
    unblended = np.clip((a - (1 - alpha[..., None])) / safe[..., None], 0, 1)
    rgb = np.where(alpha[..., None] < 1, unblended, a)
    rgba = np.dstack([rgb, alpha])
    return Image.fromarray((rgba * 255).round().astype(np.uint8), 'RGBA')

# Symbol: above the wordmark (y < 378) and left of the accent on the "i".
mark = color_to_alpha(logo.crop((0, 0, 720, 378)))
mark = mark.crop(mark.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
side = max(mark.size)
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2), mark)
sq.resize((256, 256), Image.LANCZOS).quantize(256, method=Image.Quantize.FASTOCTREE).save(f'{out}/foodnesi-mark.png', optimize=True)  # header/auth (≤ 64 px shown)

# Full logo with transparent background (for e-mails, documents, marketing).
full = color_to_alpha(logo)
full = full.crop(full.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
full.resize((480, round(full.height * 480 / full.width)), Image.LANCZOS).quantize(256, method=Image.Quantize.FASTOCTREE).save(f'{out}/foodnesi-logo.png', optimize=True)  # e-mail header

def icon(size, scale, bg=(255, 255, 255, 255), radius=0):
    canvas = Image.new('RGBA', (size, size), bg)
    inner = round(size * scale)
    m = sq.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - inner) // 2, (size - inner) // 2))
    return canvas

# App icons: opaque white tile, symbol at ~74% (iOS/Android round the corners themselves).
icon(180, 0.74).convert('RGB').save(f'{out}/../apple-touch-icon.png', optimize=True)
icon(192, 0.74).convert('RGB').save(f'{out}/../icon-192.png', optimize=True)
icon(512, 0.74).convert('RGB').save(f'{out}/../icon-512.png', optimize=True)
# Maskable: Android may crop to a circle — keep the symbol inside the 80% safe zone.
icon(512, 0.58).convert('RGB').save(f'{out}/../icon-maskable-512.png', optimize=True)
# Browser tab: transparent background, symbol fills the square.
fav = [icon(s, 0.96, bg=(0, 0, 0, 0)) for s in (16, 32, 48)]
fav[1].save(f'{out}/../favicon-32.png', optimize=True)
icon(256, 0.96, bg=(0, 0, 0, 0)).save(f'{out}/../favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
print('mark', sq.size, 'logo', full.size)
