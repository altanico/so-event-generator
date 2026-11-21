const ENV = require('./_env.js');
// v1.25: ATS dependencies of military / joint aerodromes, ACC boundaries, real positions (sector file), GCA (PAR / SRA), ATS unit of the areas, base rules, M-345
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV,{timeout:15000}).catch(()=>fail.push('navdb not loaded'));
// data
const d=await page.evaluate(()=>({ atc:APP.NAV.atc.length, acc:!!APP.NAV.acc, lipl:APP.baseAcc('LIPL'), liba:APP.baseAcc('LIBA'), crotone:APP.accOf([38.9972,17.0802]), venezia:APP.accOf([45.5053,12.3519]),
  lire:APP.baseApp('LIRE'), lied:APP.baseApp('LIED'), lics:APP.baseApp('LIPS'), libg:APP.baseTwr('LIBG'), libgApp:APP.baseApp('LIBG'), gca:APP.baseGca('LIRS'), nogca:APP.baseGca('LIPA') }));
if(d.atc<150||!d.acc) fail.push('atc data '+JSON.stringify(d));
if(d.lipl!=='LIMM'||d.liba!=='LIRR'||d.crotone!=='LIBB'||d.venezia!=='LIPP') fail.push('ACC '+JSON.stringify([d.lipl,d.liba,d.crotone,d.venezia]));
if(!/LIRF_TW1_APP \/ LIRF_PN1_APP/.test(d.lire.cs)||!/online/.test(d.lire.note)) fail.push('LIRE app '+JSON.stringify(d.lire));
if(d.lied.cs!=='LIEE_APP'||!/LIEE_MIL_APP .*only when LIEE_APP/.test(d.lied.note)) fail.push('LIED app '+JSON.stringify(d.lied));
if(d.lics.cs!=='LIPH_APP'||!d.lics.freq) fail.push('LIPS app '+JSON.stringify(d.lics));
if(d.libg!==null||d.libgApp.cs!=='LIBG_APP') fail.push('LIBG: APP only');
if(d.gca.cs!=='LIRS_G_APP'||!d.gca.known||!d.gca.freq||d.nogca.known) fail.push('GCA positions '+JSON.stringify([d.gca,d.nogca]));
// bases: excluded ones never proposed, schools only for basic navigation, M-345
const bs=await page.evaluate(()=>{ const out=[]; ['NE','NO','CT','SA','SI','PU'].forEach(th=>{ APP.S.custom=[]; APP.setTheatre(th); APP.setEvents(['MIX']); APP.generateGeneric(); out.push(...APP.S.blueBases,...APP.S.redBases); });
  return { out, w:APP.baseWarn('LIRA'), ws:APP.baseWarn('LIBN'), cas:APP.baseOk('LIBN','CAS',{type:'EF-2000 Typhoon',cat:'FIGHTER'}), nav:APP.baseOk('LIBN','LOWNAV',{type:'M-345',cat:'ATTACK'}), navF:APP.baseOk('LIBN','LOWNAV',{type:'EF-2000 Typhoon',cat:'FIGHTER'}), lirl:APP.baseOk('LIRL','IFRNAV',{type:'PC-12 / King Air (light utility)',cat:'LIGHT'}) }; });
const bad=bs.out.filter(k=>['LIPX','LIMS','LIRA','LIRG','LIRN','LIEA','LICG','LIBR','LIRL','LIBN'].includes(k)); if(bad.length) fail.push('excluded / school base proposed '+bad.join(','));
if(!/Non proposto/.test(bs.w)||!/scuola/.test(bs.ws)) fail.push('base warnings');
if(bs.cas||!bs.nav||bs.navF||!bs.lirl) fail.push('school rules '+JSON.stringify(bs));
const m345=await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('PU'); APP.setEvents(['NAVL']); APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('2x M-345'); APP.tailor(); const f=APP.S.t.flights[0]; return f?{type:f.type,task:f.task}:null; });
if(!m345||m345.type!=='M-345'||m345.task!=='LOWNAV') fail.push('M-345 '+JSON.stringify(m345));
// C2: real positions from the sector file, MIL sector first, JTAC / RCC real frequencies
const c2=await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.setEvents(['MIX']); APP.generateGeneric(); APP.S.c2edit=false; APP.S.c2sel=null; return APP.proposeC2().map(r=>({key:r.key,cs:r.cs,freq:r.freq,role:r.role})); });
const g=k=>c2.find(r=>r.key===k);
if(!g('APP')||g('APP').cs!=='LIBV_APP'||!g('APP').freq) fail.push('APP row '+JSON.stringify(g('APP')));
if(!g('TWR')||g('TWR').cs!=='LIBV_TWR'||!g('TWR').freq) fail.push('TWR row '+JSON.stringify(g('TWR')));
const ctr=c2.filter(r=>r.key==='CTR'); if(!ctr.length||ctr[0].cs!=='LIBB_MIL_CTR'||ctr[0].freq!=='129.775'||!/Brindisi ACC/.test(ctr[0].role)) fail.push('CTR row '+JSON.stringify(ctr));
if(c2.some(r=>/FIR/.test(r.role))) fail.push('FIR still used for the CTR');
const cas=await page.evaluate(()=>{ APP.setTheatre('CT'); APP.setEvents(['CAS']); APP.generateGeneric(); return APP.proposeC2().find(r=>r.key==='JTAC'); }); if(!cas||cas.freq!=='136.160') fail.push('JTAC freq '+JSON.stringify(cas));
// ATS unit of the areas
const z=await page.evaluate(()=>{ const zs=APP.LIB(); const u=zs.filter(x=>x.unit); const sc=u.find(x=>/Milano SCCAM/.test(x.unit)), no=zs.find(x=>!x.unit&&x.poly); APP.S.resMode='manual'; APP.S.reserved=[sc.id];
  return { n:u.length, sc:sc?APP.zoneAts(sc):null, no:no?APP.zoneAts(no):null, notam:APP.notamList().map(x=>x.text).join('\n'), nres:APP.RES().length, card:APP.aspCard() }; });
if(z.n<150) fail.push('areas with an AIP unit '+z.n);
if(!z.sc||z.sc.cs!=='LIMM_MIL_CTR'||!z.sc.freq) fail.push('SCCAM mapping '+JSON.stringify(z.sc));
if(!z.no||!/_MIL_CTR$/.test(z.no.cs)) fail.push('fallback mapping '+JSON.stringify(z.no));
if(!/ATS UNIT: /.test(z.notam)) fail.push('NOTAM without the ATS unit '+z.nres+' '+z.notam.slice(0,300));
if(!/Ente ATS: /.test(z.card)) fail.push('area list without the ATS unit');
// GCA
await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('CT'); APP.S.resMode='auto'; APP.setEvents(['MIX']); APP.generateGeneric(); APP.S.blueBases=['LIRS']; APP.S.bases=null; APP.S.c2sel=null;
  APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('2x EF-2000\n2x F-35A\n1x KC-767A'); APP.tailor(); APP.TAB='gen'; APP.renderAll(); });
const card=await page.evaluate(()=>APP.c2Card()); if(!/Serve il GCA/.test(card)) fail.push('no GCA switch');
const gc=await page.evaluate(()=>{ APP.S.gca={on:true}; APP.S.c2sel=null; const rows=APP.proposeC2(); const t=APP.S.t; APP.S.gcaFl={[t.flights[0].cs]:'PAR'}; APP.gcaApply(t);
  return { rows:rows.filter(r=>r.key==='GCA').map(r=>[r.cs,r.freq,r.warn]), ser:t.serials.filter(s=>s.kind==='GCA').map(s=>s.title+' | '+s.text), tl:t.timeline.filter(x=>/^Recovery – /.test(x[1])).length, rec:t.flights.map(f=>f.rec||''), c2:t.c2.filter(c=>c.key==='GCA').map(c=>c.cs), spins:t.spins.filter(x=>/^Recovery \(GCA\)/.test(x)).length, card:APP.c2Card() }; });
if(!gc.rows.length||gc.rows[0][0]!=='LIRS_G_APP'||!gc.rows[0][1]) fail.push('GCA C2 row '+JSON.stringify(gc.rows));
if(!gc.ser.length||!/LIRS_APP .*LIRS_G_APP .*LIRS_TWR/.test(gc.ser[0])||!/PAR/.test(gc.ser[0])) fail.push('GCA serial '+JSON.stringify(gc.ser));
if(gc.tl!==1||gc.spins!==1||!gc.c2.includes('LIRS_G_APP')) fail.push('GCA timeline / spins / c2 '+JSON.stringify([gc.tl,gc.spins,gc.c2]));
if(!gc.rec[0]||!/^Recovery to LIRS: PAR – LIRS_APP → LIRS_G_APP final talk-down → LIRS_TWR$/.test(gc.rec[0])) fail.push('flight recovery '+gc.rec[0]);
if(!/data-gcafl/.test(gc.card)) fail.push('PAR / SRA selector per flight');
const twice=await page.evaluate(()=>{ APP.gcaApply(APP.S.t); return APP.S.t.serials.filter(s=>s.kind==='GCA').length+'/'+APP.S.t.timeline.filter(x=>/^Recovery – /.test(x[1])).length; }); if(twice!=='1/1') fail.push('gcaApply not idempotent '+twice);
const nog=await page.evaluate(()=>{ APP.S.blueBases=['LIRS','LIRP']; APP.S.t.flights[1].base='LIPA'; APP.S.c2sel=null; return APP.proposeC2().filter(r=>r.key==='GCA').map(r=>[r.cs,r.warn]); });
if(!nog.some(r=>r[0]==='LIPA_G_APP'&&/TBC/.test(r[1]))) fail.push('missing GCA warning '+JSON.stringify(nog));
await page.evaluate(()=>{ APP.S.t.flights[1].base='LIRS'; APP.gcaApply(APP.S.t); });
const fpl=await page.evaluate(()=>APP.fplAll().map(({p})=>p.out.f15+p.out.f18).join(' ')); if(/\bPAR\b|\bSRA\b|G_APP/.test(fpl)) fail.push('GCA in the flight plan');
const [d2]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>exportMasterplan(document.createElement('button')))]); await d2.saveAs('atc_mp.pdf');
const mpt=execSync('pdftotext atc_mp.pdf -').toString().replace(/\s+/g,' ');
if(!/Recovery – GCA \(PAR \/ SRA\)/.test(mpt)||!/LIRS_G_APP/.test(mpt)) fail.push('masterplan GCA');
if(!/ATS unit/.test(mpt)) fail.push('masterplan ATS unit column');
await page.click('[data-tab="fpl"]'); await page.waitForTimeout(300);
const lbl=await page.evaluate(()=>/Punti di interesse FRA/.test(document.body.innerHTML)&&!/Punti FRA pieni/.test(document.body.innerHTML)); if(!lbl) fail.push('FRA switch label');
console.log(JSON.stringify({c2:c2.map(r=>r.key+':'+r.cs+' '+r.freq),ser:gc.ser[0]}).slice(0,1500));
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
