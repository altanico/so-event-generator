#!/usr/bin/env python3
"""Navigation database for the SO event generator from the IVAO Italy sector files (data/nav_src: *.vor, *.ndb, *.fix).
Formats (semicolon separated, // = comment):
  VOR (IVAO sector file spec): ident;freq;lat;lon;[visibility 0 show / 1 hide];[type 0 VOR, 1 VORDME, 2 VORTACAN, 3 TACAN, 4 DME];[TACAN channel];[HLD-…]
  NDB: ident;freq kHz;lat;lon;[1 = outside Italy]
  FIX (IVAO spec): ident;lat;lon;type 0 enroute / 1 terminal / 2 both / 3 hidden;boundary 0 / 1;[HLD-… = holding published, ignored for now]
Coordinates: N045.55.27.600 = 45°55'27.6". Output: data/nav.json {airac, vor[], ndb[], fix[]} with [ident, lat, lon, ...]. Usage: python3 tools/nav_build.py 2612"""
import json, os, re, sys
SRC = os.path.join(os.path.dirname(__file__), '..', 'data', 'nav_src'); OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'nav.json')
C = re.compile(r'^([NSEW])(\d{2,3})\.(\d{2})\.(\d{2}(?:\.\d+)?)$', re.I)
def coord(s):
    m = C.match(s.strip()); 
    if not m: return None
    h, d, mi, se = m.groups(); mi, se = int(mi), float(se)
    if mi >= 60 or se >= 60: return None  # broken value in the source (reported, skipped)
    v = int(d) + mi / 60 + se / 3600; return round(-v if h.upper() in 'SW' else v, 5)
def rows(ext):
    for f in sorted(os.listdir(SRC)):
        if f.endswith(ext):
            ext_block = False
            for ln in open(os.path.join(SRC, f), encoding='latin-1'):
                ln = ln.strip()
                if not ln: continue
                if ln.startswith('//'): ext_block = ext_block or 'ESTERN' in ln.upper(); continue
                yield [x.strip() for x in ln.split(';')], ext_block
def main():
    airac = sys.argv[1] if len(sys.argv) > 1 else ''; bad = []; out = {'airac': airac, 'source': 'IVAO Italy sector files', 'vor': [], 'ndb': [], 'fix': []}
    for r, ext in rows('.vor'):
        la, lo = coord(r[2]), coord(r[3]) if len(r) > 3 else None
        if la is None or lo is None: bad.append(('VOR', r[0])); continue
        hide = r[4] if len(r) > 4 else ''; ty = r[5] if len(r) > 5 else ''; ch = r[6] if len(r) > 6 and re.match(r'^(CH\s*)?\d+[XY]$', r[6], re.I) else ''
        typ = {'0': 'VOR', '1': 'VOR/DME', '2': 'VORTAC', '3': 'TACAN', '4': 'DME'}.get(ty, 'VOR')  # type not given in the file: VOR
        out['vor'].append([r[0], la, lo, r[1], typ, re.sub(r'^CH\s*', '', ch, flags=re.I), 1 if hide == '1' else 0, 1 if ext else 0])  # ident, lat, lon, freq, type, TACAN channel, hidden, outside Italy
    for r, ext in rows('.ndb'):
        la, lo = coord(r[2]), coord(r[3])
        if la is None or lo is None: bad.append(('NDB', r[0])); continue
        out['ndb'].append([r[0], la, lo, r[1], 1 if (len(r) > 4 and r[4] == '1') or ext else 0])
    for r, ext in rows('.fix'):
        la, lo = coord(r[1]), coord(r[2])
        if la is None or lo is None: bad.append(('FIX', r[0])); continue
        typ = {'0': 'E', '1': 'T', '2': 'B', '3': 'H'}.get(r[3] if len(r) > 3 else '', 'E')  # enroute / terminal / both / hidden
        out['fix'].append([r[0], la, lo, typ, 1 if len(r) > 4 and r[4] == '1' else 0])  # ident, lat, lon, type, boundary
    json.dump(out, open(OUT, 'w'), separators=(',', ':'))
    print(len(out['vor']), 'VOR', len(out['ndb']), 'NDB', len(out['fix']), 'FIX', '- skipped (bad coordinates):', bad)
if __name__ == '__main__': main()
