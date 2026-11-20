const ENV = require('./_env.js');
// v1.18.2: CAS holding redrawn on change; Wheel and Keyhole as separate holdings
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
const r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.S.casCfg={nJtac:1,perJ:3,rw:0}; APP.setEvents(['CAS']); APP.generateGeneric(); APP.renderAll();
  const J=APP.S.cas.jtacs[0], T=J.tasks.find(x=>!x.rw);
  for (const h of ['RACETRACK','FIGURE8','WHEEL','KEYHOLE']) { J.hold=h; o[h]={ n:APP.casHoldShape(J).length, txt:APP.casHold(J,T), first:JSON.stringify(APP.casHoldShape(J)[0][1]) }; }
  const k=APP.keyhole(J); o.kpts=k.pts.map(p=>p.n).join(); o.dB=Math.round(((k.pts[1].brg-k.axis)+360)%360); return o; });
if(!/WHEEL ORBIT/.test(r.WHEEL.txt)||/HOLD (ALPHA|BRAVO|CHARLIE|DELTA)/.test(r.WHEEL.txt)) fail.push('wheel text '+r.WHEEL.txt);
if(!/^KEYHOLE, ECHO POINT IS .*ALPHA AXIS \d{3} DEGREES .*HOLD (BRAVO|DELTA) \d+, BLOCK/.test(r.KEYHOLE.txt)) fail.push('keyhole text '+r.KEYHOLE.txt);
if(r.KEYHOLE.n<6) fail.push('keyhole shape '+r.KEYHOLE.n); if(r.WHEEL.n!==1) fail.push('wheel shape');
if(new Set(['RACETRACK','FIGURE8','WHEEL','KEYHOLE'].map(h=>r[h].first)).size!==4) fail.push('holding shapes not different');
if(r.kpts!=='ALPHA,BRAVO,CHARLIE,DELTA'||r.dB!==90) fail.push('keyhole points '+r.kpts+' '+r.dB);
// the map is redrawn when the holding changes in the CAS tab
await page.click('#tabcas'); await page.waitForTimeout(300);
await page.evaluate(()=>{ window.__dm=0; const o=window.drawMap; window.drawMap=function(){ window.__dm++; return o.apply(this,arguments); }; });
await page.selectOption('select[data-cf="hold"]','KEYHOLE'); await page.waitForTimeout(200);
const dm=await page.evaluate(()=>window.__dm); if(!dm) fail.push('map not redrawn after the holding change');
const opts=await page.$$eval('select[data-cf="hold"] option',os=>os.map(o=>o.textContent).join('|')); if(!/^.*Wheel \(AA bassa\).*Keyhole \(AA bassa\)/.test(opts)||/keyhole\)/.test(opts)) fail.push('select '+opts);
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
