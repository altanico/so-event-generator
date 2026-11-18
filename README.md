# IVAO SO – Event & Mission Generator

Web tool for the IVAO Italy Special Operations staff. From the event type and the list of participants it builds a complete training event: scenario, flights and tasks, serials, maps, **Masterplan PDF** (laid out like the SO template), **PowerPoint decks** (generic scenario and mission briefing) and a **public page** for participants.

- Live preview: https://claude.ai/artifact/U1xmPaGxN7WGa96h6WFsHo (staff view: add `#staff`)
- Staff tutorial (Italian): https://claude.ai/artifact/HdLXByYpT1NifAANHaS7uh

## How it works

Single self-contained page (`index.html`, vanilla JS, no build step). CDN libraries: Leaflet 1.9 (map), pptxgenjs 4 (decks), pdf-lib + fontkit (masterplan). Fonts and logo are in `fonts/` and `img/`.

Staff workflow, four tabs:

1. **Scenario** – event type (combinable: combat, training, civil), required roles, theatre and reserved airspace, threats (combat only), ATC/C2 positions → generic scenario used to announce the event.
2. **Participants** – pilots and controllers (manual, quantities, paste, CSV/JSON).
3. **Tailoring** – flights, tasks, serials, routes, frequencies built from who signed up.
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
| Persistence | `save()` (current work), saved-events archive (`evSave`, `evLoad`, db or localStorage) |

Data contracts for the division database (zones, frequencies, ATC positions, bullseyes, tracks, navigation points): [`docs/DB_INTERFACE.md`](docs/DB_INTERFACE.md).

## Rules that must not break

- **Generated text is always English.** Italian is allowed only in the staff UI.
- **No participant names or VIDs in public outputs** (public page, decks, masterplan). Names appear in the staff briefing deck only when "with names" is ticked.
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

Version 0.7. Open work and assumptions to verify: [`TODO.md`](TODO.md).
