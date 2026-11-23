const ENV = require('./_env.js');
// v1.33: route points appended in order, border card + map tool, all areas, area type order, compact levels card, bases of the assets (chips, per-flight base, computed RED airfields),
// simple-mission defaults and callsigns from the staff's list (FPL short / GAT forms), Calibration (military aerodromes, checks filtered by facilities)
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV&&!!APP.CSN,{timeout:15000}).catch(()=>fail.push('navdb / callsigns not loaded'));
await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.renderAll(); }); await page.click('[data-kind="free"]');
// defaults and callsigns
const def=async(mis,sub)=>page.evaluate(([m,s])=>{ const F=APP.FREE(); F.mis=m; F.sub=s||''; if(m==='CALIB') F.calChk=[s]; F.rr=true; F.flights=[]; F.areas=null; F.built=0; APP.S.fpl=null; F.step=2; APP.renderAll(); const x=F.flights[0]; return [x.type,x.dep,x.cs,x.task].join('|'); },[mis,sub]);
const want={ 'STRIKE':'F-35A|LIPL|LUCE 01|STRIKE', 'ID':'EF-2000 Typhoon|LIRS|GA01|QRA', 'MAR/MPA':'P-72A|LICZ|SPADA 01|MPA', 'AIRMOB/AIRLIFT':'C-130J|LIRP|LYRA 01|AIRLIFT', 'AIRMOB/AIRDROP':'C-130J|LIRP|LYRA 01|AIRDROP',
  'AIRMOB/INSERT':'HH-101|LIRM|TIGER 01|INSERT', 'AIRMOB/HUMAN':'Falcon 900|LIRA|TANGO 01|HUMAN', 'CALIB/CPAPI':'P-180 Avanti|LIRE|FLIGHTCHECK 66|CALIB' };
for(const [k,v] of Object.entries(want)){ const [m,s]=k.split('/'); const got=await def(m,s); if(got!==v) fail.push(`default ${k}: ${got}`); }
const anti=await def('MAR','ANTISHIP'); if(/P-72A/.test(anti)) fail.push('anti-surface got the MPA default '+anti);
// FPL field 7: short form of the list, GAT callsign when all GAT
const f7=await page.evaluate(()=>({ a:APP.csFpl('FRECCIA 01',false,'LIPL'), b:APP.csFpl('FLIGHTCHECK 03',false,'LIRE'), c:APP.csFpl('DARDO 02',true,'LIRS'), d:APP.csFpl('WOLF 01',true,'LIBG'), e:APP.csFpl('VIPER 1',false,'LIPS') }));
if(f7.a!=='FRECC01'||f7.b!=='FLTCK03'||f7.c!=='IAM0402'||f7.d!=='MMI0001'||f7.e!==null) fail.push('callsign FPL forms '+JSON.stringify(f7));
// calibration: only military aerodromes, filtered by the check
await def('CALIB','CILS'); const cil=await page.evaluate(()=>[...document.querySelectorAll('[data-calad]')].map(b=>b.dataset.calad));
if(cil.includes('LIRV')||cil.includes('LIMS')||cil.includes('LIRA')||!cil.includes('LICZ')||cil.length!==15) fail.push('ILS aerodromes '+cil);
await def('CALIB','CPAR'); const par=await page.evaluate(()=>[...document.querySelectorAll('[data-calad]')].map(b=>b.dataset.calad).sort().join());
if(par!=='LIBN,LIBV,LIPC,LIPI,LIPL,LIPS,LIRM,LIRS') fail.push('PAR aerodromes '+par);
await def('CALIB','CNAV'); await page.click('[data-calad="LIPL"]'); const aid=await page.evaluate(()=>({ aids:[...document.querySelectorAll('[data-calaid]')].map(b=>b.dataset.calaid), sel:APP.FREE().cal.aid, reach:document.querySelector('.b.primary[data-fstep="3"]').disabled }));
if(aid.aids.join()!=='GHE:TACAN'||aid.sel!=='GHE:TACAN') fail.push('LIPL radio aids '+JSON.stringify(aid));
await page.click('[data-calland="ad"]'); await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1000);
const cal=await page.evaluate(()=>({ arr:APP.FREE().flights[0].arr, ser:APP.S.t.serials.map(r=>r.title+' '+r.text).join(' '), arcs:APP.S.t.airspace.filter(a=>/^CAL-/.test(a.id||'')).length, f18:APP.fplAll()[0].p.out.f18 }));
if(cal.arr!=='LIPL'||!/GHE TACAN/.test(cal.ser)||!/10 DME arc/.test(cal.ser)||cal.arcs!==2||!/FLTCHK/.test(cal.f18)) fail.push('calibration '+JSON.stringify(cal));
// calibration with several checks: ILS + PAPI + PAR → only the aerodromes with all three, one serial per check, one final
await def('CALIB','CILS'); await page.check('[data-calchk="CPAPI"]').catch(()=>{}); await page.evaluate(()=>{ APP.FREE().step=2; APP.renderAll(); });
await page.evaluate(()=>{ const F=APP.FREE(); F.calChk=['CILS','CPAPI','CPAR']; F.step=2; APP.renderAll(); });
const multi=await page.evaluate(()=>[...document.querySelectorAll('[data-calad]')].map(b=>b.dataset.calad).sort().join());
if(multi!=='LIBN,LIBV,LIPC,LIPL,LIPS,LIRS') fail.push('aerodromes with ILS + PAPI + PAR '+multi);
await page.click('[data-calad="LIPS"]'); await page.fill('#calrwy','25'); await page.dispatchEvent('#calrwy','change'); await page.waitForTimeout(100);
await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1000);
const mc=await page.evaluate(()=>({ ser:APP.S.t.serials.filter(r=>r.kind==='CALIB').map(r=>r.title), fin:APP.S.t.airspace.filter(a=>a.id==='CAL-FIN').length, name:APP.freeName? APP.freeName():'' }));
if(mc.ser.length!==3||!/ILS/.test(mc.ser[0])||!/PAPI/.test(mc.ser[1])||!/PAR/.test(mc.ser[2])||mc.fin!==1) fail.push('several checks '+JSON.stringify(mc));
// route points appended in order (departure = arrival)
const ord=await page.evaluate(()=>{ const F=APP.FREE(); F.mis='NAV'; F.prof='IOAT'; F.flights=[]; F.areas=null; F.built=0; APP.S.fpl=null; F.step=2; APP.renderAll(); APP.freePrep(); F.step=4; APP.renderAll();
  const f=APP.S.t.flights[0], b=APP.ap(f.base); document.getElementById('faddpt').click(); [[0.5,0.2],[0.6,0.6],[0.2,0.7]].forEach(d=>APP.routeMapClick([b[0]+d[0],b[1]+d[1]])); const p=APP.routeOf(f).pts.map(p=>p.pos); return p.map(q=>[+(q[0]-b[0]).toFixed(1),+(q[1]-b[1]).toFixed(1)]); });
if(JSON.stringify(ord.map(x=>x[0]))!==JSON.stringify([0.5,0.6,0.2])) fail.push('points not in the order added '+JSON.stringify(ord));
// a new mission clears the navigation points of the previous one
const nl=await page.evaluate(()=>{ APP.S.navOn=true; APP.drawNav(); const g=APP.NAVL; let c=0; const o=g.clearLayers; g.clearLayers=()=>{ c++; return o(); }; APP.newMissionNow(); g.clearLayers=o; return { navOn:APP.S.navOn, cleared:c }; });
if(nl.navOn||!nl.cleared) fail.push('navigation points not cleared by a new mission '+JSON.stringify(nl));
// events
await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.S.kind='internal'; APP.S.custom=[]; APP.setTheatre('NE'); APP.S.resMode='auto'; APP.setEvents(['CAS','ID']); APP.generateGeneric(); APP.TAB='scenario'; APP.renderAll(); });
const ev=await page.evaluate(()=>({ all:APP.ZF.all, opts:[...document.querySelectorAll('#zftype option')].map(o=>o.textContent), card:document.body.innerHTML.includes('Basi degli assetti'), sel:!!document.querySelector('select[data-bside]'), held:document.body.innerHTML.includes('Aeroporti occupati da RED') }));
if(!ev.all) fail.push('area list not "Tutta Italia" by default');
if(ev.sel||ev.held) fail.push('old base selects / RED-held card still there');
// bases: add, per-flight base, RED airfields computed
const bs=await page.evaluate(()=>{ const r1=APP.S.blueBases.slice(); APP.basesSet(['LIPS','LIPA']); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('4x EF-2000\n2x HH-101'); APP.tailor(); APP.TAB='tailor'; APP.renderAll();
  const btns=document.querySelectorAll('[data-fbase]').length, f=APP.S.t.flights[0], other=f.base==='LIPS'?'LIPA':'LIPS'; document.querySelector(`[data-fbase="${f.id}|${other}"]`).click(); const cs0=f.cs0;
  APP.tailor(); const f2=APP.S.t.flights.find(x=>x.cs0===cs0); return { r1, btns, moved:f2&&f2.base, other, red:APP.RB(), redSide:APP.RB().every(k=>APP.borderSide(APP.ap(k))==='RED'), cs:APP.S.t.flights.map(x=>x.cs) }; });
if(!bs.btns||bs.moved!==bs.other) fail.push('per-flight base '+JSON.stringify(bs));
if(!bs.red.length||!bs.redSide||bs.red.length>2) fail.push('RED airfields from the border '+JSON.stringify(bs.red));
if(!bs.cs.some(c=>/^GRAPPA \d\d$|^HL\d\d$/.test(c))) fail.push('event callsigns from the list '+bs.cs);
// border card + map tool
await page.evaluate(()=>{ APP.TAB='scenario'; APP.renderAll(); });
const bd=await page.evaluate(()=>({ tool:!!document.querySelector('[data-bordtool]') }));
if(!bd.tool) fail.push('border map tool missing');
await page.click('[data-bordtool]'); if(!(await page.evaluate(()=>APP.BEDIT))) fail.push('border tool does not open the edit');
// levels card compact
const lv=await page.evaluate(()=>{ APP.TAB='scenario'; const h=APP.zoneLvHtml? APP.zoneLvHtml():''; return h; });
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
