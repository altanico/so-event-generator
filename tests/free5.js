const ENV = require('./_env.js');
// v1.32: aerodrome symbols (civil / military / joint / enemy, red only for enemy bases), RAD check of IGAT departures / arrivals,
// simple-mission defaults (AIB CL-415 from a civil airport, AAR KC-767 / AEW G550 at LIRE, HAAR HH-101 at LIPC, INDIA only for AEW aircraft), real hospital helipads
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV&&!!APP.RAD&&!!APP.CSN,{timeout:15000}).catch(()=>fail.push('navdb / rad not loaded'));
// symbols
const sy=await page.evaluate(()=>({ civ:APP.apSvg('LIPZ'), mil:APP.apSvg('LIPS'), joint:APP.apSvg('LIPX'), red:APP.apSvg('LIPI',{red:true}), k:[APP.apKind('LIPZ'),APP.apKind('LIPS'),APP.apKind('LIPX')] }));
if(sy.k.join()!=='CIV,MIL,JOINT') fail.push('aerodrome kinds '+sy.k);
if(!/#0f766e/.test(sy.civ)||!/#1e293b/.test(sy.mil)||!/<rect/.test(sy.joint)||!/#dc2626/.test(sy.red)||!/dasharray/.test(sy.red)) fail.push('aerodrome symbols');
if([sy.civ,sy.mil,sy.joint].some(x=>/#dc2626|#be185d/.test(x))) fail.push('red / magenta in a non-enemy symbol');
if([sy.civ,sy.mil,sy.joint,sy.red].some(x=>/<line/.test(x))) fail.push('a line through the circle (no-entry look)');
// defaults
await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.renderAll(); }); await page.click('[data-kind="free"]');
const def=async(mis,sub)=>{ await page.evaluate(([m,s])=>{ const F=APP.FREE(); F.mis=m; F.sub=s||''; F.flights=[]; F.areas=null; F.built=0; APP.S.fpl=null; F.step=2; APP.renderAll(); },[mis,sub]); await page.waitForTimeout(150); return page.evaluate(()=>{ const x=APP.FREE().flights[0]; return { type:x.type, cs:x.cs, dep:x.dep, arr:x.arr, task:x.task }; }); };
const aib=await def('AIB'); if(aib.type!=='CL-415 Canadair'||aib.cs!=='CAN 07'||aib.dep!=='LIRA') fail.push('AIB default '+JSON.stringify(aib));
const aar=await def('AIRMOB','AAR'); if(aar.type!=='KC-767'||aar.dep!=='LIRE'||aar.arr!=='LIRE'||aar.task!=='AAR') fail.push('AAR default '+JSON.stringify(aar));
const aew=await def('AEW'); if(aew.type!=='G550 CAEW'||aew.dep!=='LIRE'||aew.task!=='AEW') fail.push('AEW default '+JSON.stringify(aew));
const ind=await page.evaluate(()=>{ const F=APP.FREE(); const a=APP.freeCands().map(x=>x.z.type); F.flights[0].type='EF-2000 Typhoon'; F.flights[0].task='DCA'; const b=APP.freeCands().map(x=>x.z.type); return {a,b}; });
if(ind.a[0]!=='IND'||ind.b.includes('IND')) fail.push('INDIA areas only for AEW aircraft '+JSON.stringify(ind));
// HAAR: helicopter role -> HH-101 at LIPC
await def('AIRMOB','AAR'); await page.selectOption('[data-ff][data-k="task"]','HAARRCV').catch(()=>fail.push('no role select in AAR'));
await page.waitForTimeout(150); const haar=await page.evaluate(()=>{ const x=APP.FREE().flights[0]; return { type:x.type, dep:x.dep, arr:x.arr, cs:x.cs }; });
if(haar.type!=='HH-101'||haar.dep!=='LIPC'||haar.arr!=='LIPC'||!/^TIGER \d\d$/.test(haar.cs||'')) fail.push('HAAR default '+JSON.stringify(haar));
// typed base stays
await page.fill('[data-k="dep"]','LIPA'); await page.dispatchEvent('[data-k="dep"]','change'); await page.waitForTimeout(100);
await page.selectOption('[data-ff][data-k="task"]','RECEIVER').catch(()=>{}); await page.selectOption('[data-ff][data-k="task"]','HAARRCV').catch(()=>{}); await page.waitForTimeout(100);
if(await page.evaluate(()=>APP.FREE().flights[0].dep)!=='LIPA') fail.push('typed base overwritten');
// RAD: IGAT departure from LIPS
await page.evaluate(()=>{ const F=APP.FREE(); F.mis='NAV'; F.prof='IGAT'; F.flights=[]; F.areas=null; F.built=0; APP.S.fpl=null; F.step=2; APP.renderAll(); });
await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(900); await page.click('.b.primary[data-fstep="4"]'); await page.waitForTimeout(300);
const rad=await page.evaluate(()=>{ const f=APP.S.t.flights[0], R=APP.routeOf(f), P=n=>{ const q=APP.navRes(n,[45.7,12.1]); return {id:q.id,name:q.id,pos:q.pos,k:q.k,x:q.x}; };
  const pts=APP.radPts(f,'dep'); const help=!!document.querySelector('[data-radadd]');
  R.pts=[P('PES')]; R.legs=[{type:'IGAT',lvl:150,agl:1000},{type:'IGAT',lvl:150,agl:1000}]; const w1=APP.fplAll()[0].p.warn.join(' | ');
  R.pts=[P('BOA')]; const w2=APP.fplAll()[0].p.warn.join(' | ');
  R.legs=[{type:'IOAT',lvl:150,agl:1000},{type:'IOAT',lvl:150,agl:1000}]; R.pts=[P('PES')]; const w3=APP.fplAll()[0].p.warn.join(' | ');
  return { ok:pts&&pts.ok, help, w1, w2, w3 }; });
if(!rad.ok||!rad.ok.includes('BOA')||!rad.help) fail.push('RAD points LIPS '+JSON.stringify(rad));
if(!/Partenza IGAT LIPS: PES non è un punto RAD/.test(rad.w1)) fail.push('RAD warning missing '+rad.w1);
if(/Partenza IGAT LIPS/.test(rad.w2)) fail.push('RAD warning on a RAD point '+rad.w2);
if(/RAD/.test(rad.w3)) fail.push('RAD check on OAT legs '+rad.w3);
const civ=await page.evaluate(()=>{ const f=APP.S.t.flights[0]; f.base='LIRF'; f.arr='LIRF'; const R=APP.routeOf(f); R.legs=[{type:'IGAT',lvl:150,agl:1000},{type:'IGAT',lvl:150,agl:1000}]; const w=APP.fplAll()[0].p.warn.join(' | '); f.base='LIPS'; f.arr=undefined; return w; });
if(!/SID obbligatoria/.test(civ)) fail.push('SID warning for a civil airport '+civ);
const cond=await page.evaluate(()=>{ const r=APP.RAD.arr.LIMF; return r&&r[0].onlydep; }); if(!cond||cond[0]!=='LIMZ') fail.push('RAD condition parse '+JSON.stringify(cond));
// map markers
const mk=await page.evaluate(()=>{ const o=L.divIcon; let n=0; L.divIcon=x=>{ if(x&&x.className==='apsym') n++; return o(x); }; APP.renderAll(); L.divIcon=o; return n; }); if(!mk) fail.push('aerodrome symbol not on the map');
// real hospital helipads
const hp=await page.evaluate(()=>{ APP.HELI={list:[['Ospedale Civile Venezia','Venezia',45.4395,12.3417,1],['Azienda Ospedaliera di Padova','Padova',45.4011,11.8918,1],['Ospedale di Treviso','Treviso',45.6672,12.2554,1],['Ospedale di Mestre','Mestre',45.5122,12.2338,1]]};
  const F=APP.FREE(); F.mis='MED'; F.sub='HOSPITAL'; F.flights=[]; F.areas=null; F.built=0; APP.S.fpl=null; F.flights.push({id:'h1',cs:'PEGASO 1',type:'AW109 / H145 / H135 (light twin helo)',size:1,dep:'LIPZ',arr:'LIPZ',form:true,task:'HOSPITAL'}); APP.freePrep();
  const o=APP.S.t.objectives.filter(x=>x.type==='HOSP'||/helipad/.test(x.name||'')).map(x=>x.name); const ser=APP.S.t.serials.map(r=>r.text).join(' '); APP.HELI=null; return { o, osm:/OpenStreetMap/.test(ser) }; });
if(!hp.o.some(n=>/Ospedale|Azienda/.test(n))||!hp.osm) fail.push('real helipads '+JSON.stringify(hp));
console.log(JSON.stringify({aib,aar,aew,haar}));
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
