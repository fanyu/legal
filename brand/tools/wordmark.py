#!/usr/bin/env python3
"""Shapes "flowwish" in EB Garamond Italic and prints its glyph outlines as JSON.

Only needed to redraw the wordmark; generate.py reads the committed result.
    python3 tools/wordmark.py EBGaramond-Italic.ttf | swift tools/outline.swift > source/wordmark.json

Needs fontTools, HarfBuzz's hb-shape and EB Garamond Italic (SIL OFL 1.1,
https://github.com/octaviopardo/EBGaramond12). The font itself is not kept here.
"""
import json
import subprocess
import sys

from fontTools.pens.basePen import BasePen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

TEXT = 'flowwish'   # default features keep the fl ligature
TRACKING = -8       # font units (1000/em)
EMBOLDEN = 34       # round-joined stroke width outline.swift adds around every glyph


class OpsPen(BasePen):
    """Records a glyph as absolute M/L/Q/C/Z operations (y down, baseline at 0)."""

    def __init__(self, glyph_set):
        super().__init__(glyph_set)
        self.ops = []

    def _moveTo(self, p): self.ops.append(['M', *p])
    def _lineTo(self, p): self.ops.append(['L', *p])
    def _qCurveToOne(self, p1, p2): self.ops.append(['Q', *p1, *p2])
    def _curveToOne(self, p1, p2, p3): self.ops.append(['C', *p1, *p2, *p3])
    def _closePath(self): self.ops.append(['Z'])
    def _endPath(self): self.ops.append(['Z'])


def main(font_path):
    font = TTFont(font_path)
    glyphs, order = font.getGlyphSet(), font.getGlyphOrder()
    shaped = json.loads(subprocess.check_output(
        ['hb-shape', '--features=kern', '--output-format=json', font_path, TEXT]))
    pen, x = OpsPen(glyphs), 0
    for g in shaped:
        name = g['g'] if g['g'] in glyphs else order[int(g['g'].removeprefix('gid'))]
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x + g['dx'], 0)))
        x += g['ax'] + TRACKING
    json.dump({'text': TEXT, 'embolden': EMBOLDEN, 'ops': pen.ops}, sys.stdout)


if __name__ == '__main__':
    main(sys.argv[1])
