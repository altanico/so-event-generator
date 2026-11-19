// Converts IVAO Aurora sector file area files (italy.restrict, italy.danger) into the generator's airspace JSON
// (docs/DB_INTERFACE.md). Output: data/aurora_zones.json. The whole Aurora layer can be removed by deleting
// data/aurora_zones.json and data/aurora_src/ – the app then falls back to the database / imported file / demo data.
// Usage: node tools/aurora_to_json.js data/aurora_src/italy.restrict data/aurora_src/italy.danger > data/aurora_zones.json
const fs = require('fs');
const deg = s => { const m = String(s).trim().match(/^([NSEW])(\d{3})\.(\d{2})\.(\d{2}(?:\.\d+)?)$/); if (!m) return NaN; const v = +m[2] + +m[3] / 60 + +m[4] / 3600; return /[SW]/.test(m[1]) ? -v : v; };
const r5 = x => +x.toFixed(5);
const typeOf = n => /^TSA/.test(n) ? 'TSA' : /^TRA/.test(n) ? 'TRA' : /^AAR/.test(n) ? 'D' : /^AT /.test(n) ? 'D' : /^R\d/.test(n) ? 'R' : /^D\d/.test(n) ? 'D' : 'R';
const noteOf = n => /^AAR/.test(n) ? 'Air-to-air refuelling area' : /^AT /.test(n) ? 'Tactical training area (AT)' : '';
const zones = new Map();
for (const file of process.argv.slice(2)) {
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('//')) continue;
    const f = line.split(';'); if (f.length < 6) continue;
    const a = [deg(f[0]), deg(f[1])], b = [deg(f[2]), deg(f[3])], name = f[5].trim();
    if (a.some(isNaN) || b.some(isNaN) || !name || /^INDIA/.test(name)) continue; // INDIA areas are built in with their vertical limits
    if (!zones.has(name)) zones.set(name, { name, kind: f[4].trim(), rings: [[]] });
    const z = zones.get(name), same = (p, q) => p && q && Math.abs(p[0] - q[0]) < 1e-4 && Math.abs(p[1] - q[1]) < 1e-4;
    if (same(a, b)) continue;
    let ring = z.rings[z.rings.length - 1]; const has = p => ring.some(q => same(p, q));
    // segments may be listed out of order or reversed: add the endpoints not yet in the ring; a segment touching neither starts a new ring
    if (ring.length >= 3 && !has(a) && !has(b)) { z.rings.push([]); ring = z.rings[z.rings.length - 1]; }
    for (const p of [a, b]) if (!ring.some(q => same(p, q))) ring.push(p);
  }
}
const out = [];
for (const z of zones.values()) z.rings.filter(r => r.length >= 3).forEach((r, i, all) => {
  const id = 'AUR-' + z.name.replace(/[^A-Za-z0-9]+/g, '') + (all.length > 1 ? '-' + (i + 1) : '');
  out.push({ id, name: z.name + (all.length > 1 ? ` (${i + 1})` : ''), type: typeOf(z.name), lower: 'TBC', upper: 'TBC',
    notes: [noteOf(z.name), 'Lateral limits from the IVAO Aurora sector file; vertical limits TBC from AIP ENR 5.1 / NOTAM (not in the sector file)'].filter(Boolean).join('. '),
    source: 'aurora', poly: r.map(p => [r5(p[0]), r5(p[1])]) });
});
process.stdout.write(JSON.stringify({ source: 'IVAO Aurora sector file (italy.restrict, italy.danger)', generated: new Date().toISOString().slice(0, 10), zones: out }, null, 0));
