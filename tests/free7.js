const ENV = require('./_env.js');
// v1.35: simple missions without the exercise name (callsign – mission, file name), KNOCK IT OFF only for tactical missions, FLIGHTCHECK 66–69,
// Calibration: ATC positions of the checked aerodrome (LIPI PAR), arrival back to the departure, kneeboard checklist pages (form fields, TACAN, no loadout), route popup buttons
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV&&!!APP.CSN,{timeout:15000}).catch(()=>fail.push('navdb / callsigns not loaded'));
await page.evaluate(()=>{ APP.S=APP.newScenario(); APP.renderAll(); }); await page.click('[data-kind="free"]');
const def=async(mis,sub)=>page.evaluate(([m,s])=>{ const F=APP.FREE(); F.mis=m; F.sub=s||''; if(m==='CALIB') F.calChk=[s]; F.rr=true; F.flights=[]; F.areas=null; F.built=0; APP.S.fpl=null; F.step=2; APP.renderAll(); const x=F.flights[0]; return [x.cs,x.arr].join('|'); },[mis,sub]);
const kneeTxt=()=>page.evaluate(async()=>{ const P=PDFLib.PDFPage.prototype, o=P.drawText; const t=[]; let min=99; P.drawText=function(s,op){ t.push(s); if((op.size||24)<min) min=op.size; return o.call(this,s,op); };
  try { const pdf=await APP.kneeboardPdf(); const fl=pdf.getForm().getFields().map(f=>f.getName()); return { txt:t.join('\n'), min, fields:fl }; } finally { P.drawText=o; } });
// FLIGHTCHECK 66 default
const cs=await def('CALIB','CNAV'); if(!/^FLIGHTCHECK 66\|/.test(cs)) fail.push('calibration callsign '+cs);
// LIPI PAR: positions and frequencies of the checked aerodrome
await def('CALIB','CPAR'); await page.click('[data-calad="LIPI"]'); await page.click('[data-calland="ad"]'); await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1000);
const par=await page.evaluate(()=>({ ser:APP.S.t.serials.filter(r=>r.kind==='CALIB').map(r=>r.text).join(' '), c2:APP.S.t.c2.map(c=>c.cs+' '+c.freq).join(' | '), f7:APP.fplAll()[0].p.out.f7, file:APP.fileBase? APP.fileBase():'' }));
if(!/LIPI_G_APP 127\.525/.test(par.ser)||!/LIPI_G_APP 127\.525/.test(par.c2)||!/LIPI_TWR/.test(par.c2)) fail.push('LIPI PAR ATC '+JSON.stringify(par));
if(!/FLTCK66/.test(par.f7||'')) fail.push('field 7 '+par.f7);
const k1=await kneeTxt();
if(!/LIPI_G_APP/.test(k1.txt)||!/127\.525/.test(k1.txt)) fail.push('kneeboard without the GCA frequency');
if(/KNOCK IT OFF/i.test(k1.txt)||!/MAYDAY/.test(k1.txt)) fail.push('calibration emergencies');
if(/Loadout/.test(k1.txt)) fail.push('loadout in the calibration kneeboard');
if(!k1.fields.some(n=>/CPAR_PASS$/.test(n))||!k1.fields.some(n=>/CPAR_FAIL$/.test(n))||!k1.fields.some(n=>/CPAR_remarks$/.test(n))||!k1.fields.some(n=>/CPAR_step1$/.test(n))) fail.push('form fields '+k1.fields);
if(k1.min<9) fail.push('text under 9 pt: '+k1.min);
const sop=await page.evaluate(()=>APP.S.meta.op); if(sop&&k1.txt.includes(sop)) fail.push('exercise name in a simple mission: '+sop);
if(!/FLIGHTCHECK 66 . Calibration/.test(k1.txt)) fail.push('kneeboard title '+k1.txt.split('\n').filter(l=>/FLIGHTCHECK|training/.test(l)).slice(0,3));
// check change → arrival back to the departure
const arr=await page.evaluate(()=>{ const F=APP.FREE(); F.step=1; APP.renderAll(); const c2=document.querySelector('[data-calchk="CILS"]'); if(c2){ c2.checked=true; c2.dispatchEvent(new Event('change',{bubbles:true})); } const f=APP.FREE().flights[0]; return [f.dep,f.arr,APP.FREE().cal.ad].join('|'); });
if(!/^(\w+)\|\1\|$/.test(arr)) fail.push('arrival after a check change '+arr);
// CNAV kneeboard: TACAN channel + paired VHF, one section per check
await def('CALIB','CNAV'); await page.click('[data-calad="LIPL"]'); await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1000);
const k2=await kneeTxt(); if(!/CH \d+[XY]/.test(k2.txt)||!/MHz/.test(k2.txt)||!/arc: 10 DME/.test(k2.txt)) fail.push('CNAV kneeboard TACAN / drawing');
const fn=await page.evaluate(()=>APP.fileBase()); if(fn!=='FLIGHTCHECK66_Calibration') fail.push('file name '+fn);
await def('CALIB','CILS'); await page.evaluate(()=>{ const F=APP.FREE(); F.calChk=['CILS','CPAPI','CPAR']; F.step=2; APP.renderAll(); }); await page.click('[data-calad="LIPS"]'); await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1000);
const k3=await kneeTxt(); const secs=(k3.txt.match(/^Check \d\/3/mg)||[]).length, pass=k3.fields.filter(n=>/_PASS$/.test(n)).length;
if(pass!==3||!/angle ____ deg/.test(k3.txt)) fail.push('one section per check '+JSON.stringify({secs,pass}));
const tv=await page.evaluate(()=>[APP.tacVhf('35Y'),APP.tacVhf('17X'),APP.tacVhf('70X'),APP.tacVhf('126X')].join()); if(tv!=='109.85,108.00,112.30,117.90') fail.push('TACAN → VHF '+tv);
// tactical mission keeps KNOCK IT OFF
await def('ID'); await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(1000); const k4=await kneeTxt(); if(!/KNOCK IT OFF/.test(k4.txt)) fail.push('interception without KNOCK IT OFF');
// route popup: two buttons
const pop=await page.evaluate(()=>{ const f=APP.S.t.flights[0], p=APP.NAV.pts[0], R=APP.routeOf(f); const keep=R.pts.slice(); R.pts.length=0; const h0=APP.navPopup(p,f); R.pts.push({pos:p.pos,name:'X'}); const h1=APP.navPopup(p,f); R.pts.length=0; R.pts.push(...keep);
  const d=s=>{ const e=document.createElement('div'); e.innerHTML=s; return { add:!!e.querySelector('[data-navadd]'), rep:!!e.querySelector('[data-navrep]'), sel:!!e.querySelector('[data-navrepsel]'), ok:/>\s*OK\s*</.test(s) }; }; return [d(h0),d(h1)]; });
if(!pop[0].add||pop[0].rep||!pop[1].add||!pop[1].rep||!pop[1].sel||pop[1].ok) fail.push('route popup '+JSON.stringify(pop));
if(errs.length) fail.push(...errs);
console.log(fail.length?'FAIL\n'+fail.join('\n'):'PASS free7'); await b.close(); process.exit(fail.length?1:0);})();
