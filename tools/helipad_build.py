#!/usr/bin/env python3
"""Hospital helipads of Italy from OpenStreetMap -> data/helipads.json (staff 22 Nov: real helipads for hospital transfer / HEMS).

Usage: python3 tools/helipad_build.py [data/helipads.json]   (needs internet: Overpass API; run by .github/workflows/helipads.yml)
A helipad (aeroway=helipad) is kept when it lies within 600 m of a hospital (amenity=hospital), named after that hospital;
a hospital tagged helipad=yes without a mapped helipad is kept at its own position.
Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright) – the extract is under the same licence.
"""
import json, math, sys, time, urllib.parse, urllib.request

OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
Q = '''[out:json][timeout:300];
area["ISO3166-1"="IT"][admin_level=2]->.it;
(nwr["aeroway"="helipad"](area.it);)->.h; .h out center tags;
(nwr["amenity"="hospital"](area.it);)->.o; .o out center tags;'''

def fetch():
    last = None
    for url in OVERPASS:
        for _ in range(3):
            try:
                req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': Q}).encode(), headers={'User-Agent': 'ivao-so-event-generator (github.com/altanico/so-event-generator)'})
                return json.load(urllib.request.urlopen(req, timeout=400))
            except Exception as e:
                last = e; time.sleep(20)
    raise SystemExit(f'Overpass not reachable: {last}')

def pos(e):
    if 'lat' in e: return e['lat'], e['lon']
    c = e.get('center'); return (c['lat'], c['lon']) if c else None

def km(a, b):
    p = math.pi / 180; d = 0.5 - math.cos((b[0] - a[0]) * p) / 2 + math.cos(a[0] * p) * math.cos(b[0] * p) * (1 - math.cos((b[1] - a[1]) * p)) / 2
    return 12742 * math.asin(math.sqrt(d))

def main(dst='data/helipads.json'):
    els = fetch()['elements']
    heli = [e for e in els if e.get('tags', {}).get('aeroway') == 'helipad' and pos(e)]
    hosp = [e for e in els if e.get('tags', {}).get('amenity') == 'hospital' and pos(e) and e['tags'].get('name')]
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
