// Runs every browser test in sequence from tests/out and fails if any prints an error.
// Needs the app served at BASE_URL (default http://localhost:8765, e.g. `npm run serve`).
const { execFileSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
const tests = ['free8.js','free7.js','free6.js','free5.js','free4.js','free3.js','free2.js','levels.js','free.js','atc.js','fpl.js','build33.js','build32.js','build31.js','build30.js','build29.js','noatc.js','build28.js','build27.js','build26.js','build25.js','build24.js','build23.js','build22.js','build21.js','build20.js','theatre.js','wizard.js','border.js','resmode.js','custom.js', 'corridors.js', 'lownav.js', 'aip.js', 'bases.js', 'aib.js', 'sar.js', 'pr.js', 'cas.js', 'evt.js', 'evt2.js', 'evt3.js', 'ita.js', 'save.js', 'fac.js', 'btn.js', 'nm.js', 'lib.js'];
let bad = 0;
// optional: node run_all.js 1/2 (first half) or 2/2 (second half), so each half fits in a shorter time budget
const part = (process.argv[2] || '').match(/^(\d)\/(\d)$/), list = part ? tests.filter((_, i) => i % +part[2] === +part[1] - 1) : tests;
for (const t of list) {
  let log = '';
  try { log = execFileSync('node', [path.join(__dirname, t)], { cwd: out, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 }); }
  catch (e) { log = (e.stdout || '') + (e.stderr || '') + '\nCRASH'; }
  const ok = !/PAGEERR|CRASH|"err":/.test(log);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t}`); if (!ok) console.log(log.split('\n').slice(-15).join('\n'));
}
process.exit(bad ? 1 : 0);
