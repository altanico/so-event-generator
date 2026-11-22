# Notes for agents working on this repo

- Read README.md ("Rules that must not break") before changing generation or outputs.
- The app is one file, `index.html`. Make targeted edits; keep vanilla JS, no build step, no new CDN dependency without asking.
- Staff UI text is Italian; every generated text (masterplan, decks, public page, serials, glossary, kneeboard) is English.
- After changes: `npm run serve` then `npm test`; all tests must PASS. Add a test when adding an event type or an output section.
- Keep TODO.md up to date; the user decides when on-hold items start.
- Do not start implementing, building or publishing on your own: when the staff asks for a change, write it in TODO.md ("Next build") and wait until they say "fai la build". Then implement everything listed, test, build the preview and publish.

## Target: leave the Claude artifact, no Claude account (staff decision 22 Nov 2026 – mandatory)

The tool must work **without a Claude account and without the Claude artifact runtime**. Final home: the IVAO Italy website, behind the IVAO login. Until then it is hosted from this repository (GitHub Pages of `altanico/so-event-generator`) with **free access**.

### Two services, three access levels

| Level | Who | Can create | Outputs |
|---|---|---|---|
| `user` | anyone (no login needed; on the IVAO site: any IVAO member) | own missions: simple (one flight, alone) or complex (several participants / flights) | generic briefings only: mission pack (no branding), kneeboard, flight plans, map, JTAC / GCI / AAR sheets, area booking e-mail. **No masterplan.** |
| `sog` | members of an official IVAO Special Operations Group (in Italy only VFS) | everything `user` can, plus SO HQ events | + masterplan with IVAO SO (HQ) branding, ready for the SOG CEO to file on the IVAO SO website (approval belongs to SO HQ). Never published by the app. |
| `staff` | IVAO Italy SO staff | everything `sog` can, plus divisional events (national, not international) | + divisional event with the official IVAO Italy branding and the Italian division logo, public event page, NOTAM, division contacts |

- One generator, one event: an event created at any level can be saved and opened at any level; **the outputs adapt to the level of whoever opens it** (a `user` opening a staff event gets only the generic briefings; a `staff` member opening a user mission can turn it into a divisional / HQ event).
- Mapping from the current code: "Missione libera" = `user` simple; "Evento interno" = `user` complex; "Evento ufficiale" with organiser SOG = `sog` (HQ event); "Evento ufficiale" with organiser staff = `staff` (divisional, or HQ). `S.kind` / `S.org` stay as they are; add the event level (`S.level`: user / hq / division) and gate the choices on the viewer level.
- The viewer level comes from an **auth adapter** (one small module): IVAO site = IVAO login (IVAO SSO / OAuth – details to agree with the IVAO web team: staff positions of the Italian division → `staff`, SOG membership → `sog`).
- **While on GitHub (staff decision 22 Nov):** everything is public (public repo, free GitHub Pages, no paid plan). The normal link opens the `user` level. The `sog` and `staff` levels open from **separate links known only to the staff / SOG** (a secret key in the URL fragment, e.g. `#k=<key>`; the code holds only the SHA-256 of each key, never the key itself, so reading the public source does not reveal the links; the key is remembered in that browser's localStorage). This is not real security – the code is public and runs in the browser, anyone who edits it can reach the staff screens – it only keeps the levels out of sight until the IVAO login exists. Never put secrets, participant data or private documents in the repository.

### Event file (shared by everybody)

- Events are saved as a **file** anyone can open in the tool: JSON, versioned schema (`{ "format": "ivao-so-event", "version": N, "event": S }`), extension `.soevent.json`. Import / export from the "Eventi salvati" window; also autosave in localStorage.
- The file contains the scenario, not the outputs (outputs are generated when opened, at the viewer level).
- **Privacy (staff 22 Nov): the file never contains participants.** It holds only the mission itself: theatre, events, areas, bases, flights by callsign / type / task / loadout, scenario, timings, C2 positions and frequencies. Stripped on export: `S.roster` (pilots and controllers), the pilots of each flight (`f.pilots`), the controllers assigned to C2 rows, JTACs, GCI and any other person name or IVAO VID, the author ids of the saved-events list. Participants are added **locally** by each person who builds the mission (roster import / typing in "Partecipanti"), kept only in that browser (localStorage), never uploaded or shared. Opening a file = mission without participants; the generator keeps working (flights without names, "— not staffed —" controllers).
- Participant names never go into public outputs either (public page, NOTAM, public briefings) – rule unchanged.
- Old events (saved before the move, without `format`) must still open.

### What has to go (Claude artifact runtime)

Every use of `window.claude` must be replaced (grep `window.claude`):
- `claude.use('db')` – "Eventi salvati" in the artifact database → localStorage + file import / export (later the IVAO site backend, behind a storage adapter; a backend stores the mission only, never the participants).
- `claude.use('user')` – `officialInit()`, `evWho()`, names of the authors → auth adapter.
- `claude.use('artifact')` – "Pubblica" (re-saves index.html with `<script id="published-data">`) → on GitHub: download the public page / the published JSON and commit it to the repo (or a `published/` folder); on the IVAO site: backend publish.
- `claude.use('downloads')` – downloads → plain browser download (already the fallback).
The artifact (slug `dac91c44-e1a4-4d49-8bb1-b90380d2de76`) is only the old preview: do not add features that depend on it. Keep it working only until the staff says it can be dropped.

### Hosting on GitHub Pages (step 1)

- Static files only: `index.html`, `data/`, `fonts/`, `img/`, `vendor` libraries already referenced. Terrain tiles: `dist/data/dem/*` (from `python3 tools/dem_pub.py`) must be served as `data/dem/*`.
- The repository is made **public** (staff decision 22 Nov: no paid plan) and served with GitHub Pages. Before making it public, check the history and the data files for anything that must not be public (secrets, participant names in fixtures / saved events, files whose licence does not allow publishing, e.g. sector-file or AIP sources in `data/nav_src`, `data/aip_src`) and ask the owner about each doubtful one.
- Branding assets: IVAO SO logo exists (`img/ivao-so-logo.png`); the IVAO Italy division logo must be supplied by the staff (`img/ivao-it-logo.png`).

### Old preview (until dropped)

- The Claude artifact is republished from `dist/index_pub.html` (`npm run preview`). Before republishing, if the live version was saved from the page, read its published-data line and put it into dist/index_pub.html (keep the staff's published event), then publish with the live base_version.
