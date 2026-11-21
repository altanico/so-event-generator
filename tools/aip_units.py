#!/usr/bin/env python3
"""Adds to every zone of data/aip_zones.json the ATS unit the AIP names for it (field 'unit', text as in the AIP, e.g. "Padova SCCAM", "Roma ACC",
"Rieti AFIU"). Sources: the Remarks column of ENR 5.1.2 / 5.1.3 / 5.1.4 (raw tables made by tools/aip_extract.py), the radio / notes of corridors and
AAR areas. Priority: "Responsible ATS Unit / Ente ATS responsabile" > "activated by / attivata da" > "radio contact with" > "coordination with" > any
"<City> SCCAM / SCC". SCCAM / SCC = the 4 military area control units (Milano, Padova, Roma, Brindisi) – staff 21 Nov.
Usage: python3 tools/aip_units.py /tmp/r512.json /tmp/r513.json /tmp/r514.json   (raw extracts; then data/aip_zones.json is rewritten)"""
import json, re, sys
UNIT = r"((?:Milano|Padova|Roma|Brindisi|[A-Z][a-zà-ù]+(?: [A-Z][a-zà-ù]+)?)\s+(?:SCCAM|SCC|ACC|APP|TWR|AFIU|FIC|CRC|RAC))\b"
PAT = [r'Responsible ATS Unit:\s*-?\s*' + UNIT, r'Ente ATS responsabile[^:]*:\s*-?\s*' + UNIT, r'(?:activated by|attivata da)\s+' + UNIT,
       r'radio contact with\s+' + UNIT, r'(?:coordination with|coordinamento con)[^:]*:?\s*' + UNIT, r'\b((?:Milano|Padova|Roma|Brindisi)\s+(?:SCCAM|SCC))\b', UNIT]
def find(t):
    for p in PAT:
        m = re.search(p, t)
        if m: return re.sub(r'\s+', ' ', m.group(1)).strip()
    return None
raw = {}
for f in sys.argv[1:]:
    for x in json.load(open(f)):
        head = re.sub(r'\s+', ' ', x['head']).strip()
        m = re.match(r'(?:LI(?:/(L\w))? ?)?((?:R|D|TSA|TRA|CBA|EUC)\s?\d+\s?(?:/\s?\w+|\s?bis\b|\w(?=\s|$))?)\s*-?\s*(.*)', head)
        if not m: continue
        code = re.sub(r'\s+', '', m.group(2)).replace('/', '')
        z = re.search(r'Zona "(\w)"', m.group(3))
        if z: code += z.group(1)
        raw['LI-' + code] = ' '.join(x['c4'])
d = json.load(open('data/aip_zones.json'))
n = 0
for z in d['zones']:
    t = raw.get(z['id'], '') + ' ' + str(z.get('radio', '')) + ' ' + z.get('notes', '')
    u = find(raw.get(z['id'], '')) or find(str(z.get('radio', ''))) or find(z.get('notes', ''))
    if u: z['unit'] = u; n += 1
    else: z.pop('unit', None)
json.dump(d, open('data/aip_zones.json', 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(n, 'of', len(d['zones']), 'zones with a unit'); print(Counter(z.get('unit') for z in d['zones']).most_common(40))
