const ENV = require('./_env.js');
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});
const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1300,height:900}});const page=await ctx.newPage();const errs=[];
page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url();
 if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK});
 if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX});
 if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB});
 if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(800);
const info=await page.evaluate(()=>{
  APP.S=JSON.parse(JSON.stringify(APP.S)); const S=APP.S; S.roster={pilots:[],controllers:[{name:'Mario Rossi',pref:'APP'}]};
  APP.setEvents(['NAVI','NAVL']); APP.generateGeneric();
  const g=APP.geom().front; let sct='[INFO]\nx\n[VOR]\nOLB 114.800 N040.54.00.000 E009.30.00.000\n[FIXES]\n';
  for(let i=0;i<40;i++){const la=g[0]+(Math.random()-.5)*.8, lo=g[1]+(Math.random()-.5)*1.0; const d=(v,h)=>{const a=Math.abs(v),D=Math.floor(a),M=Math.floor((a-D)*60),Sx=((a-D)*60-M)*60;return h+String(D).padStart(3,'0').slice(-3)+'.'+String(M).padStart(2,'0')+'.'+Sx.toFixed(3).padStart(6,'0')}; sct+=`FIX${i} ${d(la,'N')} ${d(lo,'E')}\n`}
  const it=APP.parseSector(sct); APP.setPoints(it,'test.sct');
  APP.parseLines('3x C-130J\n2x Eurofighter\n3x AW139'); APP.tailor(); const t=APP.S.t;
  return {n:it.length, sample:it.slice(0,2), routes:t.airspace.filter(a=>a.type==='ROUTE').map(a=>a.names.join('>')), warn:t.warnings, issues:APP.containmentIssues()}});
console.log(JSON.stringify(info));
await page.click('[data-tab="export"]');
const [d1]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click('#mpdf')]); await d1.saveAs('ev_mp.pdf');
const [d2]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click('#pptbrief')]); await d2.saveAs('ev_br.pptx');
const [d3]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click('#pptgen')]); await d3.saveAs('ev_gen.pptx');
console.log(errs.join('\n')||'no errors'); await b.close();})();
