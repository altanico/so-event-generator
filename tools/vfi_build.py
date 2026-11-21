#!/usr/bin/env python3
"""IVAO Italy sector files <icao>.vfi (VRP and gates of the military aerodromes) -> data/mil_vfr.json.
Usage: python3 tools/vfi_build.py [data/nav_src/vfi]
Entry: [ident, name, lat, lon, aerodrome, kind, published, note]
  kind = VRP (AIP-style code) or GATE (military entry / exit gate, code = aerodrome prefix or none);
  published = true when the same point (code, or position within 0.3 NM) is in data/vrp.json (AIP ENR 6.3.1),
  in that case the AIP entry is kept and the file entry is skipped (duplicate)."""
import re, json, sys, os, math
d = sys.argv[1] if len(sys.argv) > 1 else 'data/nav_src/vfi'
def coord(s):
    s = s.strip(); m = re.fullmatch(r'([NSEW])(\d{3})\.(\d{2})\.(\d{2}(?:\.\d+)?)', s)
    if m: v = int(m[2]) + int(m[3]) / 60 + float(m[4]) / 3600
    else:
        m = re.fullmatch(r'([NSEW])(\d{3})(\d{2})(\d{2})(\d{3})', s); v = int(m[2]) + int(m[3]) / 60 + (int(m[4]) + int(m[5]) / 1000) / 3600
    return round(-v if m[1] in 'SW' else v, 6)
def nm(a, b, c, e): return math.hypot((a - c) * 60, (b - e) * 60 * math.cos(math.radians(a)))
aip = json.load(open('data/vrp.json'))['vrp']; byc = {v[0]: v for v in aip}
CODE = re.compile(r'[A-Z]{2,4}[NSEW]{1,2}\d|[A-Z]{3,5}\d')
out, dup, notes = [], [], []
for fn in sorted(os.listdir(d)):
    if not fn.endswith('.vfi'): continue
    ad = fn[:-4].upper()
    for l in open(os.path.join(d, fn), encoding='utf-8', errors='replace'):
        l = l.strip()
        if not l or l.startswith('//'): continue
        f = [x.strip() for x in l.split(';')]
        co = [i for i, x in enumerate(f) if re.fullmatch(r'[NS][\d.]+', x)]
        i = co[0]; la, lo = coord(f[i]), coord(f[i + 1]); txt = [x for x in f[:i] if x and x != '.']
        note = ''
        if len(txt) == 2 and CODE.fullmatch(txt[0]) and not CODE.fullmatch(txt[1]): txt = [txt[1], txt[0]]; note = 'name / code swapped in source'
        name = txt[0]; code = txt[1] if len(txt) > 1 else ''
        if not code and (m := re.fullmatch(r'(.*?[A-Z]{2,})(' + ad[2:] + r'[NSEW]{1,2}\d)', name)): name, code = m[1], m[2]; note = 'name and code glued in source'
        if re.fullmatch(r'\d+', code): code = ''   # gate altitude in the code field (LIBA): ignored, staff 21 Nov
        if ' - ' in name and not code: name, code = name.split(' - ')[0].strip(), name.split(' - ')[1].strip()
        kind = 'VRP' if CODE.fullmatch(code) else 'GATE'
        name = name.rstrip('.')
        a = byc.get(code) or next((v for v in aip if nm(v[2], v[3], la, lo) < 0.3), None)
        if a: dup.append(f'{ad} {name}/{code} = AIP {a[0]}' + (f' ({nm(a[2], a[3], la, lo):.2f} NM)' )); continue
        if kind == 'GATE' and not code.startswith(ad[2:]) and code: note = (note + '; ' if note else '') + f'prefix {code}'
        ident = code if kind == 'VRP' else (name if name.startswith(ad[2:] + '-') else f'{ad[2:]}-{name}')
        out.append([ident, name, la, lo, ad, kind, False, note])
json.dump({'src': 'IVAO Italy sector files *.vfi', 'published': False, 'pts': out}, open('data/mil_vfr.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out), 'new points;', len(dup), 'duplicates of AIP VRPs skipped')
for p in out: print(' ', p)
print('duplicates:'); [print(' ', x) for x in dup]
