const ENV = require('./_env.js');
// Reserved-area selection: ask before generating, "proponile tu" vs "le scelgo io", deselect all, union of the ticked areas, no demo data
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext();const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
const html=await page.content(); if(/Dati DEMO|id="aspdemo"/.test(html)) fail.push('demo button still present');
// fresh scenario, no mode chosen: the generate area asks
await page.evaluate(()=>{ APP.S.custom=[]; APP.S.resMode=undefined; APP.S.zones=[]; APP.S.gen=null; APP.S.meta.theatre='NE'; APP.setEvents(['MIX']); APP.renderAll(); });
await page.click('[data-tab="scenario"]').catch(()=>{}); await page.waitForTimeout(200);
if(!(await page.$('#genauto'))||!(await page.$('#genman'))) fail.push('no question before generating');
// deselect all
await page.evaluate(()=>{ APP.S.reserved=APP.RES().length?APP.S.reserved:['LI-R49A','LI-R49B']; APP.renderAll(); });
if(await page.$('#resnone')){ await page.click('#resnone'); await page.waitForTimeout(100); } else fail.push('no deselect-all button');
let r=await page.evaluate(()=>({n:APP.RES().length,m:APP.S.resMode})); if(r.n||r.m!=='manual') fail.push('deselect all: '+JSON.stringify(r));
// manual: pick two areas and generate; the generator must keep them and stay inside
r=await page.evaluate(()=>{ const pick=['LI-R49A','LI-R49B']; APP.S.reserved=pick.slice(); APP.S.resMode='manual'; APP.generateGeneric(); APP.parseLines('4x F-35A\n2x AMX\n1x E-3\n1x KC-767'); APP.tailor();
  return {res:(APP.S.reserved||[]).slice().sort().join(','), iss:(APP.containmentIssues()||[]).length, ast:APP.S.t.airspace.length}; });
if(r.res!=='LI-R49A,LI-R49B') fail.push('manual selection changed: '+r.res); if(r.iss) fail.push('manual: '+r.iss+' containment issues');
// union of the ticked areas
await page.evaluate(()=>APP.renderAll()); if(!(await page.$('#cuscombo'))) fail.push('no union button under the table'); else {
 await page.fill('#cuslo','FL100'); await page.fill('#cusup','FL240'); await page.click('#cuscombo'); await page.waitForTimeout(150);
 r=await page.evaluate(()=>{const c=(APP.S.custom||[]).slice(-1)[0]; return c?{lo:c.lower,up:c.upper,res:APP.RES().some(z=>z.id===c.id)}:null;});
 if(!r||r.lo!=='FL100'||r.up!=='FL240'||!r.res) fail.push('union: '+JSON.stringify(r)); }
// auto mode proposes again
r=await page.evaluate(()=>{ APP.S.custom=[]; APP.S.reserved=[]; APP.S.resMode='auto'; APP.generateGeneric(); APP.parseLines('4x F-35A\n2x AMX'); APP.tailor(); return APP.RES().length; });
if(!r) fail.push('auto mode reserved nothing');
console.log(fail.length?'"err": '+fail.join('; '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
