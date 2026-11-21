const ENV = require('./_env.js');
// v1.18.1: bullseye layer above the areas, bullseye select, bullseye in the pick list; authentication switch, letter-line table, RAMROD, CAS abort codes
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
let r=await page.evaluate(()=>{ const f=[];
  APP.S.custom=[]; APP.setTheatre('SA'); APP.setEvents(['AEW']);
  const sel=APP.bullSelHtml(), n=(sel.match(/<option/g)||[]).length; if(!/<select id="bull"/.test(sel)) f.push('no bullseye select'); if(n<2) f.push('bullseye select options '+n);
  APP.setBull('NADIA'); const nb=APP.bullNear(APP.bullPos ? APP.bullPos() : [0,0]); const h=APP.zonePickHtml([], nb); if(!nb||!/data-bullpick/.test(h)) f.push('bullseye missing from the pick list');
  // authentication: on by default for military events, off for civil
  APP.S.meta.auth=null; if(!APP.authOn()) f.push('auth off by default'); APP.setEvents(['AIB']); if(APP.authOn()) f.push('auth on for a civil event');
  APP.setEvents(['AEW']); const w=APP.ramrod(); if(!w||w.length!==10||new Set(w).size!==10) f.push('ramrod '+w); if(APP.ramEnc(31)!==w[3]+w[1]) f.push('ramrod encoding');
  return f; });
fail.push(...r);
if(!(await page.evaluate(()=>{ const p=document.querySelector('.leaflet-bulls-pane'); return !p || +getComputedStyle(p).zIndex>400 || +p.style.zIndex>400; }))) fail.push('bullseye pane below the areas');
// tailored CAS + GCI event with authentication on, then off
r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.setEvents(['CAS','ID']); APP.S.meta.auth=null; APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[{id:'c1',name:'M',pref:'GCI'},{id:'c2',name:'N',pref:'JTAC'}]}; APP.parseLines('2x EF-2000\n2x Tornado IDS\n1x C-27J'); APP.tailor();
  const t=APP.S.t; o.spin=(t.spins||[]).filter(x=>/^Authentication: /.test(x)); o.auth=t.auth; o.abort=APP.S.cas?APP.S.cas.jtacs.flatMap(J=>J.tasks.map(T=>T.abort)):[];
  APP.S.meta.auth=false; APP.applyAuth(APP.S.t); o.spinOff=(APP.S.t.spins||[]).filter(x=>/^Authentication: /.test(x)); o.abortOff=APP.S.cas?APP.S.cas.jtacs.flatMap(J=>J.tasks.map(T=>T.abort)):[]; APP.S.meta.auth=true; APP.applyAuth(APP.S.t); return o; });
if(r.spin.length!==1||!/REQUIRED\. .*RAMROD/.test(r.spin[0])) fail.push('auth SPINS '+r.spin); if(!r.auth||!r.auth.on||!r.auth.table.lines.length) fail.push('auth object');
if(!r.abort.length||r.abort.some(a=>!/^ABORT CODE [A-Z]{2} \(\d\d\)$/.test(a))) fail.push('abort codes '+r.abort);
if(r.spinOff.length!==1||!/NOT REQUIRED/.test(r.spinOff[0])) fail.push('auth off SPINS '+r.spinOff); if(r.abortOff.some(a=>a!=='ABORT IN THE CLEAR')) fail.push('abort off '+r.abortOff);
const [dg]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>APP.exportGciPack())]); await dg.saveAs('b22_gci.pdf');
const txt=execSync('pdftotext b22_gci.pdf -').toString(); if(!/Authentication table/.test(txt)) fail.push('GCI pack without the authentication table'); if(!/RAMROD/.test(txt)) fail.push('GCI pack without RAMROD'); if(/GCI1|Method GCI2/.test(txt)) fail.push('GCI1/GCI2 named in the pack');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
