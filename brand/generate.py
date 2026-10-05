#!/usr/bin/env python3
"""Builds the Flowwish logo kit (logos, avatars, profile banners) and the website's
logos, icons and share images.

    python3 brand/generate.py

The wordmark comes from source/wordmark.json (redraw it with tools/); the paper
boat is drawn here. Writes brand/svg/ and brand/png/, rewrites the inline logos
in the site's HTML, and replaces assets/favicon.svg, favicon.ico,
apple-touch-icon.png, assets/og.png and assets/og-zh.png.
Needs rsvg-convert (librsvg) and Google Chrome.
"""
import json
import math
import re
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

INK, VERMILION, PAPER = '#1b1c1f', '#d63f2a', '#f6f3ec'
NIGHT_INK, NIGHT_VERMILION, TILE = '#f2efe8', '#e8452c', '#17191e'
# Colourways: file suffix -> (hull, sail, wordmark) and the paper-fold gap between
# sail and hull. One-colour versions rely on the gap alone, so it is wider.
SCHEMES = {
    '': ((INK, VERMILION, INK), 24),                                 # light backgrounds
    '-reverse': ((NIGHT_INK, NIGHT_VERMILION, NIGHT_INK), 24),       # dark backgrounds
    '-black': ((INK, INK, INK), 30),
    '-white': (('#ffffff',) * 3, 30),
}

WORD = json.loads((HERE / 'source/wordmark.json').read_text())   # font units, baseline y = 0
ASCENDER = 700   # height of the fl ligature, which sizes the boat in the horizontal logo


# ---------- paper boat ----------

def inset(pts, d):
    """Offsets a simple polygon inward by d, keeping mitred corners."""
    n = len(pts)
    sign = 1 if sum(pts[i][0] * pts[i - n + 1][1] - pts[i - n + 1][0] * pts[i][1] for i in range(n)) > 0 else -1
    lines = []
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        length = math.hypot(dx, dy)
        lines.append(((x0 - dy / length * sign * d, y0 + dx / length * sign * d), (dx, dy)))
    out = []
    for i in range(n):
        (p, r), (q, t) = lines[i - 1], lines[i]
        u = ((q[0] - p[0]) * t[1] - (q[1] - p[1]) * t[0]) / (r[0] * t[1] - r[1] * t[0])
        out.append((p[0] + r[0] * u, p[1] + r[1] * u))
    return out


def boat(gap=0):
    """Hull and sail, 1000 wide, y down. The sail is equilateral; each hull side runs
    parallel to the opposite sail edge, and the hull's top edge reads as a W."""
    t = math.tan(math.radians(60))
    rim = 255 * t                       # sail base (half-width 255) below the apex
    tip, keel = rim - 95, rim + 175     # hull points rise 95 above the rim; hull depth 175
    xk = (keel - tip) / t
    hull = [(0, tip), (245, rim), (755, rim), (1000, tip), (1000 - xk, keel), (xk, keel)]
    sail = [(500, 0), (755, rim), (245, rim)]
    return (inset(hull, gap / 2), inset(sail, gap / 2)) if gap else (hull, sail)


BW, BH = 1000, 255 * math.tan(math.radians(60)) + 175


def num(v):
    s = f'{v:.1f}'
    s = s[:-2] if s.endswith('.0') else s
    return '0' if s == '-0' else s


class Art:
    """Logo parts in one coordinate space: (role, path data) plus the nominal bounds."""

    def __init__(self):
        self.parts, self.box = [], None

    def add(self, role, d, box):
        self.parts.append((role, d))
        b = self.box or box
        self.box = (min(b[0], box[0]), min(b[1], box[1]), max(b[2], box[2]), max(b[3], box[3]))
        return self

    def boat(self, x, y, s, gap):
        """Boat with its top-left corner at (x, y), scaled by s; gap in output units."""
        for role, pts in zip(('hull', 'sail'), boat(gap / s)):
            d = 'M' + 'L'.join(f'{num(x + px * s)} {num(y + py * s)}' for px, py in pts) + 'Z'
            self.add(role, d, (x, y, x + BW * s, y + BH * s))
        return self

    def word(self):
        return self.add('word', WORD['d'], WORD['bbox'])


def horizontal(gap):
    s = 1.05 * ASCENDER / BH
    return Art().boat(WORD['bbox'][0] - 150 - BW * s, 40 - BH * s, s, gap).word()  # keel 40 below the baseline


def stacked(gap):
    x0, y0, x1, _ = WORD['bbox']
    w = .42 * (x1 - x0)                 # boat width; +40 centres it optically over the italic
    return Art().boat((x0 + x1) / 2 - w / 2 + 40, y0 - 200 - BH * w / BW, w / BW, gap).word()


def symbol(gap):
    return Art().boat(0, 0, 1, gap)


def wordmark():
    return Art().word()


# ---------- output ----------

def svg(art, colours, pad=0, square=False, bg=None, radius=0, title=True):
    x0, y0, x1, y1 = art.box
    if square:
        side = max(x1 - x0, y1 - y0) + 2 * pad
        v = ((x0 + x1 - side) / 2, (y0 + y1 - side) / 2, side, side)
    else:
        v = (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)
    out = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(num(n) for n in v)}">'
    out += '<title>Flowwish</title>' if title else ''
    if bg:
        rx = f' rx="{num(radius * v[2])}"' if radius else ''
        out += f'<rect x="{num(v[0])}" y="{num(v[1])}" width="{num(v[2])}" height="{num(v[3])}"{rx} fill="{bg}"/>'
    fills = dict(zip(('hull', 'sail', 'word'), colours))
    out += ''.join(f'<path fill="{fills[role]}" d="{d}"/>' for role, d in art.parts)
    return out + '</svg>\n'


def inline(art, cls):
    """Markup for the site: hull and wordmark follow currentColor, the sail takes the
    page's --accent (CSS); the viewBox keeps the wordmark's font-unit coordinates."""
    x0, y0, x1, y1 = art.box
    v = (math.floor(x0), math.floor(y0), math.ceil(x1) - math.floor(x0), math.ceil(y1) - math.floor(y0))
    parts = dict(art.parts)
    return (f'<svg class="{cls}" viewBox="{" ".join(str(n) for n in v)}" aria-hidden="true">'
            f'<g class="boat"><path fill="currentColor" d="{parts["hull"]}"/>'
            f'<path class="sail" fill="{VERMILION}" d="{parts["sail"]}"/></g>'
            f'<path fill="currentColor" d="{parts["word"]}"/></svg>')


def png(svg_text, out, width, height=None):
    with tempfile.NamedTemporaryFile('w', suffix='.svg') as f:
        f.write(svg_text)
        f.flush()
        size = ['-w', str(width)] + (['-h', str(height)] if height else [])
        subprocess.run(['rsvg-convert', *size, f.name, '-o', str(out)], check=True)


def ico(sizes):
    """ICO with PNG payloads: sizes = [(px, svg)]."""
    images = []
    with tempfile.TemporaryDirectory() as tmp:
        for px, art in sizes:
            png(art, f'{tmp}/{px}.png', px, px)
            images.append((px, Path(f'{tmp}/{px}.png').read_bytes()))
    offset, entries = 6 + 16 * len(images), b''
    for px, data in images:
        entries += struct.pack('<BBBBHHII', px % 256, px % 256, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    return struct.pack('<HHH', 0, 1, len(images)) + entries + b''.join(data for _, data in images)


def avatar(dark=False):
    """Square, full-bleed: a paper-coloured boat on vermilion, or the dark tile."""
    colours = (NIGHT_INK, NIGHT_VERMILION, None) if dark else (PAPER, PAPER, None)
    return svg(symbol(30), colours, pad=.13 * BW, square=True, bg=TILE if dark else VERMILION)


def favicon(gap):
    return svg(symbol(gap), (PAPER, PAPER, None), pad=.06 * BW, square=True, bg=VERMILION, radius=.2)


# ---------- profile banners ----------

def mix(a, b, t):
    """Colour a moved toward colour b by t."""
    a, b = (tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in (a, b))
    return '#' + ''.join(f'{round(p + (q - p) * t):02x}' for p, q in zip(a, b))


# Colourways: file suffix -> (hull, sail, current, background) and the fold gap.
BANNERS = {
    '': ((INK, VERMILION, mix(INK, PAPER, .83), PAPER), 24),
    '-dark': ((NIGHT_INK, NIGHT_VERMILION, mix(TILE, NIGHT_INK, .16), TILE), 24),
    '-vermilion': ((PAPER, PAPER, mix(VERMILION, PAPER, .2), VERMILION), 30),
}
# Sizes: name -> (width, height, the band that holds the boat, or None for the whole image)
BANNER_SIZES = {
    '3x1': (1500, 500, None),                       # X, Bluesky, Mastodon
    '4x1': (1584, 396, None),                       # LinkedIn
    '16x9': (2560, 1440, (507, 508, 1546, 423)),    # YouTube: the band is what every device shows
}


def streamline(X, c, R):
    """Uniform flow past a circle of radius R: the y of the streamline psi = c at X."""
    if c < 0:
        return -streamline(X, -c, R)
    lo = math.sqrt(max(R * R - X * X, 0))
    hi = lo + c + R
    for _ in range(40):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if mid * (1 - R * R / (X * X + mid * mid)) < c else (lo, mid)
    return lo


def wake(cx, u):
    """x -> X in the flow round the circle. The horizontal scale is 2 ahead of the boat
    and eases to 4.6 behind it, so the current parts round the bow and closes in a long
    wake. X is the integral of dx / scale, which keeps the bow free of kinks."""
    a, b, L, x0 = 3.3, 1.3, 140 * u, cx - 100 * u      # scale = a - b tanh((x - x0) / L)
    def integral(x):
        t = (x - x0) / L
        m = abs(t)      # log(a cosh t - b sinh t), kept from overflowing
        log = m + math.log(((a - b) * math.exp(t - m) + (a + b) * math.exp(-t - m)) / 2)
        return L * (a * t + b * log) / (a * a - b * b)
    return lambda x: integral(x) - integral(cx)


def simplify(pts, tol):
    """Drop points that lie within tol of the line through their neighbours (Ramer-Douglas-Peucker)."""
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    dx, dy = x1 - x0, y1 - y0
    off = [abs(dy * (x - x0) - dx * (y - y0)) / math.hypot(dx, dy) for x, y in pts[1:-1]]
    if not off or max(off) <= tol:
        return [pts[0], pts[-1]]
    i = off.index(max(off)) + 1
    return simplify(pts[:i + 1], tol)[:-1] + simplify(pts[i:], tol)


def polyline(pts):
    r = [(round(x, 1), round(y, 1)) for x, y in pts]
    steps = ' '.join(f'{num(x - px)} {num(y - py)}' for (px, py), (x, y) in zip(r, r[1:]))
    return f'M{num(r[0][0])} {num(r[0][1])}l{steps}'


def banner(width, height, colours, gap, band=None):
    """Profile header: a current of fine lines parts around the boat and closes again
    behind it, so the boat sails right. The boat sits in band (x, y, w, h), right of
    centre, away from avatars, which most sites place at the bottom left."""
    hull_c, sail_c, line_c, bg = colours
    bx, by, bw, bh = band or (0, 0, width, height)
    u = bh / 500
    s = 200 * u / BW
    cx, keel = bx + .7 * bw, by + .62 * bh
    art = Art().boat(cx - BW * s / 2, keel - BH * s, s, gap * s)
    yc, R = keel - .47 * BH * s, .5 * BH * s + 16 * u      # the circle the current parts around
    X_of = wake(cx, u)
    step, spacing = 5 * u, 14 * u
    xs = [i * step for i in range(-1, int(width / step) + 2)]
    lines = []
    for i in range(math.floor(-yc / spacing) - 3, math.ceil((height - yc) / spacing) + 3):
        c, pts = (i + .5) * spacing, []
        for x in xs:
            X = X_of(x)
            Y = streamline(X, c, R)
            calm = 1 - math.exp(-(X * X + Y * Y) / (2.4 * R) ** 2)    # no swell next to the boat
            swell = (4.5 * u * (.65 + .35 * math.sin((x - cx) / (420 * u) + .8))
                     * math.sin(2 * math.pi * (x - cx) / (640 * u) + c / (95 * u)))
            pts.append((x, yc + Y + swell * calm))
        if any(-2 * u < y < height + 2 * u for _, y in pts):
            lines.append(polyline(simplify(pts, .1 * u)))
    boat_paths = ''.join(f'<path fill="{fill}" d="{d}"/>' for fill, (_, d) in zip((hull_c, sail_c), art.parts))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"><title>Flowwish</title>'
            f'<rect width="{width}" height="{height}" fill="{bg}"/>'
            f'<path fill="none" stroke="{line_c}" stroke-width="{num(1.4 * u)}" d="{"".join(lines)}"/>'
            f'{boat_paths}</svg>\n')


def kit():
    out_svg, out_png = HERE / 'svg', HERE / 'png'
    for d in (out_svg, out_png):
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir()
    files = {}
    for suffix, (colours, gap) in SCHEMES.items():
        files[f'flowwish-logo{suffix}'] = (svg(horizontal(gap), colours), 2400)
        files[f'flowwish-logo-stacked{suffix}'] = (svg(stacked(gap), colours), 1600)
        files[f'flowwish-symbol{suffix}'] = (svg(symbol(gap), colours), 1024)
        if suffix != '-black':      # the black wordmark is the colour one
            files[f'flowwish-wordmark{suffix}'] = (svg(wordmark(), colours), 2000)
    files['flowwish-avatar'] = (avatar(), 1024)
    files['flowwish-avatar-dark'] = (avatar(dark=True), 1024)
    files['flowwish-favicon'] = (favicon(44), 512)
    for suffix, (colours, gap) in BANNERS.items():
        for size, (width, height, band) in BANNER_SIZES.items():
            files[f'flowwish-banner-{size}{suffix}'] = (banner(width, height, colours, gap, band), width)
    for name, (text, width) in files.items():
        (out_svg / f'{name}.svg').write_text(text)
        png(text, out_png / f'{name}.png', width)
    for name in ('flowwish-avatar', 'flowwish-avatar-dark'):
        png(files[name][0], out_png / f'{name}-512.png', 512)
    return len(files)


# ---------- website ----------

SITE_MARKS = {
    'wm': lambda: inline(horizontal(36), 'wm'),               # letterheads and top bars, 25-30 px
    'wm wm-stack': lambda: inline(stacked(24), 'wm wm-stack'),  # homepage hero
}


def site_html():
    marks = {cls: make() for cls, make in SITE_MARKS.items()}
    changed = 0
    for path in sorted(ROOT.rglob('*.html')):
        if path.relative_to(ROOT).parts[0] in ('dist', 'brand', 'node_modules', '.wrangler', '.git'):
            continue
        html = path.read_text()
        new = re.sub(r'<svg class="(wm(?: wm-stack)?)"[^>]*>.*?</svg>', lambda m: marks[m.group(1)], html)
        if new != html:
            path.write_text(new)
            changed += 1
    return changed


OG_ICONS = [('reverie.jpg', ''), ('lull.jpg', ''), ('openpulse.png', ''), ('brightnessflow.png', 'pad-124'),
            ('markdownflow.svg', 'pad-124'), ('flow.png', ''), ('odo.png', ''), ('pastetrail.png', 'pad-116')]
OG_COPY = {
    'og.png': ('en', 'Independent apps for iPhone, iPad, Apple Watch and Mac.'),
    'og-zh.png': ('zh-Hans', '为 iPhone、iPad、Apple Watch 和 Mac 打造的独立 App。'),
}


def share_images():
    mark = inline(horizontal(24), 'wm')
    icons = ''.join(f'<div class="shell"><img src="{(ROOT / "assets/apps" / f).as_uri()}"'
                    f'{f" class={c}" if c else ""}></div>' for f, c in OG_ICONS)
    for out, (lang, statement) in OG_COPY.items():
        html = f'''<!doctype html><html lang="{lang}"><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0}}
html,body{{width:1200px;height:630px;overflow:hidden}}
body{{display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse 70% 60% at 50% 30%,#faf8f3 0%,#f2efe8 70%);color:{INK};font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;-webkit-font-smoothing:antialiased}}
.logo{{font-size:132px;line-height:1;margin-top:-6px}}
.wm{{display:block;width:auto;height:1.033em}}
.sail{{fill:{VERMILION}}}
.statement{{margin-top:30px;color:#45464b;font-size:31px;line-height:1.35;letter-spacing:-.012em}}
.icons{{display:flex;gap:22px;margin-top:50px}}
.shell{{position:relative;width:72px;height:72px}}
.shell img{{display:block;width:100%;height:100%;border-radius:22%;object-fit:cover;filter:drop-shadow(0 8px 8px #0000001f) drop-shadow(0 1px 1px #0000001f)}}
.shell img.pad-124{{position:absolute;width:124.2718%;height:124.2718%;left:-12.1359%;top:-12.1359%;border-radius:0}}
.shell img.pad-116{{position:absolute;width:116.3636%;height:116.3636%;left:-8.1818%;top:-9.0909%;border-radius:0}}
.url{{position:absolute;bottom:34px;color:#6b6b6b;font-size:21px;letter-spacing:.02em}}
.url::before{{content:"";display:inline-block;width:7px;height:7px;margin:0 12px 3px 0;border-radius:50%;background:{VERMILION}}}
</style><body><h1 class="logo">{mark}</h1><p class="statement">{statement}</p><div class="icons">{icons}</div><p class="url">flowwish.app</p></body></html>'''
        with tempfile.TemporaryDirectory() as tmp:
            src, shot = Path(tmp, 'og.html'), Path(tmp, 'og.png')
            src.write_text(html)
            subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                            '--virtual-time-budget=3000', '--window-size=1200,630', f'--screenshot={shot}', src.as_uri()],
                           check=True, capture_output=True)
            subprocess.run(['/usr/bin/sips', '-s', 'format', 'png', str(shot), '--out', str(ROOT / 'assets' / out)],
                           check=True, capture_output=True)


def site_icons():
    (ROOT / 'assets/favicon.svg').write_text(favicon(44).replace('<title>Flowwish</title>', ''))
    (ROOT / 'favicon.ico').write_bytes(ico([(16, favicon(64)), (32, favicon(44)), (48, favicon(36))]))
    png(avatar(), ROOT / 'apple-touch-icon.png', 180)   # full bleed; iOS rounds the corners


if __name__ == '__main__':
    n = kit()
    pages = site_html()
    site_icons()
    share_images()
    print(f'{n} kit files in brand/svg and brand/png; {pages} pages updated; icons and share images written')
