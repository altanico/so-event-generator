# IVAO SO Mission Generator – airspace database interface

The generator reads **reserved areas** (R / D / P / TSA / TRA / CBA / MTA) and **frequencies** from the division database.
Every mission element (threat areas, threats, objectives, CAP, tanker tracks, AEW orbits, IP, kill box, CSAR hold) must lie
inside the reserved areas selected for the mission, and within their vertical limits. Elements outside are flagged in
the staff page and can be moved back inside automatically.

## How data gets in

| Source | How | Notes |
|---|---|---|
| REST API | Staff page → "API database (URL)" + optional token (sent as `Authorization: Bearer <token>`) | Works when the page is hosted on the division site (CORS enabled). Inside claude.ai external calls are blocked: use the file. The token is kept only in the staff's browser and never published. |
| File | Staff page → "Importa JSON / GeoJSON" | An export of the same JSON from the database. |

## JSON format (GET response or file)

```json
{
  "zones": [
    {
      "id": "LIR-TSA-123",
      "name": "TSA 123",
      "type": "TSA",
      "lower": "GND",
      "upper": "FL245",
      "notes": "Active by NOTAM / AUP",
      "geometry": { "type": "Polygon", "coordinates": [[[17.60, 40.00], [18.60, 40.00], [18.60, 40.80], [17.60, 40.80], [17.60, 40.00]]] }
    }
  ],
  "frequencies": [
    { "freq": "251.000", "unit": "UHF", "use": "GCI",  "station": "",         "name": "GCI primary" },
    { "freq": "260.100", "unit": "UHF", "use": "TAC",  "station": "",         "name": "Inter-flight 1" },
    { "freq": "122.100", "unit": "VHF", "use": "TWR",  "station": "LIBV_TWR", "name": "Gioia Tower" }
  ]
}
```

* `type`: `R`, `D`, `P`, `TSA`, `TRA`, `CBA`, `MTA` (also accepted: "Restricted", "Danger", "Prohibited"). Prohibited areas are never auto-selected.
* `lower` / `upper`: `GND`, `SFC`, `UNL`, `FL245`, `5000 FT`.
* Geometry: GeoJSON `Polygon` / `MultiPolygon` (lon, lat) **or** `"poly": [[lat, lon], …]`.
* A plain GeoJSON `FeatureCollection` also works: zone fields go in `properties`.
* Accepted aliases: `areas` for `zones`; `freqs` for `frequencies`; `lower_limit`/`floor`, `upper_limit`/`ceiling`, `frequency`/`mhz`, `usage`, `position`.

## How frequencies are used

| `use` | Assigned to |
|---|---|
| `station` = ATC callsign (e.g. `LIBV_APP`) | that ATC position |
| `GCI` | AWACS / GCI positions |
| `CAS` / `JTAC` | JTAC |
| `CSAR` | rescue coordination |
| `AAR` | tanker flights |
| `TAC` | inter-flight frequency of each flight |
| `APP`, `TWR`, `CTR` | approach, tower, area control without a specific station |

Anything not found stays `TBD` and can be typed by hand.

---

## Bullseyes and tracks (added in v0.4)

The same JSON accepts two more optional arrays. If they are missing, the app uses the published lists built in
(17 bullseyes, 5 AEW tracks in the India areas, 9 AAR tracks), so nothing breaks.

```json
{
  "bullseyes": [
    { "name": "LEVIS", "coords": "N0443239199 E0073655368", "ref": "LEV" },
    { "name": "PESTO", "lat": 43.7058, "lon": 8.8558, "ref": "" }
  ],
  "tracks": [
    { "kind": "AEW", "id": "INDIA 9", "zone": "INDIA-9", "c1": [40.5, 9.4], "c2": [40.18333, 9.38333],
      "radius": 13, "sep": 20, "pattern": "racetrack only", "floor": "FL290", "notes": "" },
    { "kind": "AAR", "id": "FORTUNA", "areas": ["D604", "D605"],
      "ap1": [40.5, 11.23056], "tp1": [40.49750, 11.07861], "ap2": [39.66361, 11.10222], "tp2": [39.66611, 11.25333],
      "ref": ["252/83 PNZ VOR", "253/89 PNZ VOR", "228/113 PNZ VOR", "261/108 PNZ VOR"],
      "course": "356/176", "leg": 50, "width": 7, "lo": 150, "hi": 230, "notes": "" }
  ]
}
```

* `coords` is `N` + 3-digit degrees + minutes + seconds + thousandths, then `E` + the same (as in the bullseye list). You can send `lat`/`lon` in decimal degrees instead.
* AEW `zone` and AAR `areas` are matched against the `id` or `name` of the zones (case and spaces ignored, e.g. `D604`, `INDIA 9`).
  A track is used only if it is within 450 km (AEW) or 350 km (AAR) of the theatre; its areas are added to the reserved ones.
* Tracks are published inside their areas, so they are not moved or checked against the other reserved areas.
* The five India areas (polygon and vertical limit) are also built in; a zone with the same name in the database replaces them.

## v0.5 – Tipi di evento e punti di navigazione

**Eventi** (`scenario.meta.events`, combinabili): `MIX, AAR, ID, CAS, SEAD, CSAR, AIRMOB, MAR, NAVI, NAVL, SAR, HEMS, MEDEVAC, HOSPITAL, HUMAN, AIB`.
Se nessun evento è di tipo "combat" (MIX/CAS/SEAD/CSAR/AIRMOB/MAR) il briefing è sobrio: niente fazioni RED né uso di armi.
Il risultato della fase 3 contiene `t.serials[]` (`id, kind, title, flights[], text, success`) e le rotte come elementi `airspace` di tipo `ROUTE` (`names[]`, `pts[]`, `alt`, `kind: IFR|LOW`).

**Punti** (sectorfile o API): accettati
- sectorfile `.sct` con sezioni `[VOR] [NDB] [AIRPORT] [FIXES] [VFR…]` (coordinate `N043.20.10.000`);
- JSON `{ "points": [ { "name":"ABETI", "type":"FIX|VOR|NDB|VFR|APT", "lat":43.3, "lon":11.2 } ] }` o array `[name,type,lat,lon]`.
Solo i punti dentro le zone riservate selezionate vengono usati; in assenza, il generatore usa punti sintetici e lo segnala.

## v0.6 – Postazioni ATC reali

Il generatore non inventa più callsign ATC. Le postazioni reali arrivano dal database (chiave `positions` nello stesso JSON dello spazio aereo) o da un file importato nella scheda 1 (JSON o CSV):

```json
{ "positions": [ { "callsign": "LIED_APP", "name": "Decimomannu Approach", "frequency": "122.100", "type": "APP", "fir": "LIRR" } ] }
```
CSV: intestazione `callsign,name,frequency,type,fir`. Se `type` manca viene ricavato dal suffisso del callsign (`_APP`, `_TWR`, `_CTR`), l'ICAO dal prefisso.
I ruoli di evento (GCI, RCC, dispatch EMS, DOS, cella soccorsi) restano callsign di esercitazione modificabili; la frequenza viene dal pool `frequencies` del database.


## v1.3 – AIP layer (temporary, removable)

Until the division database is connected, the default reserved areas are the **military** areas of AIP Italia, with their real vertical limits:
ENR 5.1.2 restricted (R), ENR 5.1.3 danger (D), ENR 5.1.4 temporary reserved (TRA / TSA, cross-border EUC and D35 CRIT included).
AIRAC of the latest pages: 5.1.2 and 5.1.3 24 DEC 2026, 5.1.4 01 OCT 2026.

| File | Content |
|---|---|
| `data/aip_src/LI-ENR_5.1.2.pdf`, `LI-ENR_5.1.3.pdf`, `LI-ENR_5.1.4.pdf` | Source AIP sections |
| `data/aip_src/LI-ENR_5.2.2.1.pdf`, `data/aip_src/aar_corridors.json` | AAR corridors (ALPHA, BRAVO, DELTA, ECHO, ADRIATICO, ADRIATICO HIGH, TIRRENO): levels / blocks / widths from the AIP; lateral limits from the AIP for DELTA and ADRIATICO, from the IVAO Aurora sector file for the others (their route points are not in ENR 5.2.2.1); `axis` = centre line |
| `data/aip_src/LI-ENR_5.2.2.6.pdf`, `data/aip_src/low_level_areas.json` | Very low level tactical areas (AT PIEMONTE, EMILIA, TOSCANA, MARCHE NORD, MOLISE, BASILICATA, SICILIA NORD, SICILIA SUD): not reserved, permeable to other traffic, stored as type `D`, tag `LOWLEVEL`, lower 500 ft AGL (helicopters 150 ft AGL), upper TBC |
| `data/aip_src/LI-ENR_5.2.2.4.pdf`, `data/aip_src/oat_corridors.json` | OAT corridors YANKEE, ALPHA 1 / 2, BRAVO, CHARLIE, TC-PERDA HIGH / MED / LOW: centre line (`axis`, waypoint names `wpt`), half width, levels (TBC where the AIP says "coordinated", with `pref` levels), radio, mutual exclusion `excl`; stored as type `COR` |
| `data/aip_src/LI-SUP_S56-26.pdf`, `data/aip_src/sup_s56_26.json` | AIP SUP S56/26 (STEADFAST NOON 2026): only the items not already in ENR 5 – areas STAR 1 / 2 / 4 / 5, STAR 5 WEST LO / HI, JUSTIN, EOLIA WEST / EAST (type `TRA`) and 12 transit corridors (TC LAGOON SEG-1/2/3, TIRRENO MOD SEG-1/2, LEON, NOON N / S, DEDALO, DEDALO BIS, EDWARD, MATTHEW; type `COR`). The SUP's temporary levels for existing R / D areas are ignored; dates ignored |
| `data/aip_src/LI-SUP_S64-26.pdf`, `data/aip_src/sup_s64_26.json` | AIP SUP S64/26 (POGGIO DART 2026): only new items – areas PLUS (FL140-FL325, widest of the two time blocks) and WEBER (UA, FL130-FL210) as `TSA`; corridors TC JULIET (D35B – R48), TC URBINO (R21A – R48), TC JENNY 0-4 as `COR`. INDIA 2 / 5, TC ALPHA 2, R21A, R48A, D35 already in the data: ignored |
| `data/aip_src/staff_areas.json` | Areas supplied by the staff in decimal degrees (STAR 10 FL220-FL310, STAR 6 FL200-FL400), type `TRA`, section `Staff` |
| `data/aip_src/tsa_configs.json` | Simultaneous activation configurations at the end of ENR 5.1.4 (IONIO1-5, CONF1-5 SICILIA, CONF1-5 EST SARDEGNA; `sup: true` = needs an AIP Supplement) |
| `tools/aip_extract.py`, `tools/aip_build.py` | Extraction (needs pdfplumber) – see the usage lines at the top of each script |
| `data/aip_zones.json` | 279 areas (R22 Frosinone included by staff decision; 8 AAR corridor zones, type `AAR`, with `blocks` and `axis`) (`source: "aip"`, ids `LI-R…`, `LI-D…`, `LI-TRA…`, `LI-TSA…`, `LI-EUC…`) + `configs` |

Activation hours are not used (staff decision: the areas can always be used). Extra zone fields: `activity` (English), `use` tags (`AIR`, `FIRING`, `A2G`, `A2A`, `AAR`, `ASW`, `PARA`, `HELO`, `UAV`, `TOW`, `SUPERSONIC`),
`hours` (Italian/English, staff only), `amc` (AMC manageable), `section`. A file or API may also send `configs: [{id, group, zones: [ids], sup}]`.

* Kept: areas whose activity is military (military air activity, firing, air-to-air, AAR, ASW, State aircraft, Army helicopters, military parachuting, military UA).
  Skipped (39): security overflight bans, archaeological areas, gliding / free flight / VDS, captive balloons, laser, volcanic activity, kite generators, civil UA testing, company test flights, U-space.
* Lines along a coastline or border are drawn as straight segments; circles and arcs are computed from centre and radius.
* Selection: areas at the front / red area or within 60 km; for CAS / strike / SEAD also firing ranges within 150 km, for airdrop parachuting areas,
  for CSAR / MEDEVAC helicopter areas. CAP / tracks / orbits with no reserved area at their level get the nearest area that has it (max 250 km).
  If two or more areas of a configuration group are selected, the selection becomes the closest AIP configuration (those needing a Supplement only as a last resort).
  Civil-only events do not use these military areas.
* AAR corridors: an element is inside a corridor only within one of its level blocks (the two blocks are never used together). A tanker gets a 50 NM track on the axis of the nearest corridor, at its upper block, when the corridor is nearer the front than the published tanker tracks.
* Low-level navigation: the AT tactical areas within 220 km are selected and every low-level route stays inside one of them (fixed wing 500-1000 ft AGL, helicopters 150-500 ft AGL); the serial reminds that the area is not reserved. Theatres without an AT area nearby (NE, SA) keep the routes in the reserved areas.
* OAT corridors are never used to place exercise elements. They are proposed (`S.cor`) when they join a BLUE base and a reserved area, or two separate reserved areas (transit), or for IFR navigation / airlift near the front (airway-like reservation: the IFR route starts along the corridor). The staff toggles them in the airspace card or on the map; the masterplan lists them (route, width, levels, radio).
* No frequencies (stay TBD). Load order: database API / imported file → AIP file if present → no zones (demo data removed in v1.11).
* **To remove the layer**: delete `data/aip_zones.json`, `data/aip_src/` and `tools/aip_*.py`.

## Reserved-area selection (v1.11)

* `S.resMode`: `'auto'` (the generator proposes the areas for theatre and event) or `'manual'` (only the areas the staff ticks; the generator never adds or swaps areas and clamps every element into them). Asked before the first generation.
* "Deseleziona tutte" clears the selection and switches to manual. The custom-area union now uses the areas ticked in the zone table.
* v1.12: map click on overlapping areas opens a list of every area under the point (smallest first) instead of toggling the top one. The zone table filters by name/id, type, state, near-theatre or all Italy, sorts by distance/name/type/lower limit, and can select or deselect the rows shown.

## BLUE / RED boundary (v1.13)

* `S.border`: null (automatic straight line across the front) or an array of `[lat, lon]` points edited by the staff; it is carried in the saved event and the public payload. Beyond its ends the line continues straight. The FLOT control measure follows it.

## How areas are proposed (v1.14.1)

* Each task has a level band (`TASK_FL`): AAR/receiver FL150-FL280, DCA/OCA/escort/QRA FL100-FL350, SEAD FL100-FL300, strike FL50-FL300, CAS FL50-FL200, maritime/recce FL50-FL250. An area fits a band if it overlaps it by at least 5000 ft; an unknown (TBC) upper limit never fits.
* Areas published for an activity of the event (`use`: FIRING/A2G, PARA, HELO, LOWLEVEL) are proposed whatever their levels.
* Training events: nearest fitting areas around the theatre (AAR corridors first for refuelling, max 2 + 2-4 areas, 1 INDIA area if AEW). Combat events: areas around the front as before, plus the nearest areas for any band not yet covered.
