# Notes for agents working on this repo

- Read README.md ("Rules that must not break") before changing generation or outputs.
- The app is one file, `index.html`. Make targeted edits; keep vanilla JS, no build step, no new CDN dependency without asking.
- Staff UI text is Italian; every generated text (masterplan, decks, public page, serials, glossary) is English.
- After changes: `npm run serve` then `npm test`; all tests must PASS. Add a test when adding an event type or an output section.
- The live preview is a Claude artifact (slug `dac91c44-e1a4-4d49-8bb1-b90380d2de76`); it is republished from `dist/index_pub.html` (`npm run preview`; terrain tiles: `python3 tools/dem_pub.py` then publish dist/data/dem/* as data/dem/*). Its declared capabilities: artifact, downloads, user (profile), db (rules: read/write admin only – saved events contain participant names).
- Keep TODO.md up to date; the user decides when on-hold items start.
- Do not start implementing, building or publishing on your own: when the staff asks for a change, write it in TODO.md ("Next build") and wait until they say "fai la build". Then implement everything listed, test, build the preview and publish.
