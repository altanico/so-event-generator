#!/usr/bin/env python3
"""IVAO Italy sector file FRA.artcc -> data/acc.json: areas of responsibility of the 4 Italian ACCs (Milano LIMM, Padova LIPP, Roma LIRR, Brindisi LIBB).
Usage: python3 tools/acc_build.py [data/nav_src/FRA.artcc]
The file has the outer FRA boundary (closed ring "FRA IT - Zona A"), and the internal ACC lines ("CONFINI INTERNI": Padova from north to south,
Milano-Roma, Roma-Brindisi); L; lines = labels and DUMMY lines = breaks (ignored, staff 21 Nov). Points may be fix names (resolved with data/navdb.json).
Each ACC polygon = an internal line + the part of the outer ring between its two ends (the side that holds a reference point)."""
import re, json, sys, math
src = sys.argv[1] if len(sys.argv) > 1 else 'data/nav_src/FRA.artcc'
nav = json.load(open('data/navdb.json'))
pos = {}
for p in nav['pts']: pos.setdefault(p[0], (p[1], p[2]))
def coord(s):
    m = re.fullmatch(r'([NSEW])(\d{3})\.(\d{2})\.(\d{2}(?:\.\d+)?)', s.strip())
    if not m: return None
    v = int(m[2]) + int(m[3]) / 60 + float(m[4]) / 3600
    return -v if m[1] in 'SW' else v
blocks, cur, title, miss = {}, None, '', []
for l in open(src, encoding='utf-8', errors='replace'):
    s = l.strip()
    if s.startswith('//'):
        t = s.strip('/ ').strip()
        if t and not t.startswith('punto') and t != 'CONFINI INTERNI': title = t
        continue
    if not s.startswith('T;'): continue
    f = s.split(';')
    if f[1].upper() == 'DUMMY': cur = None; continue
    if f[1] != 'FRA BDRY': continue
    la, lo = coord(f[2]), coord(f[3])
    if la is None:
        if f[2] in pos: la, lo = pos[f[2]]
        else: miss.append(f[2]); continue
    if cur is None or cur[0] != title: cur = (title, []); blocks.setdefault(title, []).append(cur[1])
    cur[1].append((la, lo))
ring = blocks['FRA IT - Zona A'][0]
if ring[0] != ring[-1]: ring = ring + [ring[0]]
ring = ring[:-1]
def d2(a, b): return (a[0] - b[0]) ** 2 + ((a[1] - b[1]) * math.cos(math.radians(a[0]))) ** 2
def near(p): return min(range(len(ring)), key=lambda i: d2(ring[i], p))
def pip(p, poly):
    c = False; j = len(poly) - 1
    for i in range(len(poly)):
        (yi, xi), (yj, xj) = poly[i], poly[j]
        if (yi > p[0]) != (yj > p[0]) and p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi: c = not c
        j = i
    return c
def cut(line, ref):
    """polygon made by the line and the ring arc between its ends that contains ref"""
    a, b = near(line[0]), near(line[-1]); n = len(ring)
    arc1 = [ring[(b + k) % n] for k in range((a - b) % n + 1)]          # from b forward to a
    arc2 = [ring[(b - k) % n] for k in range((b - a) % n + 1)]          # from b backward to a
    for arc in (arc1, arc2):
        poly = line + arc
        if pip(ref, poly): return poly
    raise SystemExit('reference point outside both sides')
pad = blocks['PADOVA TUTTA da sud a nord'][0]; mr = blocks['MILANO-ROMA NE'][0]; rb = blocks['confine ROMA-BRINDISI'][0]
LIPP = cut(pad, (45.5, 12.3))                      # Venezia
LIBB = cut(rb, (40.65, 17.95))                     # Brindisi
# Milano: north of Milano-Roma and west of the Padova line -> cut the "west" part (ring minus Padova) with the Milano-Roma line
west = [p for p in ring if not pip(p, LIPP)]       # not used directly: build Milano as Milano-Roma line + ring arc + part of the Padova line
# Milano = Milano-Roma line (W -> E, ends on the Padova line at 44.39N 11.13E) + Padova line from that point up to its north end + ring arc back to the start
j = min(range(len(pad)), key=lambda i: d2(pad[i], mr[-1]))
pad_up = pad[:j + 1][::-1]                         # from the junction north to the Swiss border
nb, ns = near(pad[0]), near(mr[0]); n = len(ring)
arcA = [ring[(nb + k) % n] for k in range((ns - nb) % n + 1)]; arcB = [ring[(nb - k) % n] for k in range((nb - ns) % n + 1)]
LIMM = None
for arc in (arcA, arcB):
    poly = mr + pad_up + arc
    if pip((45.63, 8.72), poly): LIMM = poly; break   # Malpensa
def acc(p):
    if pip(p, LIPP): return 'LIPP'
    if pip(p, LIBB): return 'LIBB'
    if LIMM and pip(p, LIMM): return 'LIMM'
    return 'LIRR' if pip(p, ring) else None
r5 = lambda poly: [[round(a, 5), round(b, 5)] for a, b in poly]
out = {'src': 'IVAO Italy sector file FRA.artcc (outer FRA boundary + internal ACC lines)', 'ring': r5(ring), 'acc': {'LIPP': r5(LIPP), 'LIBB': r5(LIBB), 'LIMM': r5(LIMM)}, 'rest': 'LIRR'}
json.dump(out, open('data/acc.json', 'w'), separators=(',', ':'))
print('unresolved fix names:', miss)
tests = {'LIPL Ghedi': ((45.4322, 10.2677), 'LIMM'), 'LIBA Amendola': ((41.5414, 15.7181), 'LIRR'), 'LIPS Istrana': ((45.6848, 12.0857), 'LIPP'), 'LIBN Lecce': ((40.2392, 18.1333), 'LIBB'),
         'LIMC Malpensa': ((45.63, 8.72), 'LIMM'), 'LIRF Fiumicino': ((41.80, 12.25), 'LIRR'), 'LIPA Aviano': ((46.03, 12.60), 'LIPP'), 'LIPE Bologna': ((44.535, 11.289), None),
         'LIED Decimomannu': ((39.354, 8.972), 'LIRR'), 'LICZ Sigonella': ((37.40, 14.92), 'LIRR'), 'LIBD Bari': ((41.14, 16.76), 'LIBB'), 'LIRS Grosseto': ((42.76, 11.07), 'LIRR'), 'LIPC Cervia': ((44.22, 12.31), 'LIPP')}
for k, (p, exp) in tests.items(): print(f'{k:20s} -> {acc(p)}' + ('' if exp is None or acc(p) == exp else f'   (expected {exp}!)'))
