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
| Demo | Staff page → "Dati DEMO" | Fictitious areas and UHF frequencies for testing only. |

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

## v1.2 – Aurora layer (temporary, removable)

Until the division database is connected, the default reserved areas come from the IVAO Aurora sector file:

| File | Content |
|---|---|
| `data/aurora_src/italy.restrict`, `data/aurora_src/italy.danger` | Original Aurora area files (R, D, TSA, TRA, AAR, AT areas) |
| `tools/aurora_to_json.js` | Converter: `node tools/aurora_to_json.js data/aurora_src/italy.restrict data/aurora_src/italy.danger > data/aurora_zones.json` |
| `data/aurora_zones.json` | Converted zones in the JSON format above (`source: "aurora"`, ids `AUR-…`) |

* Only lateral limits: the sector file has no vertical limits, so `lower` / `upper` are `TBC` (outputs show TBC; checks never block an element on a TBC limit).
* INDIA areas are skipped (built in with their AIP vertical limits). No frequencies come from the sector file: they stay TBD until the database or an import provides them.
* Load order: database API / imported file (chosen by the staff) → Aurora file if present → demo data.
* **To remove the layer**: delete `data/aurora_zones.json`, `data/aurora_src/` and `tools/aurora_to_json.js`. Nothing else changes: the app checks for the file at start-up and simply falls back. The site can serve its own data at the same API (format above).
