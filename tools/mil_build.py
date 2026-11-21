#!/usr/bin/env python3
"""IVAO Italy sector file MIL.fix (unpublished military points) -> data/mil_fix.json.
Usage: python3 tools/mil_build.py [data/nav_src/MIL.fix]
Entry: [ident, lat, lon, aerodrome ICAO or '', category] with category
  ARR = military aerodrome VFR/IFR points, IAF = IAF / TACAN approach points of military aerodromes,
  BE = military air defence bullseyes. All points are UNPUBLISHED (not in the AIP); usable by IFR and VFR flights."""
import re, json, sys
src = sys.argv[1] if len(sys.argv) > 1 else 'data/nav_src/MIL.fix'
def coord(s):
    s = s.strip(); m = re.fullmatch(r'([NSEW])(\d{3})\.(\d{2})\.(\d{2}(?:\.\d+)?)', s)
    if m: v = int(m[2]) + int(m[3]) / 60 + float(m[4]) / 3600
    else:
        m = re.fullmatch(r'([NSEW])(\d{3})(\d{2})(\d{2})(\d{3})', s)
        if m: v = int(m[2]) + int(m[3]) / 60 + (int(m[4]) + int(m[5]) / 1000) / 3600
        else: return float(s)                      # plain decimal degrees
    return round(-v if m[1] in 'SW' else v, 6)
out, warn, cat, ad = [], [], 'ARR', ''
for n, l in enumerate(open(src, encoding='utf-8', errors='replace'), 1):
    l = l.strip()
    if not l: continue
    if l.startswith('//'):
        if 'IAF' in l: cat = 'IAF'
        elif 'BULLSEYE' in l: cat, ad = 'BE', ''
        m = re.search(r'<!?-*(LI[A-Z]{2})', l)
        if m: ad = m[1]
        continue
    f = [x.strip() for x in l.split(';')]
    try: out.append([f[0], coord(f[1]), coord(f[2]), ad, cat])
    except Exception as e: warn.append(f'line {n}: {l} ({e})')
bad = [p for p in out if not (35 <= p[1] <= 48 and 6 <= p[2] <= 19)]
json.dump({'src': 'IVAO Italy sector file MIL.fix', 'published': False, 'fix': out}, open('data/mil_fix.json', 'w'), separators=(',', ':'))
from collections import Counter
print(len(out), 'points', dict(Counter(p[4] for p in out)), 'outside Italy:', bad, 'warnings:', warn)
