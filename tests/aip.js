const ENV = require('./_env.js');
// AIP layer: military R areas from data/aip_zones.json are the default airspace; every element fits; without the file the app falls back to demo data
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const fail=[];const errs=[];
for (const withFile of [true,false]) { const ctx=await b.newContext({acceptDownloads:true}); const page=await ctx.newPage(); page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB});
  if(!withFile && u.includes('aip_zones.json'))return r.fulfill({status:404,body:''}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
 await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500);
 const r=await page.evaluate(()=>{const out=[]; for (const ev of [['MIX'],['CAS'],['AIB'],['SAR']]) for (const th of ['NE','NO','CT','SA','SI','PU']) { APP.S.meta.theatre=th; APP.setEvents(ev); APP.generateGeneric();
   APP.parseLines('4x F-35A\n2x Eurofighter\n1x KC-767\n1x E-3\n2x HH-101\n2x CL-415\n2x AMX\n1x AW139'); APP.tailor(); out.push({k:ev+' '+th, src:APP.S.asp.source, n:APP.RES().length, iss:(APP.containmentIssues()||[]).length}); } return out;});
 for (const x of r) { if (x.src!==(withFile?'aip':'demo')) fail.push(`${x.k} source ${x.src}`); const civ=/AIB|SAR/.test(x.k); if (civ&&withFile ? x.n : !x.n) fail.push(`${x.k} reserved ${x.n}`); if (x.iss) fail.push(`${x.k} ${x.iss} containment issues`); }
 if (withFile) { await page.evaluate(()=>{ APP.S.meta.theatre='CT'; APP.setEvents(['MIX']); APP.generateGeneric(); APP.parseLines('4x F-35A\n2x Eurofighter\n1x KC-767\n1x E-3'); APP.tailor(); APP.renderAll(); });
  await page.click('[data-tab="export"]'); await page.waitForTimeout(200);
  const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click('#mpdf')]); await d.saveAs('aip_mp.pdf'); }
 await ctx.close(); }
if(require('fs').existsSync('aip_mp.pdf')){const t=require('child_process').execSync('pdftotext aip_mp.pdf -').toString(); if(!/ENR 5\.1\.2/.test(t)) fail.push('AIP source not in masterplan'); if(/TBC\s*\n\s*TBC/.test(t)) fail.push('TBC limits in masterplan');}
console.log(fail.length?'"err": '+fail.slice(0,10).join('; '):'checks ok');
console.log(errs.join('\n')||'no errors'); await b.close();})();
