#!/usr/bin/env python3
"""Hospital helipads of Italy from OpenStreetMap -> data/helipads.json (staff 22 Nov: real helipads for hospital transfer / HEMS).

Usage: python3 tools/helipad_build.py [data/helipads.json]   (needs internet: Overpass API; run by .github/workflows/helipads.yml)
A helipad (aeroway=helipad) is kept when it lies within 600 m of a hospital (amenity=hospital), named after that hospital;
a hospital tagged helipad=yes without a mapped helipad is kept at its own position.
Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright) – the extract is under the same licence.
"""
import json, math, sys, time, urllib.parse, urllib.request

OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
# Italy in 2-degree tiles (the whole country in one query is refused by the public servers)
TILES = [(la, lo, la + 2, lo + 2) for la in range(36, 48, 2) for lo in range(6, 20, 2)]
Q = '[out:json][timeout:90];(nwr["aeroway"="helipad"]({s},{w},{n},{e});nwr["amenity"="hospital"]({s},{w},{n},{e}););out center tags;'
# rough outline of Italy (with Sardinia, Sicily, San Marino, Vatican) to drop the neighbours of the border tiles
ITALY = [(47.1, 6.6), (47.1, 12.2), (46.9, 13.8), (45.6, 13.9), (44.0, 13.0), (41.9, 16.3), (41.6, 18.7), (39.7, 18.7), (37.8, 16.2), (36.6, 15.2), (36.4, 12.3), (37.7, 12.0), (38.4, 12.4),
          (39.0, 15.5), (40.2, 14.8), (41.2, 13.0), (42.4, 11.0), (43.6, 10.2), (44.1, 9.4), (43.8, 7.5), (44.1, 7.0), (45.1, 6.6), (45.9, 6.8)]
SARD_SIC = [[(41.35, 9.0), (41.35, 10.0), (38.8, 9.9), (38.8, 8.0), (41.0, 8.0)]]
def inside(p, poly):
    x, y, c = p[0], p[1], False
    for i in range(len(poly)):
        (a1, b1), (a2, b2) = poly[i], poly[i - 1]
        if (b1 > y) != (b2 > y) and x < (a2 - a1) * (y - b1) / (b2 - b1) + a1: c = not c
    return c
def in_italy(p): return inside(p, ITALY) or any(inside(p, q) for q in SARD_SIC)

def fetch_one(q):
    last = None
    for _ in range(3):
        for url in OVERPASS:
            try:
                req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': 'ivao-so-event-generator (github.com/altanico/so-event-generator)'})
                return json.load(urllib.request.urlopen(req, timeout=180))['elements']
            except Exception as e:
                last = e; time.sleep(5)
        time.sleep(30)
    raise SystemExit(f'Overpass not reachable: {last}')

def fetch():
    seen, out = set(), []
    for (s_, w, n, e) in TILES:
        els = fetch_one(Q.format(s=s_, w=w, n=n, e=e)); time.sleep(2)
        for el in els:
            k = (el['type'], el['id'])
            if k not in seen: seen.add(k); out.append(el)
        print(f'tile {s_},{w}: {len(els)} elements', flush=True)
    return {'elements': out}

def pos(e):
    if 'lat' in e: return e['lat'], e['lon']
    c = e.get('center'); return (c['lat'], c['lon']) if c else None

def km(a, b):
    p = math.pi / 180; d = 0.5 - math.cos((b[0] - a[0]) * p) / 2 + math.cos(a[0] * p) * math.cos(b[0] * p) * (1 - math.cos((b[1] - a[1]) * p)) / 2
    return 12742 * math.asin(math.sqrt(d))

def main(dst='data/helipads.json'):
    els = fetch()['elements']
    heli = [e for e in els if e.get('tags', {}).get('aeroway') == 'helipad' and pos(e) and in_italy(pos(e))]
    hosp = [e for e in els if e.get('tags', {}).get('amenity') == 'hospital' and pos(e) and e['tags'].get('name') and in_italy(pos(e)) and e['tags'].get('addr:country', 'IT') == 'IT']
    out, used = [], set()
    for h in heli:
        p = pos(h); best = min(hosp, key=lambda o: km(p, pos(o)), default=None)
        if not best or km(p, pos(best)) > 0.6 or best['id'] in used: continue
        used.add(best['id']); t = best['tags']
        out.append([t['name'], t.get('addr:city', ''), round(p[0], 5), round(p[1], 5), 1 if t.get('emergency') == 'yes' else 0])
    for o in hosp:
        if o['id'] in used or o['tags'].get('helipad') != 'yes': continue
        p = pos(o); t = o['tags']; out.append([t['name'], t.get('addr:city', ''), round(p[0], 5), round(p[1], 5), 1 if t.get('emergency') == 'yes' else 0])
    out.sort(key=lambda r: (r[2], r[3]))
    json.dump({'src': 'OpenStreetMap', 'licence': 'Data © OpenStreetMap contributors, ODbL 1.0', 'date': time.strftime('%Y-%m-%d'),
               'cols': ['name', 'city', 'lat', 'lon', 'emergency'], 'list': out}, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(dst, len(out), 'hospital helipads')

if __name__ == '__main__': main(*sys.argv[1:])
