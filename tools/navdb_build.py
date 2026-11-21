#!/usr/bin/env python3
"""Combine the navigation data into one file loaded by the app: data/navdb.json.
Usage: python3 tools/navdb_build.py   (after nav_build / vrp_build / mil_build / vfi_build / awy_build)
pts: [ident, lat, lon, kind, info]
  kind V = VOR / DME / TACAN (info "freq type ch"), N = NDB (info freq), F = fix (info "E|T|B|H" + "*" when FRA point),
  A = airway point known only from the airway file, R = AIP VRP (info "name"), M = military procedure point (info "AD"),
  G = military gate / unpublished VRP (info "AD|name"). awy: {route: [[idents...], ...]} lower ATS routes (FL195 and below)."""
import json
nav = json.load(open('data/nav.json')); vrp = json.load(open('data/vrp.json')); mf = json.load(open('data/mil_fix.json'))
mv = json.load(open('data/mil_vfr.json')); aw = json.load(open('data/awy.json'))
pts = []
for v in nav['vor']:
    pts.append([v[0], v[1], v[2], 'V', ' '.join(x for x in (v[3], v[4], v[5]) if x) + (' out' if v[7] else '')])
for n in nav['ndb']: pts.append([n[0], n[1], n[2], 'N', n[3]])
for f in nav['fix']:
    pts.append([f[0], f[1], f[2], 'F', f[3] + ('*' if f[4] else '')])
have = {p[0] for p in pts}
for k, c in aw['extra'].items():
    if k not in have: pts.append([k, c[0], c[1], 'A', ''])
for v in vrp['vrp']: pts.append([v[0], v[2], v[3], 'R', v[1]])
for p in mf['fix']:
    if p[4] != 'BE': pts.append([p[0], p[1], p[2], 'M', p[3]])
for p in mv['pts']: pts.append([p[0], p[2], p[3], 'G', p[4] + '|' + p[1]])
for p in pts: p[1], p[2] = round(p[1], 5), round(p[2], 5)
out = {'airac': '2612', 'src': 'IVAO Italy sector files (AIRAC 2612), AIP Italia ENR 6.3.1', 'pts': pts, 'awy': aw['awy'], 'manual': aw['manual']}
json.dump(out, open('data/navdb.json', 'w'), separators=(',', ':'), ensure_ascii=False)
from collections import Counter
print(len(pts), dict(Counter(p[3] for p in pts)), len(aw['awy']), 'routes')
