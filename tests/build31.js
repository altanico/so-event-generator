const ENV = require('./_env.js');
// v1.20: assignment after sign-ups – event timeline, CAS passes, manual changes, unassigned scenarios out of the documents; ENAV charts only for civil / joint aerodromes
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:800}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
let r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.S.casCfg={nJtac:2,perJ:4,rw:0}; APP.setEvents(['CAS']); APP.generateGeneric();
  APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('2x AMX\n2x F-35A\n2x M-346\n2x EF-2000'); APP.tailor(); o.tasks=APP.S.t.flights.map(f=>f.type+':'+f.task).join(); const t=APP.S.t, cas=t.flights.filter(f=>f.task==='CAS');
  o.n=cas.length; o.one=cas.every(f=>(f.casTasks||[]).length===1); const ids=cas.flatMap(f=>f.casTasks); o.uniq=new Set(ids).size===ids.length;
  const w=APP.tl(); o.win=[w.on0,w.on1]; o.tots=cas.map(f=>APP.casTaskById(f.casTasks[0])[1].tot); o.docTasks=APP.casDocJtacs().reduce((a,J)=>a+J.tasks.length,0); o.lib=APP.S.cas.jtacs.reduce((a,J)=>a+J.tasks.length,0); return o; });
if(r.n<2) fail.push('need 2 CAS flights '+r.tasks); if(!r.n||!r.one||!r.uniq) fail.push('automatic proposal '+JSON.stringify(r)); if(r.win.join()!=='35,115') fail.push('window '+r.win); if(r.tots.some(x=>x<r.win[0]||x>r.win[1])) fail.push('TOT outside the window '+r.tots);
if(r.docTasks!==r.n||r.lib<=r.n) fail.push(`documents ${r.docTasks} / library ${r.lib}`);
// UI: passes and manual choice
await page.click('[data-tab="tailor"]'); await page.waitForTimeout(300);
const fid=await page.evaluate(()=>APP.S.t.flights.find(f=>f.task==='CAS').id);
await page.fill(`[data-asgp="${fid}"]`,'2'); await page.dispatchEvent(`[data-asgp="${fid}"]`,'change'); await page.waitForTimeout(300);
r=await page.evaluate(fid=>{ const f=APP.S.t.flights.find(x=>x.id===fid), a=APP.casTaskById(f.casTasks[0]), b=APP.casTaskById(f.casTasks[1]); return { n:f.casTasks.length, sameJ:a&&b&&a[0].id===b[0].id, gap:b[1].tot-a[1].tot }; },fid);
if(r.n!==2||!r.sameJ||r.gap<10) fail.push('second pass '+JSON.stringify(r));
await page.selectOption(`[data-asgt="${fid}:1"]`,'RE'); await page.waitForTimeout(300);
r=await page.evaluate(fid=>{ const f=APP.S.t.flights.find(x=>x.id===fid), a=APP.casTaskById(f.casTasks[0])[1], b=APP.casTaskById(f.casTasks[1])[1]; return { re:b.reOf, same:a.target===b.target, ip:a.ip===b.ip }; },fid);
if(r.re==null||!r.same) fail.push('re-attack '+JSON.stringify(r));
// swap: give flight A the scenario of flight B -> B gets A's old one
r=await page.evaluate(fid=>{ const fs=APP.S.t.flights.filter(f=>f.task==='CAS'&&!/HH|AW|NH/.test(f.type)), A=fs[0], B=fs.find(f=>f!==A); const a0=A.casTasks[0], b0=B.casTasks[0]; return {A:A.id,B:B.id,a0,b0}; },fid);
await page.selectOption(`[data-asgt="${r.A}:0"]`,r.b0); await page.waitForTimeout(300);
const sw=await page.evaluate(r=>{ const A=APP.S.t.flights.find(f=>f.id===r.A), B=APP.S.t.flights.find(f=>f.id===r.B); return [A.casTasks[0]===r.b0, B.casTasks[0]===r.a0]; },r); if(!sw[0]||!sw[1]) fail.push('swap '+sw);
// time window too short -> warning
await page.evaluate(()=>{ APP.S.meta.tl={dur:60,dep:15,tr:20,ret:10,land:10}; APP.S.t.flights.filter(f=>f.task==='CAS').forEach(f=>f.passes=3); APP.S.cas.jtacs.forEach(J=>J.tasks.forEach(T=>T.totMan=false)); APP.renderAll(); });
await page.evaluate(()=>{ asgApply(); }); const warn=await page.evaluate(()=>APP.S.cas.jtacs.map(J=>J.timeWarn).filter(Boolean).length); if(!warn) fail.push('no warning with a short window');
// JTAC pack: only assigned scenarios; masterplan: no ENAV line for military bases
await page.evaluate(()=>{ APP.S.meta.tl=null; asgApply(); });
const [d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>APP.exportJtacPack('ALL',document.createElement('button')))]); await d.saveAs('b31_jtac.pdf');
const jt=execSync('pdftotext b31_jtac.pdf -').toString(); const spare=await page.evaluate(()=>APP.S.cas.jtacs.flatMap(J=>J.tasks.filter(T=>!APP.casDocJ(J).tasks.includes(T)).map(T=>T.id)));
if(spare.some(id=>new RegExp('\\b'+id+'\\b').test(jt))) fail.push('spare scenario in the JTAC pack '+spare.filter(id=>new RegExp('\\b'+id+'\\b').test(jt)));
const [d2]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>{ APP.S.blueBases=['LIBD','LIBV']; APP.S.t.flights.forEach(f=>f.base='LIBV'); return exportMasterplan(document.createElement('button')); })]); await d2.saveAs('b31_mp.pdf');
const mp=execSync('pdftotext b31_mp.pdf -').toString(); if(/AD 2 LIBV/.test(mp)) fail.push('ENAV AIP line for a military aerodrome'); if(!/AD 2 LIBD/.test(mp)) fail.push('ENAV AIP line missing for a civil aerodrome');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
