const ENV = require('./_env.js');
// CAS: scenarios prepared before sign-ups, JTAC pack, assignment at tailoring, nothing secret in pilot outputs
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});
const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1300,height:900}});const page=await ctx.newPage();const errs=[];
page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url();
 if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK});
 if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX});
 if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB});
 if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(800);
let fail=[];
// 1) before sign-ups
const pre=await page.evaluate(()=>{ APP.S=JSON.parse(JSON.stringify(APP.S)); APP.S.roster={pilots:[],controllers:[]}; APP.S.t=null; APP.S.casCfg={nJtac:2,perJ:3,rw:25,fmt:'DD',magvar:3.5};
  APP.setEvents(['CAS']); APP.generateGeneric(); APP.renderAll(); return { j:APP.S.cas&&APP.S.cas.jtacs.length, n:APP.S.cas&&APP.S.cas.jtacs.reduce((a,J)=>a+J.tasks.length,0) }; });
if(pre.j!==2||pre.n!==6) fail.push('prepared scenarios '+JSON.stringify(pre));
if(await page.isHidden('#tabcas')) fail.push('CAS tab hidden');
await page.click('#tabcas'); await page.waitForTimeout(200);
if(await page.$('[data-jpack="ALL"]')) fail.push('JTAC pack button before the scenario is complete');
const [d0]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>APP.exportJtacPack('ALL'))]); await d0.saveAs('cas_jtac_pre.pdf');
const jp=execSync('pdftotext cas_jtac_pre.pdf -').toString();
if(!/FINAL ATTACK HEADING/.test(jp)||!/\[CALLSIGN\]/.test(jp)) fail.push('pre-signup JTAC pack incomplete');
// 2) after sign-ups
const info=await page.evaluate(()=>{ APP.parseLines('4x Tornado IDS\n2x F-16\n2x AH-64 Apache\n1x JTAC Mario Rossi\n1x JTAC Luigi Bianchi'); APP.tailor(); APP.renderAll();
  const t=APP.S.t; return { asg:APP.S.cas.jtacs.flatMap(J=>J.tasks.filter(T=>T.flight)).length, cas:t.flights.filter(f=>f.task==='CAS').length, cp:t.airspace.filter(a=>a.type==='CP').length,
    pub:JSON.stringify(APP.buildPayload(true).scenario) }; });
console.log(JSON.stringify({pre, asg:info.asg, cas:info.cas, cp:info.cp}));
if(info.asg!==info.cas||!info.cas) fail.push('flights not assigned');
if(/BTR|T-72|ZU-23|tents|technicals|farmhouse|BMP|supply trucks|Radio relay|Mortar position|"salute"/.test(info.pub)) fail.push('target leaked to public payload');
await page.click('#tabcas'); await page.waitForTimeout(200);
await page.selectOption('[data-casg="fmt"]','MGRS'); await page.waitForTimeout(200);
const [d1]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click('[data-jpack="ALL"]')]); await d1.saveAs('cas_jtac.pdf');
await page.click('[data-tab="export"]'); await page.waitForTimeout(200);
const [d2]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click('#mpdf')]); await d2.saveAs('cas_mp.pdf');
const [d3]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click('#pptbrief')]); await d3.saveAs('cas_br.pptx');
const jt=execSync('pdftotext cas_jtac.pdf -').toString(), mp=execSync('pdftotext cas_mp.pdf -').toString();
if(!/FINAL ATTACK HEADING/.test(jt)||!/Situation update/.test(jt)||!/Expected check-in/.test(jt)) fail.push('JTAC pack incomplete');
if(!/\d{2}[A-Z] [A-Z]{2} \d{4} \d{4}/.test(jt)) fail.push('MGRS not found');
if(/FINAL ATTACK HEADING|EGRESS, |TYPE [123], BOMB|SHOW OF FORCE,/.test(mp)) fail.push('9-line leaked to masterplan');
if(!/Close air support/.test(mp)) fail.push('CAS section missing in masterplan');
if(/Mario|Rossi|Luigi|Bianchi/.test(mp)) fail.push('names in masterplan');
if(/ricerca|bersaglio|quota|minaccia|settore/i.test(jt)) fail.push('Italian text in JTAC pack');
console.log(fail.length?'"err": '+fail.join('; '):'checks ok');
console.log(errs.join('\n')||'no errors'); await b.close();})();
