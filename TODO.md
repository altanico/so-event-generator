# TODO

## Next build
- (none – waiting for the staff)

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

## Reserved areas UI (v1.11)
- Demo airspace removed. Before the first generation the staff chooses: areas proposed by the generator, or only the ticked ones (manual: the generator never changes them). "Deseleziona tutte" in the zone table; custom union uses the ticked areas.
- v1.15.2: reserved areas and OAT corridors are never selected by themselves: only "Proponile tu" (or the same answer before generating) proposes them. Choosing or drawing a theatre clears the selection (custom areas stay); ticking an area in the list or on the map switches to "Le scelgo io".
- v1.15.1: a new / reset event has no theatre, no bases and no areas: the map stays empty (Italy view) until the staff picks or draws the theatre in step 3; no "Avanti" and no generation before that.
- v1.15: "⟲ Reset" in the top bar (press twice): clears the current event, imported sectorfile points, filters, drawing/edit modes; saved events, API settings and aircraft aliases stay. Theatre can be drawn by hand (S.thCustom from mkTheatre: FIR and sea point from the nearest preset theatre, BLUE bases = nearest military airports, RED base = nearest airport inside the drawing, forces placed inside it); reserved areas proposed only if they touch the drawn theatre.
- v1.14.1: area proposals follow the levels each task flies (TASK_FL, e.g. AAR FL150-FL280, air-to-air FL100-FL350). Training events: nearest areas that fit those levels (AAR corridors first), no low-level areas unless published for an activity of the event (LOWLEVEL, PARA, HELO, FIRING); areas with an unknown upper limit are not proposed for a level band. Combat events: as before around the front, plus the nearest areas for any band not covered.
- v1.14: phase 1 is a step-by-step wizard (one step open, done steps folded into a summary line). New events start empty (no default "Misto"). Civil events hide the reserved-airspace step ("Mostra" to open it anyway) and have no threat step. Data source of the airspace folded under "Fonte dei dati". Clear restart actions: "Rigenera scenario" (same event) and "Nuovo evento vuoto" (back to step 1).
- v1.13: editable BLUE/RED boundary (S.border polyline: move / add / remove points, straight extension beyond the ends, reset to automatic; reset on theatre change). Ground elements (SAM, EWR, MANPADS, AAA, armour, HVT, isolated personnel; IADS/GROUND/HVT/SHORAD/PERSONNEL areas RED, LOGISTICS BLUE) are generated on their own side when the reserved areas allow it; wrong-side elements are listed in the panel.
- v1.12.3: with "Le scelgo io" the OAT corridors are off and never proposed; the staff turns them on one by one.
- v1.12.2: the map draws the same areas as the list (all Italy, search, type, state); reserved areas always shown.
- v1.12.1: the zone list keeps its scroll position when an area is ticked; search ignores spaces and dashes.
- v1.12: overlapping areas on the map open a pick list; zone table filters (name/id, type, state, all Italy) and sorting.

## AIP data layer (v1.3)
- Default reserved areas = military R / D / TRA / TSA areas of AIP ENR 5.1.2-5.1.4 + ENR 5.1.4 configurations. Remove at the site handover (docs/DB_INTERFACE.md).
- Update at each AIRAC with tools/aip_*.py. ENR 5.2 (other military areas, e.g. CBA) can be added the same way if needed.
- AAR corridors (ENR 5.2.2.1) added; route points BULAR, TIVUK, SUBOK, RONAB, ADUKA, TRP/SIG TACAN, ELB VORTAC: lateral limits taken from Aurora – replace with ENR 4.4 / 4.1 coordinates if available.

## Assumptions to verify
- NOTAM: series W, first number 1001, validity H-30 to H+240 min, Q-codes QRRCA (R) / QRDCA (D) / QRTCA (TSA, TRA, custom, corridors), scope IV/BO/W – all editable or to confirm with the staff.
- INDIA areas (AIP): levels read as the AEW operating levels – INDIA 2 FL310, INDIA 5 FL310 or above, INDIA 6 FL310 or FL290 (no published track), INDIA 7/8/9 FL290.
- AIB (v1.1): S-64 and other civil-operated types use registration + BAT (the manual gives CAN only for the CL-415); CL-415 numbers start at CAN 15; registrations are random I-XXXX; default separation (fixed wing 1500-2000 ft AGL at the entry point, helicopters below 1000 ft AGL) and phraseology examples are ours, since annex "M" is not in the manual; scooping lakes from a built-in list (approximate centres), sea scooping from the coastline; locality / municipality / province / elevation filled by the staff (no gazetteer / DEM).
- Fixed: land/sea test (`onLand`) never worked with the loaded coastline rings (also affected civil SAR placement).
- Civil SAR (v1.0): track spacing from the manual table at 1000 ft (helicopter / fixed wing); search radius from the area that the units can cover in ~90 min, at least 2 legs per unit; MRCC ROMA for sea, generic "RCC" over land; on-scene frequency from the RCCS position in the database, otherwise TBD; callsign letters assigned in order of tasking across all scenarios.
- CAS: magnetic variation fixed per event (default 3.5° E); target elevation left to the JTAC (no terrain model).
- Sectorfile format (SCT sections VOR/NDB/FIXES/VFR, coordinates `N043.20.10.000`) – tested only on a synthetic file.
- India (AEW) area floors interpreted as lower limits.
- Contact e-mail inferred.
- "Publish to public page" button not yet tested on the hosted page.
- Hospital, DOS and relief-cell names are generic placeholders.
