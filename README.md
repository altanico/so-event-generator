# IVAO SO – Event & Mission Generator

Web tool for the IVAO Italy Special Operations staff. From the event type and the list of participants it builds a complete training event: scenario, flights and tasks, serials, maps, **Masterplan PDF** (laid out like the SO template), **PowerPoint decks** (generic scenario and mission briefing) and a **public page** for participants.

- Live preview: https://claude.ai/artifact/U1xmPaGxN7WGa96h6WFsHo (staff view: add `#staff`)
- Staff tutorial (Italian): https://claude.ai/artifact/HdLXByYpT1NifAANHaS7uh

## How it works

Single self-contained page (`index.html`, vanilla JS, no build step). CDN libraries: Leaflet 1.9 (map), pptxgenjs 4 (decks), pdf-lib + fontkit (masterplan). Fonts and logo are in `fonts/` and `img/`.

Staff workflow, four tabs:

1. **Scenario** – event type (combinable: combat, training, civil), required roles, theatre and reserved airspace, threats (combat only), ATC/C2 positions → generic scenario used to announce the event.
2. **Participants** – pilots and controllers (manual, quantities, paste, CSV/JSON).
3. **Tailoring** – flights, tasks, task allocation, routes, frequencies built from who signed up.
4. **Export** – revisions (Rev.0, Rev.1…), masterplan section mask (NIL for empty sections), PDF, decks, public page.

Events are saved in the artifact's shared store (staff only) or in the browser, and can be exported/imported as JSON.

### Main code areas (in `index.html`)

| Area | What |
| --- | --- |
| Data tables | `AC` aircraft aliases/categories, `CATS` threat/need categories, `ROLES`, `TT`, `OBJT`, `PKG`, `THEATRES`, `AIRPORTS` |
| Airspace layer | `LIB()`, `RES()`, `parseAirspace`, `setAirspace`, `autoReserve`, containment checks, bullseyes, AAR/AEW tracks |
| Event profiles | `EVT`, `PROF()`, `REL()` (what is pertinent), `reqTasks`, `proposeC2`, `genEventElements` |
| Generation | `generateGeneric`, `genZones`, `genBackground`, `assignTasks`, `buildFlights`, `generateElements`, `buildC2`, `buildTexts(Sober)`, `tailor` |
| Outputs | `renderMap` (canvas), masterplan PDF (`MPSEC`, `mpOn`, `sec()`), decks, `renderPublic`, `buildPayload` |
| CAS / JTAC | `S.cas` prepared before sign-ups (tab "CAS / JTAC"), `genCAS`, `assignCAS`, `applyCAS`, `casNine`, `casGamePlan`, `casCheckIn`, `casSitUpdate`, `casPublic`, `exportJtacPack` (from the IVAO *Manuale Close Air Support v2.0*) |
| CSAR / MEDEVAC | `S.pr` prepared before sign-ups (tab "CSAR / MEDEVAC"), `genPR`, `assignPR`, `applyPR`, `prElevenLine`, `prBrief`, `prOscBrief`, `med9`, `sarneg`, `prPublic`, `exportPrPack` (from the IVAO *Manuale Personnel Recovery e Mil MEDEVAC v2.0*) |
| SAR civile | `S.sar` prepared before sign-ups (tab "SAR civile"), `genSAR`, `sarAreas`, `sarPattern` (SS/VS/TS/PS/OS), `assignSAR` (callsigns RESCUE INDIA LIMA/MIKE + letter), `applySAR`, `sarPlan` (search action plan), `sarTexts`, `sarPublic`, `exportSarPack` (from the IVAO *Manuale SAR, MED, HEMS, HOSP, HUM v2*) |
| AIB | `S.aib` prepared before sign-ups (tab "AIB"), `genAIB`, `aibGeom` (burned area, fronts, vegetation at risk, operations area, entry point, DOS), `aibWater` (scooping lake / sea / portable tank), `assignAIB` (CAN + number, registration + BAT, military OAT), `applyAIB`, `aibCard` (COAU air support request), `aibDosBrief`, `aibCrewBrief`, `aibPublic`, `exportAibPack` (from the IVAO *Guida alle operazioni BAT-AIB v2.0*) |
| Custom areas / NOTAM | `S.custom` (`cusFromParts` union outline of published areas with own vertical limits, `cusFinishDraw` drawn on the map, `cusFromScenario` convex polygon around the whole scenario (threat rings, areas, objectives, mission airspace, CAS / PR / SAR / AIB), max 10 vertices on whole minutes); an area created before the first generation sets `S.cusLock`: the scenario is centred on the custom areas, only they are reserved, published tracks / airway corridors are not used and levels are clamped to the custom limits (checkbox in the card); `notamList` one ICAO NOTAM per reserved / custom area and OAT corridor in use (Q-line, A, B/C from date + H-hour, E, F/G) in the Export tab and in the masterplan |
| Persistence | `save()` (current work), saved-events archive (`evSave`, `evLoad`, db or localStorage) |

Data contracts for the division database (zones, frequencies, ATC positions, bullseyes, tracks, navigation points): [`docs/DB_INTERFACE.md`](docs/DB_INTERFACE.md).

## Rules that must not break

- **Generated text is always English.** Italian is allowed only in the staff UI.
- **No participant names or VIDs in public outputs** (public page, decks, masterplan). Names appear in the staff briefing deck only when "with names" is ticked.
- **CAS 9-lines, targets and situation updates stay with staff and JTACs** (JTAC pack). Pilots get only JTAC frequencies, CP/IP, mission numbers, laser codes and blocks; `casPublic()` strips the rest from the public payload.
- **CSAR authentication (word/letter/number/color, challenge/password, duress, SARNEG), survivor positions and 9-line MEDEVAC stay in the PR pack**; pilots get only CSAR RV and SARDOT (`prPublic()`).
- **Civil SAR: real position of the persons in distress, their condition and the distress card stay in the SAR pack** (staff/RCC); pilots get only the general SAR procedure (`sarPublic()`), the search action plan is passed on frequency.
- **AIB: the fire evolution and injects stay in the AIB pack** (staff/DOS); pilots get fire location, OPAREA, DOS callsign / TBT and water sources (`aibPublic()`).
- **No invented ATC positions or frequencies.** Real APP/TWR/CTR come from the database or an imported file; otherwise they show TBC/TBD. Event roles (GCI, RCC, DOS, dispatch…) are exercise callsigns.
- **Everything stays inside the selected reserved areas** (R/D/TSA/TRA) unless it is published data (tracks, bullseyes).
- **Only what is pertinent to the event type is shown**; the rest is hidden or deselectable. Non-combat events use a sober briefing: no factions, threats or weapons.
- Fictional factions over real Italian airspace.

## Running and testing

```bash
npm install                 # playwright, pptxgenjs, pdf-lib (tests only)
npx playwright install chromium
npm run serve               # serves the repo at http://localhost:8765
npm test                    # browser tests: all event types, exports, no-names, no-Italian, save/load
npm run preview             # builds dist/index_pub.html (staff page + embedded demo scenario)
```

Tests run offline: Leaflet is replaced by `tests/mocks/lmock3.js`, other CDN calls are blocked. Paths can be overridden with `BASE_URL`, `NODE_MODULES`, `PLAYWRIGHT`, `CHROME` (see `tests/_env.js`).

## Status

Version 0.8. Open work and assumptions to verify: [`TODO.md`](TODO.md).


## Terrain data

Relief, elevations and run-in headings use the Copernicus DEM GLO-90 (© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA), resampled to ~250 m tiles in `data/dem` by the GitHub Actions workflow `dem.yml` (`tools/dem_build.py`).

## Navigation data

Flight plans and the map layer "Navigazione" use `data/navdb.json` (`tools/navdb_build.py`), built from the IVAO Italy sector files (AIRAC 2612: VOR / NDB / fixes with the FRA flag, lower airways, military procedure points and gates – the last two unpublished) and the AIP Italia ENR 6.3.1 list of VFR reporting points. To update for a new AIRAC: replace the files in `data/nav_src`, run `tools/nav_build.py`, `vrp_build.py`, `mil_build.py`, `vfi_build.py`, `awy_build.py`, then `navdb_build.py`.
