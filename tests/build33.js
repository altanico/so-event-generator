const ENV = require('./_env.js');
// v1.33 (replaces the v1.21 base test): "Basi degli assetti" – chips, search, quick-add, several bases; civil airfields only for civil purposes; RED airfields from the border
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('NE'); APP.S.resMode='auto'; APP.setEvents(['MIX']); APP.WOPEN='th'; APP.renderAll(); });
await page.click('[data-tab="scenario"]'); await page.waitForTimeout(300); await page.evaluate(()=>{ APP.WOPEN='th'; APP.renderAll(); }); await page.waitForTimeout(200);
if(!(await page.$('#bq'))) fail.push('no base card in the theatre step');
// search + add, quick-add, remove
await page.fill('#bq','aviano'); await page.waitForTimeout(400); await page.click('[data-badd="LIPA"]').catch(()=>fail.push('search did not find Aviano')); await page.waitForTimeout(150);
await page.fill('#bq','LIPZ'); await page.waitForTimeout(400); await page.click('[data-badd="LIPZ"]').catch(()=>fail.push('search did not find LIPZ')); await page.waitForTimeout(150);
const q=await page.$$eval('[data-badd]',x=>x.map(e=>e.dataset.badd)); if(!q.length) fail.push('no quick-add buttons');
const st=await page.evaluate(()=>APP.S.blueBases.join()); if(!/LIPA/.test(st)||!/LIPZ/.test(st)) fail.push('bases '+st);
const r=await page.evaluate(()=>{ APP.generateGeneric(); APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('1x KC-767A\n2x EF-2000\n2x Tornado IDS\n2x HH-139A\n2x F-35A'); APP.tailor(); const t=APP.S.t;
  return { fl:t.flights.map(f=>[f.cs,f.task,f.base]), bases:APP.S.blueBases, red:APP.RB() }; });
if(r.fl.some(f=>f[2]==='LIPZ'&&!['STANDBY','SAR','AIB','HEMS','MEDEVAC','HUMAN','IFRNAV','HOSPITAL'].includes(f[1]))) fail.push('military flight on a civil airfield '+JSON.stringify(r.fl.filter(f=>f[2]==='LIPZ')));
if(!r.fl.every(f=>r.bases.includes(f[2]))) fail.push('flight outside the chosen bases '+JSON.stringify(r.fl));
if(!r.red.length||r.red.some(k=>r.bases.includes(k))) fail.push('RED airfields '+JSON.stringify(r.red));
// remove a base
await page.evaluate(()=>{ APP.WOPEN='th'; APP.TAB='scenario'; APP.renderAll(); }); await page.waitForTimeout(150);
await page.click('[data-bdel="LIPZ"]').catch(()=>fail.push('no remove button')); await page.waitForTimeout(150);
if(await page.evaluate(()=>APP.S.blueBases.includes('LIPZ'))) fail.push('base not removed');
// masterplan: which flights use a base; no base-side warnings
const iss=await page.evaluate(()=>APP.borderIssues().filter(x=>/^Base/.test(x)).length); if(iss) fail.push('base-side warnings still there');
const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>exportMasterplan(document.createElement('button')))]); await d.saveAs('b33_mp.pdf');
const mp=execSync('pdftotext b33_mp.pdf -').toString().replace(/\s+/g,' '); if(!/Used by: /.test(mp)) fail.push('masterplan: flights of a base');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
