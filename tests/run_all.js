// Runs every browser test in sequence from tests/out and fails if any prints an error.
// Needs the app served at BASE_URL (default http://localhost:8765, e.g. `npm run serve`).
const { execFileSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
const tests = ['lownav.js', 'aip.js', 'bases.js', 'aib.js', 'sar.js', 'pr.js', 'cas.js', 'evt.js', 'evt2.js', 'evt3.js', 'ita.js', 'save.js', 'fac.js', 'btn.js', 'nm.js', 'lib.js'];
let bad = 0;
for (const t of tests) {
  let log = '';
  try { log = execFileSync('node', [path.join(__dirname, t)], { cwd: out, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 }); }
  catch (e) { log = (e.stdout || '') + (e.stderr || '') + '\nCRASH'; }
  const ok = !/PAGEERR|CRASH|"err":/.test(log);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t}`); if (!ok) console.log(log.split('\n').slice(-15).join('\n'));
}
process.exit(bad ? 1 : 0);
