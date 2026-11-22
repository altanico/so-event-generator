#!/usr/bin/env python3
"""Italian part of the EUROCONTROL RAD (Route Availability Document) -> data/rad.json.

Usage: python3 tools/rad_build.py RAD_<airac>_<ver>.xlsx [data/rad.json]
Only the aerodrome connectivity of Italian aerodromes is kept (Annex 3A DEP / ARR, rows LI...),
plus the Italian general conditions (Annex 3A Conditions LI_LIM_AD, LI_TP). Rebuild at every AIRAC.
Source: EUROCONTROL NM, RAD (public). The xlsx itself stays outside git.
"""
import json, re, sys
import openpyxl

def cell(v): return re.sub(r'\s+', ' ', str(v or '').replace('_x000D_', ' ')).strip()

def split_list(v):
    v = cell(v).strip('() ')
    return [x.strip() for x in re.split(r'[,/]', v) if x.strip()]

def cond(txt):
    t = cell(txt).upper(); out = {'txt': cell(txt)}
    if 'TBD' in t or 'GENERAL CONDITIONS' in t: out['any'] = True
    m = re.search(r'ONLY AVBL FOR TFC\s+(DEP|ARR)\s+([A-Z0-9*,/ ]+)', t)
    if m:
        ads = []
        for x in re.split(r'[,\s]+', m.group(2).strip()):
            if not x: continue
            if '/' in x:  # LIMC/ML -> LIMC, LIML
                p = x.split('/'); ads.append(p[0]); ads += [p[0][:2] + q if len(q) == 2 else q for q in p[1:]]
            else: ads.append(x)
        out['only' + m.group(1).lower()] = [a for a in ads if re.match(r'^[A-Z]{4}$|^[A-Z]{2,3}\*$', a)]
    if 'HELICOPTER' in t: out['helo'] = True
    if 'TYPE M' in t: out['mil'] = True
    if t.startswith('NOT AVBL'): out['not'] = True
    return out

def main(src, dst='data/rad.json'):
    wb = openpyxl.load_workbook(src, read_only=True)
    cover = ' '.join(cell(c) for r in wb['Cover'].iter_rows(values_only=True, max_row=3) for c in r if c)
    res = {'src': 'EUROCONTROL RAD – ' + (re.search(r'RAD \S+ V[\d.]+', cover) or [cover[:40]])[0], 'dep': {}, 'arr': {}, 'cond': {}}
    for sn, key in (('Annex 3A DEP', 'dep'), ('Annex 3A ARR', 'arr')):
        for r in list(wb[sn].iter_rows(values_only=True))[1:]:
            if not r[3] or not cell(r[3]).startswith('LI'): continue
            pts = split_list(r[6]); sid = split_list(r[5]); c = cond(r[7])
            for ad in split_list(r[4]):
                res[key].setdefault(ad, []).append({'id': cell(r[3]), 'pts': pts, 'proc': sid, **c})
    for r in list(wb['Annex 3A Conditions'].iter_rows(values_only=True))[1:]:
        if r[3] and cell(r[3]).startswith('LI'): res['cond'][cell(r[3])] = cell(r[5])
    json.dump(res, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(dst, len(res['dep']), 'DEP aerodromes,', len(res['arr']), 'ARR aerodromes')

if __name__ == '__main__': main(*sys.argv[1:])
