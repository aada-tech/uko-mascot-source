#!/usr/bin/env python3
"""Inuko — neutral sitting pose, generated as a layered SVG.

Every part is its own named group (ready for rigging: spine, neck, head,
ears, front legs × 3 segments, hind legs, tail). The white "sticker" outline
is built from the same silhouette shapes, so it always follows them and keeps
the black coat readable on dark backgrounds.

    python3 inuko/art/build_neutral.py   → inuko/art/inuko-neutral.svg
"""
from pathlib import Path

INK, COAT, TAN, TAN_L = '#232329', '#3A3B42', '#C98A4B', '#E0A769'
COLLAR, TAG, BLUSH, NOSE = '#36B39A', '#FFC93C', '#F4A0A8', '#1E1E22'
STICKER = '#FFFFFF'
HEAD_TF = 'translate(512 340) scale(1.07) translate(-512 -316)'   # bigger head, sitting lower (kawaii ratio)

def mirror(d):
    """Mirror an absolute path (M/C/L/Z with space-separated numbers) around x = 512."""
    out, toks, i = [], d.split(), 0
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            out.append(t); i += 1; continue
        x, y = float(toks[i]), toks[i + 1]
        out += [f'{1024 - x:g}', y]; i += 2
    return ' '.join(out)

# ---------------------------------------------------------------- silhouette parts
TAIL = 'M 596 846 C 650 900 736 910 792 884 C 822 870 836 840 826 812 C 816 830 802 846 780 852 C 728 868 664 860 612 826 Z'
BODY = 'M 428 520 C 392 580 374 652 374 728 C 374 806 418 876 512 878 C 606 876 650 806 650 728 C 650 652 632 580 596 520 Z'
HEAD = 'M 512 146 C 628 146 712 214 714 322 C 716 414 644 484 512 486 C 380 484 308 414 310 322 C 312 214 396 146 512 146 Z'
EAR_L = 'M 372 262 C 334 188 314 108 326 38 C 382 72 446 136 470 190 Z'
EAR_L_IN = 'M 384 230 C 362 178 350 120 356 80 C 390 108 422 146 442 190 Z'
LEG_L = 'M 432 694 C 430 740 432 800 436 858 L 500 858 C 504 800 506 740 502 694 Z'
SOCK_L = 'M 435 790 C 435 812 436 836 436 856 L 500 856 C 501 836 502 812 502 790 C 482 802 456 802 435 790 Z'
THIGH_L = (384, 786, 114, 102, -12)
HIND_PAW_L = (342, 878, 64, 28)
FRONT_PAW_L = (467, 872, 51, 27)

def ellipse(c, cls, extra=''):
    cx, cy, rx, ry, *rot = c
    tr = f' transform="rotate({rot[0]} {cx} {cy})"' if rot else ''
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"{tr} {cls}{extra}/>'

def m_ellipse(c):
    cx, cy, rx, ry, *rot = c
    return (1024 - cx, cy, rx, ry, *([-rot[0]] if rot else []))

F = lambda color: f'fill="{color}"'
S = f'stroke="{INK}" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"'
LINE = f'fill="none" stroke="{INK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"'

def sticker():
    """Thick white outline of the whole silhouette (drawn first)."""
    o = f'fill="{STICKER}" stroke="{STICKER}" stroke-width="30" stroke-linejoin="round"'
    shapes = [f'<path d="{TAIL}" {o}/>', ellipse(THIGH_L, o), ellipse(m_ellipse(THIGH_L), o),
              f'<path d="{BODY}" {o}/>', ellipse(HIND_PAW_L, o), ellipse(m_ellipse(HIND_PAW_L), o),
              ellipse(FRONT_PAW_L, o), ellipse(m_ellipse(FRONT_PAW_L), o),
              ]
    head = f'<g transform="{HEAD_TF}"><path d="{EAR_L}" {o}/><path d="{mirror(EAR_L)}" {o}/><path d="{HEAD}" {o}/></g>'
    return '<g id="sticker_outline">' + ''.join(shapes) + head + '</g>'

def front_leg(side):
    leg, sock = (LEG_L, SOCK_L) if side == 'L' else (mirror(LEG_L), mirror(SOCK_L))
    # Only the two sides are stroked: the top melts into the chest.
    xs = [432, 502] if side == 'L' else [1024 - 432, 1024 - 502]
    x0, x1 = xs
    sides = f'M {x0} 694 C {x0 - 2 if side == "L" else x0 + 2} 720 {x0} 792 {x0 + (4 if side == "L" else -4)} 858 M {x1} 694 C {x1 + 4 if side == "L" else x1 - 4} 720 {x1 + 2 if side == "L" else x1 - 2} 792 {x1 - 2 if side == "L" else x1 + 2} 858'
    paw = FRONT_PAW_L if side == 'L' else m_ellipse(FRONT_PAW_L)
    toes = [paw[0] - 13, paw[0] + 13]
    return (f'<g id="front_leg_{side}"><path d="{leg}" {F(COAT)}/><path d="{sock}" {F(TAN)}/>'
            f'<path d="{sides}" {LINE} stroke-width="11"/></g>'
            f'<g id="front_paw_{side}">{ellipse(paw, F(TAN), " " + S)}'
            f'<path d="M {toes[0]} {paw[1] - 11} L {toes[0]} {paw[1] + 12} M {toes[1]} {paw[1] - 11} L {toes[1]} {paw[1] + 12}" {LINE}/></g>')

def hind(side):
    th = THIGH_L if side == 'L' else m_ellipse(THIGH_L)
    return f'<g id="hind_leg_{side}">{ellipse(th, F(COAT), " " + S)}</g>'

def hind_paw(side):
    p = HIND_PAW_L if side == 'L' else m_ellipse(HIND_PAW_L)
    return (f'<g id="hind_paw_{side}">{ellipse(p, F(TAN), " " + S)}'
            f'<path d="M {p[0] - 12} {p[1] - 12} L {p[0] - 11} {p[1] + 12} M {p[0] + 12} {p[1] - 12} L {p[0] + 12} {p[1] + 12}" {LINE}/></g>')

def eye(side):
    cx = 448 if side == 'L' else 576
    return (f'<g id="eye_{side}"><ellipse cx="{cx}" cy="338" rx="33" ry="40" fill="{NOSE}"/>'
            f'<circle cx="{cx - 12}" cy="322" r="12.5" fill="#fff"/><circle cx="{cx + 11}" cy="353" r="5" fill="#fff"/></g>')

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-labelledby="t">
  <title id="t">Inuko — pose neutre (assis)</title>
  <!-- Generated by build_neutral.py — edit the script, not this file. -->
  <ellipse id="shadow" cx="512" cy="908" rx="270" ry="24" fill="{INK}" opacity=".12"/>
  {sticker()}
  <g id="tail"><path d="{TAIL}" {F(COAT)} {S}/></g>
  {hind('L')}{hind('R')}
  <g id="body">
    <path d="{BODY}" {F(COAT)} {S}/>
    <path id="chest_heart" {F(TAN)} d="M 512 684 C 478 661 455 636 465 611 C 473 592 499 592 512 611 C 525 592 551 592 559 611 C 569 636 546 661 512 684 Z"/>
  </g>
  {hind_paw('L')}{hind_paw('R')}
  {front_leg('L')}{front_leg('R')}
  <g id="collar">
    <path fill="{COLLAR}" {S} d="M 412 512 C 470 546 554 546 612 512 L 618 542 C 556 580 468 580 406 542 Z"/>
    <circle id="tag" cx="512" cy="576" r="19" fill="{TAG}" stroke="{INK}" stroke-width="8"/>
  </g>
  <g id="head" transform="{HEAD_TF}">
    <g id="ear_L"><path d="{EAR_L}" {F(COAT)} {S}/><path d="{EAR_L_IN}" {F(TAN_L)}/></g>
    <g id="ear_R"><path d="{mirror(EAR_L)}" {F(COAT)} {S}/><path d="{mirror(EAR_L_IN)}" {F(TAN_L)}/></g>
    <path id="skull" d="{HEAD}" {F(COAT)} {S}/>
    <path id="muzzle" {F(TAN)} d="M 400 394 C 416 352 470 348 512 362 C 554 348 608 352 624 394 C 636 444 582 480 512 482 C 442 480 388 444 400 394 Z"/>
    <ellipse id="brow_L" cx="446" cy="280" rx="21" ry="14" {F(TAN)}/>
    <ellipse id="brow_R" cx="578" cy="280" rx="21" ry="14" {F(TAN)}/>
    {eye('L')}{eye('R')}
    <ellipse id="blush_L" cx="402" cy="408" rx="27" ry="14" fill="{BLUSH}" opacity=".8"/>
    <ellipse id="blush_R" cx="622" cy="408" rx="27" ry="14" fill="{BLUSH}" opacity=".8"/>
    <path id="nose" fill="{NOSE}" d="M 485 384 C 485 368 539 368 539 384 C 539 400 523 412 512 412 C 501 412 485 400 485 384 Z"/>
    <ellipse cx="503" cy="380" rx="8" ry="4.5" fill="#fff" opacity=".6"/>
    <path id="mouth" {LINE} d="M 512 412 L 512 426 M 485 422 C 491 443 508 443 512 426 C 516 443 533 443 539 422"/>
  </g>
</svg>
'''
out = Path(__file__).with_name('inuko-neutral.svg')
out.write_text(svg)
print(f'wrote {out.name} ({len(svg)} bytes)')
