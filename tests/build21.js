const ENV = require('./_env.js');
// v1.18 build: bullseye layer, documents show only selected tracks / roles, AAR tracks follow the level band, HAAR zone and zone names, intercept targets, SMI
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
let r=await page.evaluate(()=>{ const f=[];
  // bullseye shown before generating, for events that use it; choosing another one
  APP.S.custom=[]; APP.setTheatre('SA'); APP.setEvents(['AEW']); APP.S.gen=null; APP.S.zones=[]; APP.S.t=null; if(!APP.bullShown()) f.push('bullseye not shown in phase 1'); APP.setBull('NADIA'); if(APP.S.meta.bullseye!=='NADIA') f.push('setBull');
  APP.setEvents(['AIB']); if(APP.bullShown()) f.push('bullseye shown for a civil event');
  // documents: only selected tracks and roles (AEW event, AAR off, only INDIA 9 reserved)
  APP.setEvents(['AEW']); APP.S.off=['AAR']; APP.S.resMode='manual'; APP.S.reserved=['INDIA-9']; APP.S.trkSel=[];
  const aew=APP.pubTracks('AEW').map(t=>t.id), aar=APP.pubTracks('AAR').map(t=>t.id), sup=APP.supportRow(); if(aew.join()!=='INDIA 9') f.push('AEW tracks '+aew); if(aar.length) f.push('AAR tracks with AAR off '+aar); if(sup && /AAR/.test(sup.roles)) f.push('support row with AAR off');
  APP.S.off=[]; APP.S.trkSel=['TERRA']; if(!APP.pubTracks('AAR').some(t=>t.id==='TERRA')) f.push('chosen AAR track missing'); APP.S.trkSel=[];
  // AAR tracks follow the level band through their areas; chosen ones stay
  APP.setTheatre('CT'); APP.setEvents(['AAR']); APP.S.meta.levels=[0,100]; const near=APP.aarNear().map(t=>t.id); if(near.includes('TERRA')) f.push('TERRA shown with SFC-FL100');
  APP.S.trkSel=['TERRA']; if(!APP.aarNear().some(t=>t.id==='TERRA')) f.push('chosen track hidden'); APP.S.trkSel=[]; APP.S.meta.levels=null;
  // HAAR: no event zone on top of the D266 areas; readable zone names
  APP.setTheatre('NE'); APP.S.resMode='auto'; APP.setEvents(['HAAR']); APP.generateGeneric(); if(APP.S.zones.some(z=>z.cat==='HAAR_T')) f.push('HAAR event zone with D266 reserved');
  for (const ev of [['ID'],['AAR'],['MIX'],['NAVL']]) { APP.setEvents(ev); APP.generateGeneric(); APP.S.zones.forEach(z=>{ if(/_T\b|NAV_/.test(z.name)) f.push('zone name '+z.name); }); }
  return f; });
fail.push(...r);
// intercept targets: high-performance by default; SMI variant -> slow target + SMI helicopter
r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.setEvents(['ID']); APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[{id:'c1',name:'M',pref:'GCI'}]}; APP.parseLines('2x EF-2000\n1x C172\n1x C-27J\n1x HH-139'); APP.tailor();
  const t=APP.S.t; o.fastTgt=t.flights.filter(f=>f.task==='TARGET').map(f=>f.type); o.smiFast=t.flights.filter(f=>f.task==='SMI').length;
  APP.S.variants.ID.tgt=['SMI']; APP.tailor(); const t2=APP.S.t; o.slowTgt=t2.flights.filter(f=>f.task==='TARGET').map(f=>f.type); o.smi=t2.flights.filter(f=>f.task==='SMI').map(f=>f.type); o.slowScr=(t2.gci?t2.gci.scr:[]).filter(q=>q.smi).length; o.ser=t2.serials.map(s=>s.title).join('|'); return o; });
if(r.fastTgt.join()!=='C-27J') fail.push('high-performance target '+r.fastTgt); if(r.smiFast) fail.push('SMI helicopter without the SMI variant');
if(!r.slowTgt.length||r.slowTgt.some(x=>/C-27J/.test(x))) fail.push('slow mover target '+r.slowTgt); if(r.smi.join()!=='HH-139') fail.push('SMI helicopter '+r.smi); if(!r.slowScr) fail.push('no slow-mover scramble'); if(!/SMI helicopter/.test(r.ser)) fail.push('SMI serials '+r.ser);
const [dg]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>APP.exportGciPack())]); await dg.saveAs('b21_gci.pdf');
if(!/SLOW MOVER/.test(execSync('pdftotext b21_gci.pdf -').toString())) fail.push('GCI pack without the SMI section');
// public page: no unselected INDIA / support AAR
r=await page.evaluate(async()=>{ APP.S.custom=[]; APP.setTheatre('SA'); APP.setEvents(['AEW']); APP.S.off=['AAR']; APP.S.resMode='manual'; APP.S.reserved=['INDIA-9']; APP.generateGeneric(); APP.S.reserved=['INDIA-9']; APP.S.t=null; const h=await APP.buildPublicHtml(APP.buildPayload(false)); return { len:h.length, i5:/"id":"INDIA 5"|<b>INDIA 5<\/b>/.test(h), i9:/INDIA 9/.test(h), sup:/<b>Support<\/b><\/td><td>[^<]*AAR/.test(h) }; });
if(!(r.len>1000)) fail.push('public html not built'); if(r.i5) fail.push('INDIA 5 on the public page'); if(r.sup) fail.push('AAR support on the public page');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
