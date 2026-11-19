const ENV = require('./_env.js');
// Phase 1 wizard: new event starts empty (no default event), steps appear one at a time, civil events hide reserved areas and threats, regenerate / new event
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
const heads=()=>page.evaluate(()=>[...document.querySelectorAll('[data-wstep]')].map(h=>h.dataset.wstep));
// demo event is generated: the "generated" step is open, with clear restart buttons
await page.click('[data-tab="scenario"]'); await page.waitForTimeout(100);
if(!(await page.$('#gen'))||!(await page.$('#newscn'))) fail.push('generated step: buttons missing');
// new empty event (press twice: the demo is unsaved)
await page.click('#newscn'); await page.waitForTimeout(100); if(await page.$('#newscn')) { await page.click('#newscn'); await page.waitForTimeout(150); }
let r=await page.evaluate(()=>({ev:APP.S.meta.events.length, gen:!!APP.S.gen, checked:document.querySelectorAll('[data-evt]:checked').length}));
if(r.ev||r.gen||r.checked) fail.push('new event not empty '+JSON.stringify(r));
let h=await heads(); if(h.join()!=='ev') fail.push('empty event shows steps: '+h);
// every tab renders with no event chosen
for (const tab of ['roster','tailor','export','scenario']) { await page.click(`[data-tab="${tab}"]`); await page.waitForTimeout(80); }
// choose a military event: step 2 appears; Avanti walks through every step
await page.check('[data-evt="CAS"]'); await page.waitForTimeout(100); h=await heads(); if(h.join()!=='ev,req') fail.push('after choosing: '+h);
const all=await page.evaluate(()=>APP.wSteps().map(x=>x.id)); if(all.join()!=='ev,req,th,asp,thr,c2,gen') fail.push('CAS steps '+all);
for (let i=0;i<10;i++) { const nx=await page.$('[data-wnext]'); if(!nx) break; await nx.click(); await page.waitForTimeout(60); }
if(!(await page.$('#genauto'))) fail.push('last step does not ask about the reserved areas');
// a done step reopens on click
await page.click('[data-wstep="thr"]'); await page.waitForTimeout(60); if(!(await page.$('#fblue'))) fail.push('threat step does not reopen');
await page.click('[data-wstep="gen"]'); await page.click('#genauto'); await page.waitForTimeout(200);
r=await page.evaluate(()=>({gen:!!APP.S.gen, zones:APP.S.zones.length, open:APP.wOpen()})); if(!r.gen||!r.zones||r.open!=='gen') fail.push('generate '+JSON.stringify(r));
// civil event: no reserved-area step body, no threats, no area question
await page.click('#newscn'); await page.waitForTimeout(80); if(await page.evaluate(()=>APP.S.meta.events.length)) { await page.click('#newscn'); await page.waitForTimeout(120); }
await page.check('[data-evt="AIB"]'); await page.waitForTimeout(80);
r=await page.evaluate(()=>APP.wSteps().map(x=>x.id+(x.off?'(off)':''))); if(r.join()!=='ev,req,th,asp(off),c2,gen') fail.push('AIB steps '+r);
for (let i=0;i<10;i++) { const nx=await page.$('[data-wnext]'); if(!nx) break; const id=await nx.getAttribute('data-wnext'); if(id==='asp') fail.push('Avanti opens the hidden airspace step'); await nx.click(); await page.waitForTimeout(60); }
if(await page.$('#genauto')) fail.push('civil event asks about reserved areas'); if(!(await page.$('#gen'))) fail.push('civil: no generate button');
// hidden step can still be shown on request
await page.click('[data-wstep="asp"]'); await page.waitForTimeout(60); if(!(await page.$('#zfq'))) fail.push('show airspace on request');
await page.click('#aspoff'); await page.waitForTimeout(60); if(await page.$('#zfq')) fail.push('hide airspace again');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
