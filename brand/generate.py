#!/usr/bin/env python3
"""Builds the Flowwish logo kit (logos, avatars, profile banners) and the website's
logos, icons and share images.

    python3 brand/generate.py

The wordmark comes from source/wordmark.json and the shooting star from
source/meteor.json (redraw either with tools/). Writes brand/svg/ and brand/png/,
rewrites the inline logos in the site's HTML and the hero's entrance keyframes in
assets/site.css, and replaces assets/favicon.svg, favicon.ico, apple-touch-icon.png,
assets/og.png and assets/og-zh.png.
Needs rsvg-convert (librsvg) and Google Chrome.
"""
import json
import math
import random
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
# Colourways: file suffix -> (tail, star, wordmark) and the cut of the shooting star.
# One-colour versions use the mono cut, whose wider gap parts the star from the tail.
SCHEMES = {
    '': ((INK, VERMILION, INK), 'full'),                             # light backgrounds
    '-reverse': ((NIGHT_INK, NIGHT_VERMILION, NIGHT_INK), 'full'),   # dark backgrounds
    '-black': ((INK, INK, INK), 'mono'),
    '-white': (('#ffffff',) * 3, 'mono'),
}

WORD = json.loads((HERE / 'source/wordmark.json').read_text())   # font units, baseline y = 0
DOT = 9                     # the i's dot among the wordmark's subpaths; the star replaces it
# The shooting star in symbol units, in four cuts: full (64 px and up), mono (one colour),
# mid (32-64 px) and small (16-24 px), plus the star over the i (in font units) and the
# flight path of the star (s = 0 .. 1), which the homepage's entrance follows.
METEOR = json.loads((HERE / 'source/meteor.json').read_text())
STAR = METEOR['flight']['star']
NOTCH = (STAR[0] - 64.5, STAR[1] + 2.3)    # the star's back corner, where the tail goes in


def num(v):
    s = f'{v:.1f}'
    s = s[:-2] if s.endswith('.0') else s
    return '0' if s == '-0' else s


def placed(d, s, dx, dy):
    """Path data with absolute M/L coordinates, scaled by s and then moved by (dx, dy)."""
    return re.sub(r'(-?[\d.]+) (-?[\d.]+)', lambda m: f'{num(float(m[1]) * s + dx)} {num(float(m[2]) * s + dy)}', d)


class Art:
    """Logo parts in one coordinate space: (role, path data) plus the nominal bounds."""

    def __init__(self):
        self.parts, self.box = [], None

    def add(self, role, d, box):
        self.parts.append((role, d))
        b = self.box or box
        self.box = (min(b[0], box[0]), min(b[1], box[1]), max(b[2], box[2]), max(b[3], box[3]))
        return self

    def meteor(self, cut, x, y, s):
        """The shooting star with its star's centre at (x, y), scaled by s."""
        m, dx, dy = METEOR[cut], x - STAR[0] * s, y - STAR[1] * s
        box = (m['box'][0] * s + dx, m['box'][1] * s + dy, m['box'][2] * s + dx, m['box'][3] * s + dy)
        return self.add('tail', placed(m['tail'], s, dx, dy), box).add('star', placed(m['star'], s, dx, dy), box)

    def word(self, star=False):
        """The wordmark; with star=True the i is dotted with a small shooting star."""
        if not star:
            return self.add('word', WORD['d'], WORD['bbox'])
        body = ''.join(p for i, p in enumerate(re.findall(r'M[^M]*', WORD['d'])) if i != DOT)
        return self.add('word', body + METEOR['word']['flick'], WORD['bbox']).add('star', METEOR['word']['star'], WORD['bbox'])


# Lockups, in the wordmark's font units. The star sits by the top of the fl; the tail
# ends just under the baseline. Over the wordmark, the tail ends above the o.
H_STAR, H_SCALE = (-360, -480), 1.6
V_STAR, V_SCALE = (2060, -1531), 2.1


def horizontal(cut):
    return Art().meteor(cut, *H_STAR, H_SCALE).word()


def stacked(cut):
    return Art().meteor(cut, *V_STAR, V_SCALE).word()


def symbol(cut):
    return Art().meteor(cut, *STAR, 1)


def wordmark():
    return Art().word(star=True)


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
    fills = dict(zip(('tail', 'star', 'word'), colours))
    out += ''.join(f'<path fill="{fills[role]}" d="{d}"/>' for role, d in art.parts)
    return out + '</svg>\n'


def inline(art, cls):
    """Markup for the site: the tail and the wordmark follow currentColor, the star takes
    the page's --accent (CSS); the viewBox keeps the wordmark's font-unit coordinates."""
    x0, y0, x1, y1 = art.box
    v = (math.floor(x0), math.floor(y0), math.ceil(x1) - math.floor(x0), math.ceil(y1) - math.floor(y0))
    parts = dict(art.parts)
    star = f'<path class="star" fill="{VERMILION}" d="{parts["star"]}"/>'
    if 'tail' in parts:
        body = (f'<g class="meteor"><path class="tail" fill="currentColor" d="{parts["tail"]}"/>{star}</g>'
                f'<path fill="currentColor" d="{parts["word"]}"/>')
    else:       # the wordmark alone, its i dotted with the star
        body = f'<path fill="currentColor" d="{parts["word"]}"/>{star}'
    return f'<svg class="{cls}" viewBox="{" ".join(str(n) for n in v)}" aria-hidden="true">{body}</svg>'


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


# Avatars and icons: background -> (tail, star) colours. The night tile shows the
# vermilion star best, so it is the default avatar and the site icon.
TILES = {
    'tile': (TILE, (NIGHT_INK, NIGHT_VERMILION, None)),
    'paper': (PAPER, (INK, VERMILION, None)),
    'vermilion': (VERMILION, (PAPER, PAPER, None)),
}


def avatar(kind='tile', cut='full'):
    """Square, full bleed, with room for a circular crop."""
    bg, colours = TILES[kind]
    art = symbol('mono' if kind == 'vermilion' and cut == 'full' else cut)
    return svg(art, colours, pad=.2 * (art.box[2] - art.box[0]), square=True, bg=bg)


def favicon(cut):
    """The night tile with rounded corners, as browsers show a site icon."""
    art = symbol(cut)
    return svg(art, TILES['tile'][1], pad=.09 * (art.box[2] - art.box[0]), square=True, bg=TILE, radius=.2)


# ---------- profile banners ----------

def mix(a, b, t):
    """Colour a moved toward colour b by t."""
    a, b = (tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in (a, b))
    return '#' + ''.join(f'{round(p + (q - p) * t):02x}' for p, q in zip(a, b))


# Colourways: file suffix -> (tail, star, background), the cut, and how strongly the
# distant stars show (the range they are mixed toward the tail colour).
BANNERS = {
    '': ((INK, VERMILION, PAPER), 'full', (.12, .34)),
    '-dark': ((NIGHT_INK, NIGHT_VERMILION, TILE), 'full', (.25, .75)),
    '-vermilion': ((PAPER, PAPER, VERMILION), 'mono', (.22, .55)),
}
# Sizes: name -> (width, height, the band that holds the shooting star, or None for the whole image)
BANNER_SIZES = {
    '3x1': (1500, 500, None),                       # X, Bluesky, Mastodon
    '4x1': (1584, 396, None),                       # LinkedIn
    '16x9': (2560, 1440, (507, 508, 1546, 423)),    # YouTube: the band is what every device shows
}


def dot(x, y, r):
    return f'M{num(x - r)} {num(y)}a{num(r)} {num(r)} 0 1 0 {num(2 * r)} 0a{num(r)} {num(r)} 0 1 0 {num(-2 * r)} 0Z'


def banner(width, height, colours, cut, glow, band=None):
    """Profile header: the shooting star crosses a night of small distant stars. It sits in
    band (x, y, w, h), right of centre, away from avatars, which most sites place at the
    bottom left; the distant stars keep clear of both."""
    tail_c, star_c, bg = colours
    bx, by, bw, bh = band or (0, 0, width, height)
    u = bh / 500
    art = Art().meteor(cut, bx + .767 * bw, by + .38 * bh, .52 * u)
    x0, y0, x1, y1 = art.box
    clear = 40 * u
    rnd, dots = random.Random(4), []
    for _ in range(4000):
        if len(dots) >= round(28 * width * height / 750000):
            break
        px, py = rnd.uniform(.03, .97) * width, rnd.uniform(.06, .94) * height
        if x0 - clear < px < x1 + clear and y0 - clear < py < y1 + clear:
            continue                                    # the shooting star
        if px < .24 * width and py > .55 * height:
            continue                                    # the avatar
        if any(math.dist((px, py), (qx, qy)) < 70 * u for qx, qy, _, _ in dots):
            continue
        dots.append((px, py, rnd.uniform(1.1, 2.8) * u, rnd.randrange(3)))
    levels = [mix(bg, tail_c, glow[0] + (glow[1] - glow[0]) * i / 2) for i in range(3)]
    sky = ''.join(f'<path fill="{c}" d="{"".join(dot(px, py, r) for px, py, r, lv in dots if lv == i)}"/>'
                  for i, c in enumerate(levels))
    fills = {'tail': tail_c, 'star': star_c}
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"><title>Flowwish</title>'
            f'<rect width="{width}" height="{height}" fill="{bg}"/>{sky}'
            + ''.join(f'<path fill="{fills[role]}" d="{d}"/>' for role, d in art.parts) + '</svg>\n')


def kit():
    out_svg, out_png = HERE / 'svg', HERE / 'png'
    for d in (out_svg, out_png):
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir()
    files = {}
    for suffix, (colours, cut) in SCHEMES.items():
        files[f'flowwish-logo{suffix}'] = (svg(horizontal(cut), colours), 2400)
        files[f'flowwish-logo-stacked{suffix}'] = (svg(stacked(cut), colours), 1600)
        files[f'flowwish-symbol{suffix}'] = (svg(symbol(cut), colours), 1024)
        if suffix != '-black':      # the black wordmark is the colour one with an ink star
            files[f'flowwish-wordmark{suffix}'] = (svg(wordmark(), colours), 2000)
    files['flowwish-wordmark-black'] = (svg(wordmark(), (INK,) * 3), 2000)
    files['flowwish-avatar'] = (avatar(), 1024)
    files['flowwish-avatar-paper'] = (avatar('paper'), 1024)
    files['flowwish-avatar-vermilion'] = (avatar('vermilion'), 1024)
    files['flowwish-favicon'] = (favicon('mid'), 512)
    for suffix, (colours, cut, glow) in BANNERS.items():
        for size, (width, height, band) in BANNER_SIZES.items():
            files[f'flowwish-banner-{size}{suffix}'] = (banner(width, height, colours, cut, glow, band), width)
    for name, (text, width) in files.items():
        (out_svg / f'{name}.svg').write_text(text)
        png(text, out_png / f'{name}.png', width)
    for name in ('flowwish-avatar', 'flowwish-avatar-paper', 'flowwish-avatar-vermilion'):
        png(files[name][0], out_png / f'{name}-512.png', 512)
    return len(files)


# ---------- website ----------

SITE_MARKS = {
    'wm': lambda: inline(horizontal('mid'), 'wm'),                  # top bars, 25-30 px
    'wm wm-stack': lambda: inline(stacked('full'), 'wm wm-stack'),  # homepage hero
    'wm wm-word': lambda: inline(wordmark(), 'wm wm-word'),         # letterheads of the app pages
}


def site_html():
    marks = {cls: make() for cls, make in SITE_MARKS.items()}
    changed = 0
    for path in sorted(ROOT.rglob('*.html')):
        if path.relative_to(ROOT).parts[0] in ('dist', 'brand', 'node_modules', '.wrangler', '.git'):
            continue
        html = path.read_text()
        new = re.sub(r'<svg class="(wm(?: wm-stack| wm-word)?)"[^>]*>.*?</svg>', lambda m: marks[m.group(1)], html)
        if new != html:
            path.write_text(new)
            changed += 1
    return changed


def flight(s):
    """Point at s on the star's flight path, in the stacked logo's font units."""
    path = METEOR['flight']['path']
    i = min(int(s * (len(path) - 1)), len(path) - 2)
    f = s * (len(path) - 1) - i
    (ax, ay), (bx, by) = path[i], path[i + 1]
    return ((ax + (bx - ax) * f - STAR[0]) * V_SCALE + V_STAR[0], (ay + (by - ay) * f - STAR[1]) * V_SCALE + V_STAR[1])


def site_css(steps=12, start=.35):
    """Entrance keyframes for the hero: the star flies in along the last stretch of its
    flight path while the tail unfurls behind it, stretched along its chord from the star's
    back corner. Eased out by hand (linear timing between keyframes), in font units."""
    ox, oy = ((NOTCH[0] - STAR[0]) * V_SCALE + V_STAR[0], (NOTCH[1] - STAR[1]) * V_SCALE + V_STAR[1])
    end = flight(0)
    theta = math.degrees(math.atan2(oy - end[1], ox - end[0]))
    fly, tail = [], []
    for i in range(steps + 1):
        t = i / steps
        e = 1 - (1 - t) ** 3
        x, y = flight(start + (1 - start) * e)
        pct = f'{num(100 * t)}%'
        opacity = f' opacity: {num(t / .25)};' if t <= .25 else ''    # fades in over the first quarter
        fly.append(f'  {pct} {{ transform: translate({num(x - V_STAR[0])}px, {num(y - V_STAR[1])}px);{opacity} }}')
        k = f'{.15 + .85 * e:.3f}'.rstrip('0').rstrip('.')
        tail.append(f'  {pct} {{ transform: translate({num(ox)}px, {num(oy)}px) rotate({num(theta)}deg) scaleX({k}) '
                    f'rotate({num(-theta)}deg) translate({num(-ox)}px, {num(-oy)}px); }}')
    block = ('/* meteor keyframes: written by brand/generate.py */\n'
             '@keyframes meteor-in {\n' + '\n'.join(fly) + '\n}\n'
             '@keyframes tail-in {\n' + '\n'.join(tail) + '\n}\n'
             '/* end meteor keyframes */')
    css_path = ROOT / 'assets/site.css'
    css = css_path.read_text()
    new = re.sub(r'/\* meteor keyframes: written by brand/generate\.py \*/.*?/\* end meteor keyframes \*/', lambda _: block, css, flags=re.S)
    if new == css and block not in css:
        raise SystemExit('assets/site.css has no meteor keyframes block to replace')
    css_path.write_text(new)


OG_ICONS = [('reverie.jpg', ''), ('lull.jpg', ''), ('openpulse.png', ''), ('brightnessflow.png', 'pad-124'),
            ('markdownflow.svg', 'pad-124'), ('flow.png', ''), ('odo.png', ''), ('pastetrail.png', 'pad-116')]
OG_COPY = {
    'og.png': ('en', 'Independent apps for iPhone, iPad, Apple Watch and Mac.'),
    'og-zh.png': ('zh-Hans', '为 iPhone、iPad、Apple Watch 和 Mac 打造的独立 App。'),
}


def share_images():
    mark = inline(horizontal('full'), 'wm')
    icons = ''.join(f'<div class="shell"><img src="{(ROOT / "assets/apps" / f).as_uri()}"'
                    f'{f" class={c}" if c else ""}></div>' for f, c in OG_ICONS)
    for out, (lang, statement) in OG_COPY.items():
        html = f'''<!doctype html><html lang="{lang}"><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0}}
html,body{{width:1200px;height:630px;overflow:hidden}}
body{{display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse 70% 60% at 50% 30%,#faf8f3 0%,#f2efe8 70%);color:{INK};font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;-webkit-font-smoothing:antialiased}}
.logo{{font-size:132px;line-height:1;margin-top:-6px}}
.wm{{display:block;width:auto;height:1.033em}}
.star{{fill:{VERMILION}}}
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
    (ROOT / 'assets/favicon.svg').write_text(favicon('small').replace('<title>Flowwish</title>', ''))
    (ROOT / 'favicon.ico').write_bytes(ico([(16, favicon('small')), (32, favicon('small')), (48, favicon('mid'))]))
    png(avatar(cut='mid'), ROOT / 'apple-touch-icon.png', 180)   # full bleed; iOS rounds the corners


if __name__ == '__main__':
    n = kit()
    pages = site_html()
    site_css()
    site_icons()
    share_images()
    print(f'{n} kit files in brand/svg and brand/png; {pages} pages updated; keyframes, icons and share images written')
