const ENV = require('./_env.js');
// event without ATC (15 pilots, no controllers): tailoring and every document complete without errors
const { chromium } = require(ENV.PW); const fs=require('fs'); const path=require('path');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); let dl=0; page.on('download',()=>dl++); const fail=[];
const j=fs.readFileSync(path.join(__dirname,'fixtures','roster_15_noatc.json'),'utf8');
for (const ev of [['ID'],['CAS'],['CSAR'],['AIB'],['MIX']]) { const d0=dl;
  const r=await page.evaluate(async([j,ev])=>{ const R=JSON.parse(j), bad=[]; const ot=window.toast; window.toast=m=>{ if(/errore|error/i.test(m)) bad.push(m); };
    APP.S.custom=[]; APP.setTheatre('CT'); APP.S.resMode='auto'; APP.setEvents(ev); APP.generateGeneric(); APP.S.roster={pilots:R.pilots.map(p=>({id:Math.random()+'',...p})),controllers:[]}; APP.tailor(); APP.renderAll();
    const B=()=>document.createElement('button'), calls=[()=>exportMasterplan(B()), ()=>exportDeck('generic',B()), ()=>exportDeck('brief',B())];
    if(APP.S.t.gci) calls.push(()=>exportGciPack(B())); if(APP.S.cas&&ev.includes('CAS')) calls.push(()=>exportJtacPack('ALL',B())); if(ev.includes('CSAR')) calls.push(()=>exportPrPack('ALL',B()));
    for (const c of calls) { try { await c(); } catch(e) { bad.push(e.message); } await new Promise(r=>setTimeout(r,300)); }
    window.toast=ot; return { n:calls.length, bad, staffed:APP.S.t.c2.filter(c=>c.controller && !/not staffed|aircrew/.test(c.controller)).length, flights:APP.S.t.flights.length }; },[j,ev]);
  await page.waitForTimeout(2500);
  if(r.bad.length) fail.push(ev+': '+r.bad.join('; ')); if(dl-d0!==r.n) fail.push(`${ev}: ${dl-d0}/${r.n} documents`); if(r.staffed) fail.push(ev+': invented controllers'); if(!r.flights) fail.push(ev+': no flights'); }
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
