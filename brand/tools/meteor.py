#!/usr/bin/env python3
"""Draws the Flowwish shooting star and prints its outlines as JSON.

Only needed to redraw the mark; generate.py reads the committed result.
    cd brand && python3 tools/meteor.py > source/meteor.json

Needs shapely (pip install shapely). The symbol is drawn in a space about 1000
units across, y down. The star that dots the i of the wordmark is drawn in the
wordmark's font units, so it lands on the i without further placement.
"""
import json
import math
import random

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

LEAN = 16                   # the wordmark's italic angle; the star leans by the same amount
TOP = -90 + LEAN            # direction of the star's top tip (screen degrees, y down)
FWD = TOP + 72              # its forward tip, which points along the flight
C, R = (730, 320), 150      # star centre and radius in the symbol
WORD_C, WORD_R = (2468, -604), 122   # the star over the i, in wordmark font units


# ---------- geometry ----------

class Path:
    """A polyline resampled by arc length: at(s) for s in [0, 1] gives point, tangent, normal."""

    def __init__(self, pts):
        self.pts, self.L = pts, [0.0]
        for p, q in zip(pts, pts[1:]):
            self.L.append(self.L[-1] + math.dist(p, q))
        self.total = self.L[-1]

    def at(self, s):
        d = max(0, min(1, s)) * self.total
        lo, hi = 0, len(self.L) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            lo, hi = (mid, hi) if self.L[mid] < d else (lo, mid)
        (ax, ay), (bx, by) = self.pts[lo], self.pts[hi]
        f = (d - self.L[lo]) / ((self.L[hi] - self.L[lo]) or 1)
        tx, ty = bx - ax, by - ay
        n = math.hypot(tx, ty) or 1
        return (ax + tx * f, ay + ty * f), (tx / n, ty / n), (-ty / n, tx / n)


def flight(end, length, k_star, k_tail, power=1.5, n=1200):
    """The tail's centreline: it arrives at `end` heading FWD, nearly straight there, and
    bends more and more toward the far end (curvature k_star at the star, k_tail at the end).
    s = 0 is the far end, s = 1 the star."""
    th, (x, y), ds, pts = math.radians(FWD), end, length / n, [end]
    for i in range(n):
        th -= (k_star + (k_tail - k_star) * ((i + .5) / n) ** power) * ds
        x, y = x - math.cos(th) * ds, y - math.sin(th) * ds
        pts.append((x, y))
    return Path(pts[::-1])


def arc(end, rho, span, n=800):
    """Circular arc of radius rho arriving at `end` heading FWD, sweeping `span` degrees."""
    a = math.radians(FWD)
    cx, cy = end[0] - rho * math.sin(a), end[1] + rho * math.cos(a)
    e = math.atan2(end[1] - cy, end[0] - cx)
    return Path([(cx + rho * math.cos(e - math.radians(span) * (1 - i / n)),
                  cy + rho * math.sin(e - math.radians(span) * (1 - i / n))) for i in range(n + 1)])


def ribbon(path, s0, s1, lo, hi, n=160):
    """Band between the offsets lo(s) and hi(s) from the path, for s in [s0, s1]."""
    a, b = [], []
    for i in range(n + 1):
        s = min(1.0, max(0.0, s0 + (s1 - s0) * i / n))
        (x, y), _, (nx, ny) = path.at(s)
        a.append((x + nx * lo(s), y + ny * lo(s)))
        b.append((x + nx * hi(s), y + ny * hi(s)))
    return Polygon(a + b[::-1]).buffer(0)


def star(centre, r_out, ratio, concave, tip, inner):
    """Five-point star leaning LEAN degrees, sides bowed inward by `concave` of their length,
    tips rounded by `tip` and inner corners by `inner` (fractions of r_out)."""
    cx, cy = centre
    pts = []
    for k in range(10):
        a0, a1 = math.radians(TOP + k * 36), math.radians(TOP + (k + 1) * 36)
        r0, r1 = (r_out, r_out * ratio) if k % 2 == 0 else (r_out * ratio, r_out)
        p, q = (cx + r0 * math.cos(a0), cy + r0 * math.sin(a0)), (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1))
        mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        dx, dy = cx - mx, cy - my
        dl = math.hypot(dx, dy)
        c = (mx + dx / dl * concave * math.dist(p, q), my + dy / dl * concave * math.dist(p, q))
        for i in range(24):
            t = i / 24
            pts.append(((1 - t) ** 2 * p[0] + 2 * (1 - t) * t * c[0] + t * t * q[0],
                        (1 - t) ** 2 * p[1] + 2 * (1 - t) * t * c[1] + t * t * q[1]))
    poly = Polygon(pts)
    poly = poly.buffer(-tip * r_out, join_style='round').buffer(tip * r_out, join_style='round')
    return poly.buffer(inner * r_out, join_style='round').buffer(-inner * r_out, join_style='round')


def profile(wmax, power=1.1, shoulder=.84, waist=.06):
    """Width of the tail along s: from a point at the far end to wmax at the shoulder."""
    def width(s):
        if s >= shoulder:
            return wmax
        x = s / shoulder
        return wmax * x ** power * (1 - waist * math.sin(math.pi * x))
    return width


def clean(geom, close=.9, min_hole=30, min_part=4):
    """Fuses hairline seams between touching bristles and drops specks and pinholes."""
    g = geom.buffer(close, quad_segs=8).buffer(-close, quad_segs=8)
    out = []
    for p in ([g] if isinstance(g, Polygon) else list(g.geoms)):
        if p.area >= min_part:
            out.append(Polygon(p.exterior, [h for h in p.interiors if Polygon(h).area >= min_hole]))
    return unary_union(out)


def dry_brush(path, width, bristles=9, seed=77, lenses=26, split=.24, spread=.5, wobble=.012,
              gap=(.03, .075), starts=(.04, .56), lengths=(.08, .22)):
    """飞白: a stroke of bristles that runs solid by the star and dries toward the far end.
    Lens-shaped streaks of paper open and close between bristles; every bristle parts in
    the last stretch, the bristles splay a little, and the outer edges waver slightly."""
    rnd = random.Random(seed)
    cuts = sorted(-1 + 2 * (j + rnd.uniform(-.3, .3)) / bristles for j in range(1, bristles))
    edges = [-1] + cuts + [1]
    streaks = []
    for _ in range(lenses):
        j, a = rnd.randrange(len(cuts)), rnd.uniform(*starts)
        streaks.append((j, a, min(.74, a + rnd.uniform(*lengths)), rnd.uniform(*gap)))
    endgap = [rnd.uniform(.10, .22) for _ in cuts]

    def half_gap(j, s):
        g = max([m * math.sin(math.pi * (s - a) / (b - a)) for jj, a, b, m in streaks if jj == j and a < s < b] + [0])
        return max(g, endgap[j] * ((split - s) / split) ** 1.1) if s < split else g

    ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    def fan(s): return 1 + spread * (1 - s) ** 2.4
    def waver(s): return 1 + wobble * (math.sin(9 * s + ph[0]) + .6 * math.sin(17 * s + ph[1]))

    bands = []
    for k in range(bristles):
        mid = (edges[k] + edges[k + 1]) / 2
        s0, taper = .30 * abs(mid) ** 1.2 + rnd.uniform(0, .10), .07 + rnd.uniform(0, .06)

        def side(s, k=k):
            w = width(s) / 2 * fan(s)
            lo = (edges[k] + (half_gap(k - 1, s) if k > 0 else 0)) * w * (waver(s) if k == 0 else 1)
            hi = (edges[k + 1] - (half_gap(k, s) if k < bristles - 1 else 0)) * w * (waver(s + .3) if k == bristles - 1 else 1)
            return lo, hi

        def lo(s, k=k, s0=s0, taper=taper):   # each bristle starts in a point
            a, c = side(s, k)
            return (a + c) / 2 + (a - c) / 2 * min(1, max(0, (s - s0) / taper)) ** .55

        def hi(s, k=k, s0=s0, taper=taper):
            a, c = side(s, k)
            return (a + c) / 2 + (c - a) / 2 * min(1, max(0, (s - s0) / taper)) ** .55
        bands.append(ribbon(path, s0, 1, lo, hi, n=480))
    return clean(unary_union(bands))


def solid(path, width):
    return ribbon(path, 0, 1, lambda s: -width(s) / 2, lambda s: width(s) / 2, n=260)


def to_d(geom, tol, prec=1):
    """Path data for a polygon or multipolygon, simplified within tol."""
    geom = geom.simplify(tol, preserve_topology=True)
    out = []
    for p in ([geom] if isinstance(geom, Polygon) else list(geom.geoms)):
        for ring in [p.exterior, *p.interiors]:
            out.append('M' + 'L'.join(f'{x:.{prec}f} {y:.{prec}f}' for x, y in list(ring.coords)[:-1]) + 'Z')
    return ''.join(out).replace('.0 ', ' ').replace('.0L', 'L').replace('.0Z', 'Z')


def cut(tail, st, gap, tol):
    """Tail and star with a paper gap between them, as path data plus their bounds."""
    tail = tail.difference(st.buffer(gap, join_style='round'))
    return {'tail': to_d(tail, tol), 'star': to_d(st, .08),
            'box': [round(v, 1) for v in unary_union([tail, st]).bounds]}


# ---------- the cuts ----------

def main():
    big = star(C, R, ratio=.43, concave=.08, tip=.03, inner=.02)
    path = flight(C, 820, .6 / 560, 1.5 / 560)
    out = {
        # 64 px and up: the full dry brush
        'full': cut(dry_brush(path, profile(124)), big, 15, .3),
        # one-colour versions: the same brush with a wider gap, since colour no longer parts star and tail
        'mono': cut(dry_brush(path, profile(124)), big, 22, .3),
        # 32-64 px: a few long streaks and the split end
        'mid': cut(dry_brush(path, profile(136, 1.0), lenses=4, gap=(.05, .07), split=.30, spread=.42), big, 22, .6),
    }
    # 16-24 px: a bigger star and a short solid tail
    small_c = (640, 400)
    small = star(small_c, 226, ratio=.47, concave=.03, tip=.05, inner=.03)
    out['small'] = cut(solid(flight(small_c, 540, .7 / 470, 1.6 / 470), profile(190, .95, .8, 0)), small, 32, .25)
    # the star over the i, with a short flick of tail
    word_star = star(WORD_C, WORD_R, ratio=.44, concave=.07, tip=.03, inner=.02)
    flick = dry_brush(arc(WORD_C, 620, 24), profile(92, 1.0), bristles=5, seed=13, lenses=2, gap=(.05, .07), split=.45)
    flick = flick.difference(word_star.buffer(13, join_style='round'))
    out['word'] = {'star': to_d(word_star, .08), 'flick': to_d(flick, .25),
                   'box': [round(v, 1) for v in unary_union([flick, word_star]).bounds]}
    # the flight path, for the homepage's entrance animation: s = 0 .. 1 in 40 steps
    out['flight'] = {'star': list(C), 'path': [[round(v, 1) for v in path.at(i / 40)[0]] for i in range(41)]}
    print(json.dumps(out, separators=(',', ':')))


if __name__ == '__main__':
    main()
