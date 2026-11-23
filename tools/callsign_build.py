#!/usr/bin/env python3
"""Italian military radio callsigns (staff list RADIO_CALLSIGNS.xlsx, public) -> data/callsigns.json.

Usage: python3 tools/callsign_build.py RADIO_CALLSIGNS.xlsx [data/callsigns.json]
Rows: base ICAO(s), unit, aircraft (generator types), OAT radio callsign, FPL short form (xx = two digits), GAT callsign.
Also the QRA callsigns by base and the Canadair numbers by base.
"""
import json, re, sys
import openpyxl

# aircraft designators of the list -> aircraft types of the generator
TOK = {'EUFI': ['EF-2000 Typhoon'], 'F35': ['F-35A'], 'VF35': ['F-35B'], 'F35B': ['F-35B'], 'TOR': ['Tornado IDS', 'Tornado ECR'], 'EH01': ['HH-101'], 'EH10': ['HH-101'],
       'B767': ['KC-767'], 'G550': ['G550 CAEW'], 'B350': ['PC-12 / King Air (light utility)'], 'P180': ['P-180 Avanti'], 'A139': ['HH-139'], 'F900': ['Falcon 900'],
       'Q9': ['MQ-9 Reaper'], 'MQ9': ['MQ-9 Reaper'], 'M339': ['MB-339'], 'AT76': ['P-72A'], 'C30J': ['C-130J', 'KC-130J'], 'C27J': ['C-27J'], 'M346': ['M-346'], 'M345': ['M-345'],
       'AV8B': ['AV-8B Harrier'], 'NH90': ['NH90'], 'B212': ['Bell 412 / UH-1 (utility helo)'], 'B412': ['Bell 412 / UH-1 (utility helo)'], 'UH1': ['Bell 412 / UH-1 (utility helo)'],
       'H47': ['CH-47 Chinook'], 'A129': ['AH-129 Mangusta'], 'A109': ['AW109 / H145 / H135 (light twin helo)'], 'B06': ['AW109 / H145 / H135 (light twin helo)'], 'A169': ['AW169'],
       'CL2T': ['CL-415 Canadair'], 'CL415': ['CL-415 Canadair'], 'S64': ['S-64 Skycrane / heavy firefighting helo']}

def cell(v): return re.sub(r'\s+', ' ', str(v or '')).strip()
def icaos(t): return re.findall(r'\b(LI[A-Z]{2})\b', t)
def toks(t): return [x for x in re.split(r'[\s|,()\-/]+', t.upper()) if x]
def types(t):
    out = []
    for k in toks(t):
        for ty in TOK.get(k, []):
            if ty not in out: out.append(ty)
    return out
def gat(t):
    t = cell(t).upper()
    m = re.match(r'([A-Z]{3})-(\d{2})XX', t)
    if m: return m.group(1) + m.group(2) + 'xx'
    m = re.match(r'([A-Z]{3})-XXXX', t)
    return m.group(1) + 'xxxx' if m else ''

def main(src, dst='data/callsigns.json'):
    rows = [[cell(c) for c in r] + [''] * 8 for r in openpyxl.load_workbook(src, read_only=True).worksheets[0].iter_rows(values_only=True)]
    out = {'src': 'IVAO Italy SO – Nominativi radio (staff list)', 'units': [], 'qra': {}, 'can': []}
    sec, base, gatc = '', [], ''
    for r in rows:
        a = r[0]
        if a in ('Aeronautica Militare', 'Marina Militare', 'Esercito Italiano'): sec, base, gatc = a, [], ''; continue
        if a.startswith('Nominativi QRA'): sec = 'QRA'; continue
        if a.startswith('Nominativi Istituzionali') or a.startswith('Altri Reparti') or a.startswith('Flotta S-64') or a.startswith('NOMINATIVI RESCUE'): sec = 'skip'; continue
        if a == 'Canadair': sec = 'CAN'; continue
        if a in ('Sede', 'Nominativo', 'Marche', 'Autorità', 'Reparto'): continue
        if sec in ('Aeronautica Militare', 'Marina Militare'):
            if a: base = list(dict.fromkeys(icaos(a)))  # a row with a place but no ICAO (e.g. "AEROPORTI VARI") has no base
            if r[5] and r[5] != '"': gatc = gat(r[5])
            if not r[3] or not base: continue
            ac, calib = types(r[2]), 'RADIOMISURE' in r[2].upper()
            if not ac: continue
            out['units'].append({'bases': base, 'unit': r[1], 'ac': ac, 'oat': r[3].upper(), 'fpl': re.sub(r'XX$', 'xx', r[4].upper()), 'gat': gatc, **({'calib': True} if calib else {})})
        elif sec == 'Esercito Italiano':
            if a: base = list(dict.fromkeys(icaos(a)))
            if r[6] and r[6] != '"': gatc = gat(r[6])
            if not r[4] or not base: continue
            ac = types(r[3])
            if ac: out['units'].append({'bases': base, 'unit': ' '.join(x for x in r[1:3] if x), 'ac': ac, 'oat': r[4].upper(), 'fpl': re.sub(r'XX$', 'xx', r[5].upper()), 'gat': gatc})
        elif sec == 'QRA':
            b = icaos(a)
            if b and r[1]: out['qra'][b[0]] = re.match(r'[A-Z]+', r[1]).group(0)
        elif sec == 'CAN':
            m = re.match(r'CAN(\d+)', r[1].upper())
            if m: out['can'].append({'cs': 'CAN' + m.group(1), 'base': (icaos(r[3]) or [''])[0]})
    json.dump(out, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(dst, len(out['units']), 'units,', len(out['qra']), 'QRA bases,', len(out['can']), 'Canadair')

if __name__ == '__main__': main(*sys.argv[1:])
