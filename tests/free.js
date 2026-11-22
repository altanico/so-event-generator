const ENV = require('./_env.js');
// v1.26: first screen, missione libera (4 steps), loadouts, internal / SOG events, simpler wizard
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV,{timeout:15000}).catch(()=>fail.push('navdb not loaded'));
// new event -> first screen with 3 choices
await page.evaluate(()=>{ APP.S=APP.newScenario?APP.newScenario():APP.S; });
await page.evaluate(()=>{ APP.S.kind=''; APP.renderAll(); });
const ch=await page.textContent('#panel'); if(!/Cosa vuoi preparare/.test(ch)||!/Evento divisionale/.test(ch)||!/Missione con più partecipanti/.test(ch)||!/Missione semplice/.test(ch)) fail.push('first screen');
if(!(await page.evaluate(()=>document.getElementById('tabs').hidden))) fail.push('tabs visible on the first screen');
// missione libera CAS
await page.click('[data-kind="free"]'); await page.waitForTimeout(200);
await page.click('[data-fmis="CAS"]'); await page.waitForTimeout(100);
if(!/Da solo/.test(await page.textContent('#panel'))||!/Con altri partecipanti/.test(await page.textContent('#panel'))) fail.push('solo / others');
if(/amici|amico/i.test(await page.textContent('#panel'))) fail.push('word amici');
await page.click('[data-fmis="ID"]'); await page.waitForTimeout(100);
if(!(await page.$('#frr'))||!/S\.3\.9/.test(await page.textContent('#panel'))) fail.push('R&R notice');
if(!(await page.$eval('[data-fstep="2"].primary',e=>e.disabled))) fail.push('interception without the R&R tick');
await page.click('[data-fmis="CAS"]'); await page.click('.b.primary[data-fstep="2"]'); await page.waitForTimeout(200);
const s2=await page.textContent('#panel'); if(!/Con cosa e da dove/.test(s2)||!/Carico/.test(s2)||!/Aggiungi un flight/.test(s2)||!/Chaff \/ flare/.test(s2)) fail.push('step 2 '+s2.slice(0,200));
await page.selectOption('[data-k="dep"]','LIPS'); await page.waitForTimeout(100);
await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(800);
const s3=await page.evaluate(()=>({ area:APP.FREE().area, t:!!APP.S.t, res:APP.RES().map(z=>z.id), fl:APP.S.t&&APP.S.t.flights.map(f=>[f.cs,f.task,f.base,APP.loTxt(f.lo)]), cas:!!(APP.S.cas&&APP.S.cas.jtacs.length), thr:APP.S.t?APP.S.t.threats.length:-1, txt:document.getElementById('panel').textContent }));
if(!s3.t||!s3.area||!s3.res.length||!s3.cas) fail.push('step 3 '+JSON.stringify({...s3,txt:s3.txt.slice(0,300)}));
if(!/Holding/.test(s3.txt)||!/Bersaglio/.test(s3.txt)) fail.push('step 3 summary');
await page.click('.b.primary[data-fstep="4"]'); await page.waitForTimeout(300);
const s4=await page.textContent('#panel'); if(!/Mail di prenotazione/.test(s4)||!/it-specialops@ivao\.aero/.test(s4)||!/\(FPL-/.test(s4)||!/Kneeboard/.test(s4)) fail.push('step 4');
const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.click('#fknee')]); await d.saveAs('free_knee.pdf');
const kt=execSync('pdftotext free_knee.pdf -').toString(); if(!/9-line/i.test(kt)||!/Loadout/i.test(kt)||!/FPL-/.test(kt)||!/Nav log/i.test(kt)||!/Check-in/i.test(kt)) fail.push('kneeboard '+kt.slice(0,300));
if(/\b(della|missione|carico|partenza|Nessun)\b/.test(kt.replace(/R\d+ [^\n(]*/g,''))) fail.push('Italian text in the kneeboard');
// loadout edit kept, CAS reads it
const lo=await page.evaluate(()=>{ const f=APP.S.t.flights[0]; const lo=JSON.parse(JSON.stringify(f.lo)); lo.items=lo.items.filter(x=>!/GBU|Paveway/.test(x[1])); lo.items.unshift([2,'Mk-82']); APP.loSet(f,lo); return { w:APP.wpnOf(f), txt:APP.loTxt(f.lo) }; });
if(lo.w[0]!=='Mk-82') fail.push('CAS weapons from the loadout '+JSON.stringify(lo));
// interception, with others: target flight
await page.evaluate(()=>{ const F=APP.FREE(); F.mis='ID'; F.rr=true; F.solo=false; F.flights=[]; F.area=null; F.built=0; F.step=2; APP.renderAll(); });
await page.click('#fadd'); await page.waitForTimeout(100);
await page.evaluate(()=>{ const F=APP.FREE(); F.flights[1].task='TARGET'; F.flights[1].type='PC-12 / King Air (light utility)'; });
await page.evaluate(()=>{ const F=APP.FREE(); F.step=3; APP.renderAll(); }); await page.click('.b.primary[data-fstep="3"]').catch(()=>{}); await page.waitForTimeout(800);
const idr=await page.evaluate(()=>({ t:!!APP.S.t, tasks:APP.S.t?APP.S.t.flights.map(f=>f.task):[] }));
if(!idr.t||!idr.tasks.includes('QRA')) fail.push('interception mission '+JSON.stringify(idr));
// navigation without area: no booking needed
await page.evaluate(()=>{ const F=APP.FREE(); F.mis='NAV'; F.flights=[]; F.area=null; F.built=0; F.step=2; APP.renderAll(); });
await page.click('.b.primary[data-fstep="3"]'); await page.waitForTimeout(800); await page.click('.b.primary[data-fstep="4"]'); await page.waitForTimeout(300);
if(!/non serve prenotare/.test(await page.textContent('#panel'))) fail.push('nav without areas');
// internal event: plain mission pack, no publish
await page.evaluate(()=>{ APP.S.kind=''; APP.renderAll(); }); await page.click('[data-kind="internal"]'); await page.waitForTimeout(200);
if(await page.evaluate(()=>document.getElementById('tabs').hidden)) fail.push('tabs hidden in an internal event');
await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('CT'); APP.S.resMode='auto'; APP.setEvents(['CAS']); APP.generateGeneric(); APP.S.meta.date='12 DEC 2026'; APP.S.meta.hHour='19:00Z'; APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('2x EF-2000\n2x A-10'); APP.tailor(); APP.TAB='export'; APP.renderAll(); });
const ex=await page.textContent('#panel'); if(!/Mission pack PDF/.test(ex)||/Pubblica sulla pagina pubblica/.test(ex)||!/Mail di prenotazione/.test(ex)) fail.push('internal export');
const [d2]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>exportMasterplan(document.createElement('button')))]); await d2.saveAs('free_mp.pdf');
if(!/MISSION_PACK/.test(d2.suggestedFilename())) fail.push('mission pack file name '+d2.suggestedFilename());
const mpt=execSync('pdftotext free_mp.pdf -').toString(); if(/International Virtual Aviation Organisation|Special Operations Department/.test(mpt)) fail.push('branding in the mission pack');
if(!/Mission pack/.test(mpt)||!/Rules & Regulations/.test(mpt)||!/Loadout/.test(mpt)) fail.push('mission pack content');
// SOG official event: organiser line, no publish
await page.evaluate(()=>{ APP.S.kind='official'; APP.S.level='hq'; APP.S.org={sog:true,name:'VFS'}; APP.renderAll(); });
const sg=await page.textContent('#panel'); if(/Pubblica sulla pagina pubblica/.test(sg)||!/SOG/.test(sg)) fail.push('SOG export');
if(!/VFS – IVAO Special Operations Group/.test(await page.evaluate(()=>APP.genIntroTxt?APP.genIntroTxt():''))) fail.push('SOG organiser');
// wizard: no "Punti di navigazione" step, step "Teatro"; event name in Export; sectorfile under Avanzate
await page.evaluate(()=>{ APP.S.org=null; APP.TAB='scenario'; APP.renderAll(); }); const wz=await page.evaluate(()=>APP.wSteps().map(x=>x.t));
if(wz.some(x=>/Punti di navigazione/.test(x))||!wz.includes('Teatro')) fail.push('wizard steps '+wz);
await page.evaluate(()=>{ APP.TAB='export'; APP.renderAll(); }); if(!(await page.$('#op'))||!/Avanzate/.test(await page.textContent('#panel'))) fail.push('event name / Avanzate in Export');
console.log(JSON.stringify(s3.fl));
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
