# TODO

## Next build
- [ ] **Editable BLUE/RED boundary** – polyline with points to add/move/remove on the staff map, "reset to automatic"; used in all maps, masterplan, decks, public page, ACM (FLOT); saved with the event.

## On hold (wait for the go-ahead)
- [ ] **Inflight guide (A5 kneeboard)** – one guide for all participants: frequencies, ATC/C2 positions, airports, reserved areas, map, bullseye/tracks/routes only if pertinent, timeline, code words, emergency/lost comms. Role details stay in the mission briefing. Open questions: max number of A5 pages; source of the aerodrome charts (vSOP site not reachable from the build environment – files or a saved page are needed).
- [ ] **Hand-over package for the website integration** – technical README, data model, tests (partly covered by this repo).

## Integration into the division website
- Connect zones, frequencies, ATC positions, sectorfile points directly to the division APIs (no CORS limits once hosted there).
- Staff access through IVAO login/roles instead of `#staff`.
- Move the saved-events archive from the artifact store / localStorage to the site database.
- Public page per event as a site route.
- Consider splitting `index.html` into modules.

## CAS – possible next steps
- **Terrain data (DEM)** once hosted on the division site (e.g. Open Topo Data SRTM 30 m): fill line 4 automatically and choose final attack headings along valleys / away from high ground.
- Talk-on text generator (needs photoreal references, so probably staff-written).
- Re-attack / second 9-line per flight, 5-line for helicopters if the manual adopts it.
- RAMROD abort codes instead of "abort in the clear".

## Confirmed by the staff (2026-11-19)
- CSAR A / CSAR B frequencies come from the database (not invented); LZ elevation read in the sim.
- AMC = event GCI/AWACS; OSC = first RESCORT, otherwise the downed pilot's wingman.
- 9-line MEDEVAC: line 8 always "A – military"; line 9 = terrain description (as in the manual example).

## Assumptions to verify
- CAS: magnetic variation fixed per event (default 3.5° E); target elevation left to the JTAC (no terrain model).
- Sectorfile format (SCT sections VOR/NDB/FIXES/VFR, coordinates `N043.20.10.000`) – tested only on a synthetic file.
- India (AEW) area floors interpreted as lower limits.
- Contact e-mail inferred.
- "Publish to public page" button not yet tested on the hosted page.
- Hospital, DOS and relief-cell names are generic placeholders.
