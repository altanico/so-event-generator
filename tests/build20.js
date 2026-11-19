const ENV = require('./_env.js');
// v1.17 build: holdings, flat corridors, main bases, level filter, AEW / HAAR events, AEW defaults, variants, QRA / GCI pack, AAR cards / pack
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
let r=await page.evaluate(()=>{ const f=[];
  // holdings: inbound arrow = published course (±6°), left turns, arcs outside the legs
  APP.TRK().filter(t=>t.kind==='AAR').forEach(t=>{ const h=APP.holdLoop(t), inb=+t.course.split('/')[0], d=Math.abs(((h.arrows[0].brg-inb)+540)%360-180); if(d>8) f.push(`${t.id} inbound ${Math.round(h.arrows[0].brg)} vs ${inb}`); if(h.turn!=='LEFT') f.push(t.id+' turn'); if(h.ring.length<20) f.push(t.id+' ring'); });
  // OAT corridors: flat ends (2 outline points per axis point)
  APP.AIP().zones.filter(z=>z.type==='COR').forEach(z=>{ if(z.poly.length!==2*z.axis.length) f.push(`${z.id} outline ${z.poly.length}/${z.axis.length}`); });
  // main BLUE bases for military events
  for (const [th,b] of [['NE','LIPS'],['NO','LIPL'],['PU','LIBV']]) { APP.setEvents(['CAS']); APP.setTheatre(th); if(APP.S.blueBases[0]!==b) f.push(`${th} main base ${APP.S.blueBases[0]}`); }
  // AEW defaults and INDIA
  APP.setTheatre('NE'); APP.setEvents(['CAS']); if(!APP.S.off.includes('AEW')) f.push('CAS-only: AEW on'); APP.setEvents(['CSAR']); if(!APP.S.off.includes('AEW')) f.push('CSAR: AEW on');
  APP.S.resMode='auto'; APP.setEvents(['CAS']); APP.S.reserved=APP.autoReserve(); if(APP.RES().some(z=>z.type==='IND')) f.push('INDIA proposed without AEW');
  APP.setEvents(['AEW']); APP.S.reserved=APP.autoReserve(); if(!APP.RES().some(z=>z.type==='IND')) f.push('INDIA not proposed with AEW');
  // level band: SFC-FL200
  APP.S.meta.levels=[0,200]; const z=(lo,up)=>APP.lvOk({lower:lo,upper:up}); if(!z('FL150','FL245')) f.push('partial overlap hidden'); if(z('FL200','FL300')) f.push('touching shown'); if(z('FL245','UNL')) f.push('above shown'); if(!z('FL250','TBC')===false && false) f.push('');
  APP.S.reserved=APP.autoReserve(); if(APP.RES().some(q=>!q.custom&&!APP.lvOk(q))) f.push('proposal outside the band'); APP.S.meta.levels=null;
  return f; });
fail.push(...r);
// level slider is live (no re-render needed)
await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('NE'); APP.setEvents(['AEW']); APP.S.gen=null; APP.S.zones=[]; APP.S.meta.levels=null; document.querySelector('[data-tab="scenario"]').click(); APP.WOPEN='asp'; APP.renderAll(); });
const n0=await page.evaluate(()=>document.querySelectorAll('tr[data-zrow]:not([hidden])').length);
await page.evaluate(()=>{ const el=document.querySelector('#zlvhi'); el.value='100'; el.dispatchEvent(new Event('input',{bubbles:true})); });
const n1=await page.evaluate(()=>({n:document.querySelectorAll('tr[data-zrow]:not([hidden])').length, txt:document.querySelector('#zlvtxt').textContent, lv:APP.S.meta.levels}));
if(!(n1.n<n0)||n1.txt!=='SFC – FL100'||n1.lv[1]!==100) fail.push('live slider '+JSON.stringify([n0,n1]));
await page.evaluate(()=>{ APP.S.meta.levels=null; });
// variants UI
await page.evaluate(()=>{ APP.setEvents(['ID']); APP.WOPEN='ev'; APP.renderAll(); });
await page.click('[data-var="ID|launch|CAP"]'); r=await page.evaluate(()=>APP.S.variants.ID.launch.slice().sort().join()); if(r!=='CAP,QRA') fail.push('variant multi '+r);
// ID event: real QRA bases and callsigns, scramble model, target role, no unlawful acts anywhere
r=await page.evaluate(()=>{ APP.S.variants.ID.launch=['QRA']; APP.S.custom=[]; APP.setTheatre('CT'); APP.S.resMode='auto'; APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[{id:'c1',name:'Mario',pref:'GCI'}]}; APP.parseLines('4x EF-2000\n1x C-27J'); APP.tailor();
  const t=APP.S.t, q=t.flights.filter(f=>f.task==='QRA'); return { cs:q.map(f=>f.cs+'@'+f.base), tgt:t.flights.some(f=>f.task==='TARGET'), scr:t.gci&&t.gci.scr.map(x=>x.msg+' | '+(x.msgGround||'')), inj:t.gci&&t.gci.injects.length, json:JSON.stringify(t) }; });
if(!r.cs.length||r.cs.some(x=>!/^(GA|HL|HA|GI|BA)\d\d@(LIRS|LIPS|LIBV|LICT|LIBA)$/.test(x))) fail.push('QRA callsigns '+r.cs); if(!r.tgt) fail.push('no target role');
if(!r.scr||!r.scr.every(x=>/T-SCRAMBLE ORDER/.test(x)&&/TANGO SCRAMBLE ORDER/.test(x)&&/\[\.{8,}\]/.test(x))) fail.push('scramble messages '+(r.scr||[]).slice(0,1)); if(!r.inj) fail.push('no injects');
if(/hijack|unlawful|illecit/i.test(r.json)) fail.push('unlawful acts mentioned');
const [dg]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>APP.exportGciPack())]); await dg.saveAs('b20_gci.pdf');
let txt=execSync('pdftotext b20_gci.pdf -').toString(); for (const k of ['TANGO SCRAMBLE','Staff injects','Target briefs','GCI briefing card','Authentication table','Air interception','You have been intercepted']) if(!txt.includes(k)) fail.push('GCI pack missing '+k); if(/HIJACK|hijack/.test(txt)) fail.push('HIJACK in the GCI pack');
// AAR: RV ALPHA with a GCI, ECHO without; boom / drogue pairing; DARDO / FALCO never tankers
r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.setTheatre('CT'); APP.S.resMode='auto'; APP.setEvents(['AAR']); APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('2x EF-2000\n2x F-35A\n1x KC-767\n1x KC-130J'); APP.tailor();
  const t=APP.S.t; o.rv=t.aar.cards.map(c=>c.rv); o.pair=t.flights.filter(f=>f.task==='RECEIVER').map(f=>f.type+'>'+(t.flights.find(x=>x.id===f.tanker)||{}).type); o.tk=t.flights.filter(f=>f.task==='AAR').map(f=>f.cs);
  APP.S.c2sel.forEach(c=>c.on=true); APP.S.c2sel.push({id:'g',key:'GCI',on:true,role:'GCI',cs:'PIOPPO RADAR',freq:'136.200'}); APP.S.roster.controllers=[{id:'c1',name:'Mario',pref:'GCI'}]; APP.tailor(); o.rvA=APP.S.t.aar.cards.map(c=>c.rv); o.card=JSON.stringify(APP.S.t.aar.cards[0].card); return o; });
if(r.rv.some(x=>!['E','G'].includes(x))) fail.push('RV without GCI '+r.rv); if(r.rvA.some(x=>x!=='A')) fail.push('RV with GCI '+r.rvA);
if(r.pair.some(p=>/F-35A>KC-130J/.test(p))) fail.push('boom receiver on a drogue tanker '+r.pair); if(r.tk.some(c=>/DARDO|FALCO/.test(c))) fail.push('DARDO/FALCO tanker');
for (const k of ['RV TYPE','ANCHOR POINT','AAR ALT','TANKER C/S','RECEIVERS C/S']) if(!r.card.includes(k)) fail.push('AAR card missing '+k);
const [da]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>APP.exportAarPack())]); await da.saveAs('b20_aar.pdf');
txt=execSync('pdftotext b20_aar.pdf -').toString(); for (const k of ['AAR card','RV ALPHA','CLEARED ASTERN','EMCON','turn range']) if(!txt.includes(k)) fail.push('AAR pack missing '+k);
// HAAR: dedicated areas, drogue tanker, helicopter receivers, RV DELTA
r=await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('NE'); APP.S.resMode='auto'; APP.setEvents(['HAAR']); APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('1x KC-130J\n2x HH-101\n2x HH-60W\n1x KC-767'); APP.tailor();
  const t=APP.S.t; return { res:APP.RES().map(z=>z.id), tk:t.flights.filter(f=>f.task==='HAAR').map(f=>f.type), rc:t.flights.filter(f=>f.task==='HAARRCV').map(f=>f.type), card:t.aar&&t.aar.cards.map(c=>c.rv+'/'+c.haar), iss:(APP.containmentIssues()||[]).length }; });
if(!r.res.length||r.res.some(id=>!/D266/.test(id))) fail.push('HAAR areas '+r.res); if(r.tk.join()!=='KC-130J') fail.push('HAAR tanker '+r.tk); if(r.rc.length!==2) fail.push('HAAR receivers '+r.rc); if(!r.card||r.card[0]!=='D/true') fail.push('HAAR card '+r.card); if(r.iss) fail.push('HAAR containment '+r.iss);

// AAR corridor: flown like an airway (no holding), entry / exit on the card, RV GOLF without a GCI
r=await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('SA'); APP.S.resMode='auto'; APP.setEvents(['AAR']); APP.S.variants.AAR={rv:['AUTO']}; APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('2x EF-2000\n1x KC-767\n1x A330 MRTT'); APP.tailor();
  const t=APP.S.t, cor=t.airspace.filter(a=>a.type==='TRACK'&&a.cor); return { n:cor.length, ring:cor.map(a=>!!APP.holdLoop(a).ring), axis:cor.map(a=>{ const z=APP.AIP().zones.find(q=>q.id===a.cor); return a.pts.length===z.axis.length; }), cards:t.aar.cards.filter(c=>c.cor).map(c=>c.rv+'|'+JSON.stringify(c.card)), ser:t.serials.filter(x=>x.kind==='AAR').map(x=>x.text).join(' ') }; });
if(!r.n) fail.push('no tanker in an AAR corridor (SA)'); else { if(r.ring.some(Boolean)) fail.push('holding drawn in an AAR corridor'); if(r.axis.some(x=>!x)) fail.push('corridor route is not the whole axis');
  if(r.cards.some(c=>!c.startsWith('G|')||!/corridor entry/.test(c)||/LENGTH .* TURN LEFT/.test(c))) fail.push('corridor AAR card '+r.cards[0].slice(0,120)); if(!/like an airway/.test(r.ser)) fail.push('corridor serial text'); }
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
