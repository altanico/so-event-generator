#!/usr/bin/env python3
"""AIP Italia ENR 6.3.1 (VRP list) -> data/vrp.json.
Usage: python3 tools/vrp_build.py [data/nav_src/LI-ENR_6.3.1.pdf]
Entry: [code, name, lat, lon, refs] (refs = "FROM ... / TO ..." lines of column 4)."""
import re, json, sys, subprocess
src = sys.argv[1] if len(sys.argv) > 1 else 'data/nav_src/LI-ENR_6.3.1.pdf'
txt = subprocess.run(['pdftotext', '-layout', src, '-'], capture_output=True, text=True, check=True).stdout
L = txt.split('\n')
C = r"(\d{2})°(\d{2})'(\d{2})''N\s+(\d{3})°(\d{2})'(\d{2})''E\s*(.*)$"
p1 = re.compile(r"^\s*(.+?)\s{2,}([A-Z][A-Z0-9]{2,5})\s{2,}" + C)   # list 1: name, code
p2 = re.compile(r"^\s*([A-Z][A-Z0-9]{2,5})\s{2,}(.+?)\s{2,}" + C)   # list 2: code, name
ref = re.compile(r"^\s{60,}((?:FROM|TO)\b.*)$")
def dd(m, o): return round(int(m[o]) + int(m[o+1]) / 60 + int(m[o+2]) / 3600, 5)
first, second, cur, in2 = {}, {}, None, False
for l in L:
    m2 = p2.match(l); m1 = p1.match(l)
    if m2 and re.fullmatch(r"[A-Z]+\d*[A-Z]*\d*", m2[1]) and len(m2[2]) > 3 and not m1:
        in2 = True
    if in2 and m2:
        second[m2[1]] = (m2[2].strip(), dd(m2, 3), dd(m2, 6)); cur = None; continue
    if not in2 and m1:
        cur = [m1[2], m1[1].strip(), dd(m1, 3), dd(m1, 6), [m1[9].strip()] if m1[9].strip() else []]
        first[m1[2]] = cur; continue
    r = ref.match(l)
    if cur and r: cur[4].append(r[1].strip())
    elif not l.strip(): pass
    elif cur and not r and l.strip() and not l.startswith(' ' * 60): cur = None
miss = sorted(set(second) - set(first)); diff = [k for k in first if k in second and (abs(first[k][2] - second[k][1]) > 1e-4 or abs(first[k][3] - second[k][2]) > 1e-4)]
for k in miss: n, la, lo = second[k]; first[k] = [k, n, la, lo, []]
out = sorted(first.values(), key=lambda v: v[0])
for v in out: v[4] = ' · '.join(re.sub(r'\s+', ' ', x) for x in v[4])
json.dump({'src': 'AIP Italia ENR 6.3.1', 'airac': max(re.findall(r'AIRAC effective date (\d{2} [A-Z]{3} \d{4})', txt), key=lambda d: __import__('datetime').datetime.strptime(d, '%d %b %Y')), 'vrp': out}, open('data/vrp.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out), 'VRP; only in list 2:', miss, '; coord mismatch:', diff)
