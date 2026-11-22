const ENV = require('./_env.js');
// v1.27: access levels (user / sog / staff, #k= links with SHA-256 only), outputs by level, mission file without participants, no Claude runtime, public page from published/event.json
const { chromium } = require(ENV.PW); const fs = require('fs');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
let PUBJSON=null;
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX});
  if(u.includes('published/event.json')) return PUBJSON?r.fulfill({status:200,contentType:'application/json',body:PUBJSON}):r.fulfill({status:404,body:''}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html'); await page.waitForTimeout(1500); const fail=[];
// no Claude runtime in the source
const src=await page.evaluate(async()=>(await fetch('index.html')).text()); if(/window\.claude|claude\.use\(/.test(src)) fail.push('Claude runtime still used');
// normal link opens the generator (not the public page)
if(!(await page.evaluate(()=>document.getElementById('staffview') && !document.getElementById('staffview').hidden && getComputedStyle(document.getElementById('staffview')).display!=='none'))) fail.push('normal link does not open the generator');
// levels and first screen
const scr=async lv=>page.evaluate(lv=>{ APP.setLevel(lv); APP.S.kind=''; APP.renderAll(); return [...document.querySelectorAll('[data-kind]')].map(b=>b.dataset.kind).join(','); },lv);
if(await scr('user')!=='free,internal') fail.push('user choices '+await scr('user'));
if(await scr('sog')!=='free,internal,hq-sog') fail.push('sog choices '+await scr('sog'));
if(await scr('staff')!=='free,internal,hq,division') fail.push('staff choices '+await scr('staff'));
if(!/UTENTE/.test(await page.evaluate(()=>{ APP.setLevel('user'); return document.getElementById('lvbadge').textContent; }))) fail.push('level badge');
// #k= links: only the SHA-256 is in the code
const kr=await page.evaluate(async()=>{ const h=await APP.sha256hex('test-key-123'); APP.LEVEL_KEYS[h]='sog'; location.hash='#k=test-key-123'; await APP.levelInit(); const a=APP.LEVEL, kept=localStorage.getItem('ivao-so-key'); location.hash='#k=wrong'; await APP.levelInit(); const b2=APP.LEVEL; location.hash='#k=off'; await APP.levelInit(); return {a,kept,b2,c:APP.LEVEL,hash:location.hash}; });
if(kr.a!=='sog'||!/test-key-123/.test(kr.kept||'')||kr.c!=='user'||kr.hash!=='#app') fail.push('key links '+JSON.stringify(kr));
if(Object.keys(await page.evaluate(()=>APP.LEVEL_KEYS)).some(k=>!/^[0-9a-f]{64}$/.test(k))) fail.push('a key in clear in the code');
// a divisional event, with participants
await page.evaluate(()=>{ APP.setLevel('staff'); APP.S=APP.newScenario(); APP.S.kind='official'; APP.S.level='division'; APP.S.custom=[]; APP.setTheatre('CT'); APP.S.resMode='auto'; APP.setEvents(['CAS']); APP.generateGeneric(); APP.S.meta.date='12 DEC 2026'; APP.S.meta.hHour='19:00Z';
  APP.S.roster={pilots:[],controllers:[{id:'c1',vid:'998877',name:'Giulia Bianchi',pos:'JTAC'}]}; APP.addPilot({name:'Mario Rossi',vid:'654321',typeRaw:'EF-2000'}); APP.addPilot({name:'Luca Verdi',vid:'123987',typeRaw:'EF-2000'}); APP.addPilot({name:'Anna Neri',vid:'555444',typeRaw:'A-10'}); APP.tailor(); APP.TAB='export'; APP.renderAll(); });
const inS=await page.evaluate(()=>JSON.stringify(APP.S)); if(!/Mario Rossi/.test(inS)) fail.push('fixture: names not in the event');
let ex=await page.textContent('#panel'); if(!/Evento divisionale/.test(ex)||!/event\.json/.test(ex)||!/NOTAM/.test(ex)) fail.push('staff export of a divisional event');
// outputs by level: sog -> HQ, user -> generic briefings only
await page.evaluate(()=>{ APP.setLevel('sog'); APP.renderAll(); }); ex=await page.textContent('#panel');
if(await page.evaluate(()=>APP.effLevel())!=='hq'||/event\.json/.test(ex)||/Bozza dei NOTAM|NOTAM \(ICAO/.test(ex)) fail.push('sog view of a divisional event');
await page.evaluate(()=>{ APP.setLevel('user'); APP.renderAll(); }); ex=await page.textContent('#panel');
if(await page.evaluate(()=>APP.KIND())!=='internal'||!/Mission pack PDF/.test(ex)||/Masterplan PDF/.test(ex)) fail.push('user view of a divisional event');
// mission file: no participants
const [d]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.evaluate(()=>{ APP.setLevel('staff'); document.getElementById('evbtn').click(); document.getElementById('evexp').click(); })]);
if(!/\.soevent\.json$/.test(d.suggestedFilename())) fail.push('file name '+d.suggestedFilename());
await d.saveAs('lv_event.soevent.json'); const ft=fs.readFileSync('lv_event.soevent.json','utf8'), fj=JSON.parse(ft);
if(fj.format!=='ivao-so-event'||fj.version!==1||!fj.event) fail.push('file format');
['Mario Rossi','Luca Verdi','Anna Neri','Giulia Bianchi','654321','123987','555444','998877'].forEach(n=>{ if(ft.includes(n)) fail.push('participant in the file: '+n); });
if(!fj.event.t||!fj.event.t.flights.length||!fj.event.t.flights.every(f=>f.cs&&f.type)) fail.push('mission missing from the file');
// open the file: mission without participants, generator works
const op=await page.evaluate(t=>{ APP.S=APP.evOpenFile(JSON.parse(t)); APP.renderAll(); return { r:APP.S.roster.pilots.length+APP.S.roster.controllers.length, fl:APP.S.t.flights.length, kind:APP.S.kind }; },ft);
if(op.r||!op.fl||op.kind!=='official') fail.push('opening the file '+JSON.stringify(op));
// public page from published/event.json
PUBJSON=await page.evaluate(()=>JSON.stringify(APP.buildPayload(true)));
if(/Mario Rossi|654321/.test(PUBJSON)) fail.push('names in the published data');
await page.evaluate(()=>{ location.hash='#evento'; }); await page.waitForTimeout(1200);
const pv=await page.evaluate(()=>({ txt:(document.getElementById('publicview')||{}).textContent||'', link:!!document.querySelector('#publicview a[href="#app"]') }));
if(!/NOTAM|Reserved airspace|Flights|briefing/i.test(pv.txt)||!pv.link) fail.push('public page '+pv.txt.slice(0,200));
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
