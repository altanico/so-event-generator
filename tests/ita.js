const ENV = require('./_env.js');
const { chromium } = require(ENV.PW); const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});
const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1300,height:900}});const page=await ctx.newPage();const errs=[];
page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url();
 if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK});
 if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX});
 if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB});
 if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(800);
const sets={AIB:['AIB','2x CL-415\n3x AW139'],CIV:[['SAR','HEMS','MEDEVAC','HOSPITAL','HUMAN'],'3x AW139\n2x H145\n2x C-130J\n1x PC-12'],TRN:[['AAR','ID','NAVI','NAVL'],'4x F-35A\n2x KC-767A\n2x E-3A\n2x AW139'],CMB:[['CAS','SEAD','CSAR','AIRMOB','MAR'],'4x AMX\n4x F-35A\n2x HH-101\n2x C-130J\n1x P-72A']};
for (const [k,[ev,ros]] of Object.entries(sets)) {
  await page.evaluate(({ev,ros})=>{APP.S=JSON.parse(JSON.stringify(APP.S)); APP.S.roster={pilots:[],controllers:[]}; APP.S.t=null; APP.setEvents([].concat(ev)); APP.generateGeneric(); APP.parseLines(ros); APP.tailor(); APP.renderAll();},{ev,ros});
  await page.click('[data-tab="export"]');
  for (const [id,f] of [['#mpdf','pdf'],['#pptbrief','b.pptx'],['#pptgen','g.pptx']]) { const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click(id)]); await d.saveAs(`ita_${k}.${f}`); }
  const html=await page.evaluate(()=>{APP.MODE; const sc=APP.buildPayload(true).scenario; return sc.background+' '+JSON.stringify(sc.t)});
  fs.writeFileSync(`ita_${k}.txt`, html);
}
console.log(errs.join('\n')||'no errors'); await b.close();})();
