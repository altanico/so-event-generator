const ENV = require('./_env.js');
// v1.36: NDB checks in NDB terms (orbit, QDM / QDR, kHz), kneeboard in two parts (transit / calibration) with every frequency once, en-route units along the route
// (OAT → military, GAT → civil), pasted flight plans (ICAO message, route only, IVAO .fpl, airways, unknown points), basic-aid note, step-2 date panel
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV&&!!APP.CSN,{timeout:15000}).catch(()=>fail.push('navdb / callsigns not loaded'));
await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.renderAll(); }); await page.click('[data-kind="free"]');
const cal=async(chk)=>page.evaluate(([k])=>{ const F=APP.FREE(); F.mis='CALIB'; F.calChk=k; F.flights=[]; F.areas=null; F.built=0; APP.S.fpl=null; F.step=2; APP.renderAll(); },[chk]);
const kneeTxt=()=>page.evaluate(async()=>{ const P=PDFLib.PDFPage.prototype, o=P.drawText; const t=[]; let min=99; P.drawText=function(s,op){ t.push(s); if((op.size||24)<min) min=op.size; return o.call(this,s,op); };
  try { const pdf=await APP.kneeboardPdf(); return { txt:t.join('\n'), min, pages:pdf.getPageCount() }; } finally { P.drawText=o; } });
// step 2 panel: labels on one line, the three inputs aligned; help text under the flights
await cal(['CNAV']);
const pan=await page.evaluate(()=>{ const r=['fdate','fhh','fdur'].map(id=>document.getElementById(id).getBoundingClientRect()); const ls=[...document.querySelectorAll('.fwhen label')].map(l=>l.getBoundingClientRect().height);
  const h=document.querySelector('.fhelp'), w=document.querySelector('.fwhen'); return { top:r.map(x=>Math.round(x.top)), h:r.map(x=>Math.round(x.height)), lab:ls, helpBefore: !!(h&&w&&(h.compareDocumentPosition(w)&Node.DOCUMENT_POSITION_FOLLOWING)) }; });
if(new Set(pan.top).size!==1||new Set(pan.h).size!==1||Math.max(...pan.lab)>Math.min(...pan.lab)+2||!pan.helpBefore) fail.push('step 2 panel '+JSON.stringify(pan));
// NDB RIV at LIPI: 371 kHz, orbit / QDM / QDR, no radial / DME
await cal(['CNAV']); await page.click('[data-calad="LIPI"]'); await page.click('[data-calaid="RIV:NDB"]'); await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(800);
const ndb=await page.evaluate(()=>APP.S.t.serials.filter(r=>r.kind==='CALIB').map(r=>r.text).join(' '));
if(!/371\.0 kHz/.test(ndb)||/radial|DME|110\.00/i.test(ndb)||!/QDM \d{3}/.test(ndb)||!/orbit/.test(ndb)) fail.push('NDB serial: '+ndb);
const kn=await kneeTxt(); const nsec=kn.txt.slice(kn.txt.indexOf('FLIGHT CHECK - RIV NDB')>=0?kn.txt.indexOf('FLIGHT CHECK - RIV NDB'):kn.txt.indexOf('Flight check - RIV NDB'));
if(!/orbit: 10 NM/.test(kn.txt)||/arc: 10 DME/.test(kn.txt)||!/QDM/.test(kn.txt)) fail.push('NDB kneeboard drawing / checklist');
// TACAN RIV still TACAN
await cal(['CNAV']); await page.click('[data-calad="LIPI"]'); await page.click('[data-calaid="RIV:TACAN"]'); await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(800);
const tac=await page.evaluate(()=>APP.S.t.serials.filter(r=>r.kind==='CALIB').map(r=>r.text).join(' ')); if(!/CH 37X/.test(tac)||!/radial/.test(tac)) fail.push('TACAN serial: '+tac);
// LIRE → LIPS, OAT route: transit = LIRE + Roma MIL + Padova MIL; calibration ATC in part 2; every frequency once
await cal(['CNAV','CILS','CPAPI','CPAR']); await page.click('[data-calad="LIPS"]'); await page.click('[data-calaid="ISA:TACAN"]'); await page.click('[data-calland="ad"]'); await page.fill('#calrwy','25'); await page.dispatchEvent('#calrwy','change');
await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1000); await page.evaluate(()=>{ APP.FREE().step=4; APP.renderAll(); }); await page.waitForTimeout(600);
await page.evaluate(()=>{ [[42.22,11.73],[44.54,11.29],[45.64,11.68]].forEach(p=>APP.routeMapClick(p)); }); await page.waitForTimeout(400);
const c2=await page.evaluate(()=>APP.S.t.c2.map(c=>c.key+':'+c.cs));
const rte=c2.filter(x=>/^RTE:/.test(x)).map(x=>x.slice(4)); if(rte.join()!=='LIRE_TWR,LIRF_TW1_APP / LIRF_PN1_APP,LIRR_MIL_CTR,LIPP_MIL_CTR') fail.push('route units OAT '+rte);
if(!['CAL:LIPH_APP','CAL:LIPS_TWR','CAL:LIPS_G_APP'].every(x=>c2.includes(x))) fail.push('calibration ATC '+c2);
const k1=await kneeTxt();
const i2=k1.txt.indexOf('Part 2 - Calibration'); if(i2<0) fail.push('no part 2');
const p1=k1.txt.slice(0,i2); if(!/FLIGHT PLAN|Flight plan/i.test(p1)||!/LIRR_MIL_CTR/.test(p1)||!/LIPP_MIL_CTR/.test(p1)||/LIPH_APP/.test(p1)) fail.push('part 1 content');
const tp=await page.evaluate(()=>{ const t=[]; return t; });
for(const fq of ['118.050','123.225','123.175','120.405','124.355','118.355']){ const n=(k1.txt.match(new RegExp(fq.replace('.','\\.'),'g'))||[]).length; if(n!==1) fail.push(`frequency ${fq} written ${n} times`); }
if(k1.pages>6) fail.push('kneeboard pages '+k1.pages); if(k1.min<9) fail.push('text under 9 pt');
if(!/Suggested route only/.test(k1.txt)) fail.push('basic-aid note missing in the kneeboard');
// same route as GAT: civil units
await page.evaluate(()=>{ const f=APP.S.t.flights[0], R=APP.routeOf(f); R.legs.forEach(l=>{ l.type='IGAT'; }); APP.routeSet(f,()=>{}); });
const g=await page.evaluate(()=>APP.S.t.c2.filter(c=>c.key==='RTE').map(c=>c.cs+' '+c.freq).join(' | ')); if(/MIL_CTR/.test(g)||!/LIRR_xx_CTR NE 124\.200/.test(g)||!/LIPP_xx_CTR/.test(g)) fail.push('route units GAT '+g);
// pasted plans
const ps=await page.evaluate(()=>{ const f=APP.S.t.flights[0], o={};
  APP.fplPasteApply(f,'(FPL-FLTCK66-IM\n-P180/L-SDFGRY/S\n-LIRE0900\n-N0280F220 TAQ DCT XXXXX DCT 4530N01200E/N0280F180 VIC\n-LIPS0110 LIPA\n-STS/STATE DOF/261130)');
  let p=APP.fplBuild(f); o.full={ f15:p.out.f15, f16:p.out.f16, pts:p.pts.map(x=>x.name), lv:p.legs.map(l=>l.lvl), warn:p.warn.join(' | '), pasted:p.pasted, txt:APP.fplDocsTxt?'':'' };
  APP.fplPasteApply(f,'N0300F200 MOULE L146 ROSKI'); p=APP.fplBuild(f); o.awy=p.pts.map(x=>x.id);
  APP.fplPasteApply(f,'[FLIGHTPLAN]\nID=FLTCK67\nRULES=I\nFLIGHTTYPE=M\nACTYPE=P180\nWAKECAT=L\nDEPICAO=LIRE\nDEPTIME=1000\nSPEEDTYPE=N\nSPEED=300\nLEVELTYPE=F\nLEVEL=240\nROUTE=TAQ DCT CHI\nDESTICAO=LIPS\nEET=0100'); p=APP.fplBuild(f); o.ivao=[p.out.f7,p.out.f15,p.pasted].join(' / ');
  APP.fplPasteUndo(f); p=APP.fplBuild(f); o.undo=[p.pasted,p.out.f7,p.out.f15].join(' / '); return o; });
if(ps.full.f15!=='N0280F220 TAQ DCT XXXXX DCT 4530N01200E/N0280F180 VIC'||ps.full.f16!=='LIPS0110 LIPA'||ps.full.pts.join()!=='TAQ,4530N01200E,VIC'.replace('TAQ',ps.full.pts[0])||ps.full.lv.join()!=='FL220,FL220,FL180,FL180'||!/punto non trovato: XXXXX/.test(ps.full.warn)||ps.full.pasted!=='ICAO FPL') fail.push('pasted ICAO '+JSON.stringify(ps.full));
if(ps.awy.join()!=='MOULE,XOPTA,ELB,ELKAP,ROSKI') fail.push('airway expansion '+ps.awy);
if(ps.ivao!=='FLTCK67 / N0300F240 TAQ DCT CHI / IVAO .fpl') fail.push('IVAO .fpl '+ps.ivao);
if(ps.undo.split(' / ')[0]!==''||/FLTCK67|CHI/.test(ps.undo)) fail.push('undo '+ps.undo);
// paste box in the flight plan panel
await page.evaluate(()=>{ APP.renderAll(); }); const box=await page.$('[data-fplpasteok]'); if(!box) fail.push('paste box missing');
else { await page.click('[data-fplpastebox] summary'); await page.fill('[data-fplpaste]','N0300F200 TAQ DCT BOA DCT VIC'); await page.click('[data-fplpasteok]'); await page.waitForTimeout(300); const u=await page.$('[data-fplundo]'); if(!u) fail.push('undo button missing after paste'); }
if(errs.length) fail.push(...errs);
console.log(fail.length?'FAIL\n'+fail.join('\n'):'PASS free8'); await b.close(); process.exit(fail.length?1:0);})();
