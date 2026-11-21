#!/usr/bin/env python3
"""IVAO Italy sector file itfreq.frq (ATC positions) -> data/atc.json.
Usage: python3 tools/atc_build.py [data/nav_src/itfreq.frq]
Only the first two fields of each line are used (staff 21 Nov): position id and frequency.
Entry: [id, freq, icao, kind] with kind = DEL / GND / TWR / APP / GCA (…_G_APP) / CTR / FSS / MIL (…_MIL_CTR / _MIL_APP / _MIL_TWR) / AD (air defence: AEW, JTA, NVY, AAR, CRC, RCC)."""
import re, json, sys
src = sys.argv[1] if len(sys.argv) > 1 else 'data/nav_src/itfreq.frq'
out, seen = [], set()
for l in open(src, encoding='utf-8', errors='replace'):
    l = l.strip()
    if not l or l.startswith('//'): continue
    f = l.split(';')
    if len(f) < 2 or not re.fullmatch(r'1\d\d\.\d{2,3}', f[1].strip()): continue
    pid, fr = f[0].strip(), f[1].strip()
    if pid in seen: continue
    seen.add(pid)
    icao = pid.split('_')[0]
    k = ('GCA' if re.search(r'_G_APP$', pid) else 'AD' if re.search(r'_(AEW|JTA|NVY|AAR|CRC|RCC)_CTR$', pid) else 'MIL' if '_MIL_' in pid else
         pid.rsplit('_', 1)[-1])
    out.append([pid, fr, icao, k])
json.dump({'src': 'IVAO Italy sector file itfreq.frq', 'pos': out}, open('data/atc.json', 'w'), separators=(',', ':'))
from collections import Counter
print(len(out), dict(Counter(x[3] for x in out)))
print('GCA:', [(x[0], x[1]) for x in out if x[3] == 'GCA'])
print('AD:', [(x[0], x[1]) for x in out if x[3] == 'AD'])
