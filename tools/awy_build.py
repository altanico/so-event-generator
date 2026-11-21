#!/usr/bin/env python3
"""IVAO Italy sector file itawlow.lairway (lower ATS routes, FL195 and below) -> data/awy.json.
Usage: python3 tools/awy_build.py [data/nav_src/itawlow.lairway]
Needs data/nav.json (tools/nav_build.py). Output: {"awy": {name: [[seg points...], ...]}} where a
segment is a run of point idents between discontinuities (T;BREAK lines); points are resolved
against nav.json (fix / VOR / NDB) and the file's own 'Waypoint references'. Prints checks."""
import re, json, sys, math
src = sys.argv[1] if len(sys.argv) > 1 else 'data/nav_src/itawlow.lairway'
nav = json.load(open('data/nav.json'))
pos = {}
for k in ('vor', 'ndb', 'fix'):
    for p in nav[k]: pos.setdefault(p[0], (p[1], p[2], k))
def coord(s):
    m = re.fullmatch(r'([NSEW])(\d{3})\.(\d{2})\.(\d{2}(?:\.\d+)?)', s.strip())
    v = int(m[2]) + int(m[3]) / 60 + float(m[4]) / 3600
    return -v if m[1] in 'SW' else v
ref, awy, order, manual = {}, {}, [], set()
cur_manual = False
for l in open(src, encoding='utf-8', errors='replace'):
    s = l.strip()
    m = re.match(r'//([A-Z0-9]{2,5});([NS][\d.]+);([EW][\d.]+);', s)
    if m: ref[m[1]] = (coord(m[2]), coord(m[3])); continue
    if 'inserita manualmente' in s: cur_manual = True
    if s.startswith('//Airway tracks'): cur_manual = False
    if not s.startswith('T;'): continue
    f = s.split(';'); name, pt = f[1], f[2]
    if name == 'BREAK':
        if order: awy[order[-1]].append([])
        continue
    if name not in awy: awy[name] = [[]]; order.append(name)
    if cur_manual: manual.add(name)
    awy[name][-1].append(pt)
def nm(a, b): return math.hypot((a[0] - b[0]) * 60, (a[1] - b[1]) * 60 * math.cos(math.radians((a[0] + b[0]) / 2)))
miss, diff, long_, dupl = set(), [], [], []
for p, c in ref.items():
    if p in pos and nm(c, pos[p]) > 0.5: diff.append(f'{p}: ref {c[0]:.4f} {c[1]:.4f} vs nav {pos[p][0]:.4f} {pos[p][1]:.4f} ({nm(c, pos[p]):.1f} NM)')
def P(p): return pos[p][:2] if p in pos else ref.get(p)
for a, segs in awy.items():
    for sg in segs:
        for i, p in enumerate(sg):
            if P(p) is None: miss.add(p)
            if i and sg[i - 1] == p: dupl.append(f'{a} {p}')
        for x, y in zip(sg, sg[1:]):
            if P(x) and P(y) and nm(P(x), P(y)) > 200: long_.append(f'{a} {x}-{y} {nm(P(x), P(y)):.0f} NM')
        # zig-zag: a leg going back more than 120 deg against the previous one
        for x, y, z in zip(sg, sg[1:], sg[2:]):
            if all(map(P, (x, y, z))):
                a1 = math.atan2((P(y)[1] - P(x)[1]) * math.cos(math.radians(P(x)[0])), P(y)[0] - P(x)[0])
                a2 = math.atan2((P(z)[1] - P(y)[1]) * math.cos(math.radians(P(y)[0])), P(z)[0] - P(y)[0])
                d = abs((math.degrees(a2 - a1) + 180) % 360 - 180)
                if d > 120: long_.append(f'{a} {x}-{y}-{z} turn {d:.0f}°')
out = {'src': 'IVAO Italy sector file itawlow.lairway (lower routes)', 'manual': sorted(manual),
       'awy': {a: [s for s in segs if len(s) > 1] for a, segs in awy.items()},
       'extra': {p: [round(c[0], 6), round(c[1], 6)] for p, c in ref.items() if p not in pos}}
json.dump(out, open('data/awy.json', 'w'), separators=(',', ':'))
print(len(awy), 'routes,', sum(len(s) - 1 for v in out['awy'].values() for s in v), 'legs;', len(out['extra']), 'points only in the file references')
print('unresolved:', sorted(miss)); print('ref vs nav.json:', diff); print('duplicates:', dupl)
print('suspicious:'); [print(' ', x) for x in long_]
