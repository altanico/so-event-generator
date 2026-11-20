const ENV = require('./_env.js');
// v1.18.2: CAS holding redrawn on change; Wheel and Keyhole as separate holdings
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
const r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.S.casCfg={nJtac:1,perJ:3,rw:0}; APP.setEvents(['CAS']); APP.generateGeneric(); APP.renderAll();
  APP.S.zones=APP.S.zones.filter(z=>!/SHORAD|IADS/.test(z.cat)); const J=APP.S.cas.jtacs[0], T=J.tasks.find(x=>!x.rw);
  for (const [h,ref] of [['RACETRACK','CP'],['FIGURE8','CP'],['WHEEL','CP'],['WHEEL','KEYHOLE'],['RACETRACK','KEYHOLE']]) { J.hold=h; J.ref=ref; APP.casDeconf(J); o[h+ref]={ n:APP.casHoldShape(J).length, txt:APP.casHold(J,T), first:JSON.stringify(APP.casHoldShape(J)[0][1]) }; }
  const k=APP.khGroups(J)[0]; o.rot=k.rot; o.eOnTgt=JSON.stringify(k.E)===JSON.stringify(J.targets.find(x=>x.id===k.tg[0]).pos)||k.tg.length>1;
  o.a7=APP.khLabel(k, dest(k.E,0,7*1.852)); o.c5=APP.khLabel(k, dest(k.E,185,5*1.852)); o.rad=APP.khLabel(k, dest(k.E,150,7*1.852)); return o; });
if(!/^WHEEL ORBIT 5 MILES/.test(r.WHEELCP.txt)) fail.push('wheel text '+r.WHEELCP.txt);
if(!/^KEYHOLE, ECHO IS .*, WHEEL ORBIT 5 MILES AROUND ECHO, IP ([A-D]\d+|\d{3}\/\d+), BLOCK/.test(r.WHEELKEYHOLE.txt)) fail.push('keyhole wheel text '+r.WHEELKEYHOLE.txt);
if(!/^KEYHOLE, ECHO IS .*, HOLD [A-D]\d+, RACETRACK/.test(r.RACETRACKKEYHOLE.txt)) fail.push('keyhole racetrack text '+r.RACETRACKKEYHOLE.txt);
if(new Set(['RACETRACKCP','FIGURE8CP','WHEELCP','WHEELKEYHOLE','RACETRACKKEYHOLE'].map(h=>r[h].first)).size!==5) fail.push('holding shapes not different');
if(r.rot!==0||!r.eOnTgt) fail.push('keyhole default rot/E'); if(r.a7!=='A7'||r.c5!=='C5'||!/^\d{3}\/7$/.test(r.rad)) fail.push('keyhole labels '+[r.a7,r.c5,r.rad]);
// the map is redrawn when the holding changes in the CAS tab
await page.click('#tabcas'); await page.waitForTimeout(300);
await page.evaluate(()=>{ window.__dm=0; const o=window.drawMap; window.drawMap=function(){ window.__dm++; return o.apply(this,arguments); }; });
await page.selectOption('select[data-cf="hold"]','WHEEL'); await page.waitForTimeout(200);
const dm=await page.evaluate(()=>window.__dm); if(!dm) fail.push('map not redrawn after the holding change');
const opts=await page.$$eval('select[data-cf="hold"] option',os=>os.map(o=>o.value).join('|')); if(opts!=='RACETRACK|FIGURE8|WHEEL') fail.push('select '+opts);
const refs=await page.$$eval('select[data-cf="ref"] option',os=>os.map(o=>o.value).join('|')); if(refs!=='CP|KEYHOLE') fail.push('ref select '+refs);
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
