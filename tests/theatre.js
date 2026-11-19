const ENV = require('./_env.js');
// Hand-drawn theatre (derived FIR / bases / forces, proposals only touching it) and the complete reset
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
const pip=`(p,poly)=>{let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[yi,xi]=poly[i],[yj,xj]=poly[j];if(((yi>p[0])!==(yj>p[0]))&&(p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi))ins=!ins;}return ins;}`;
// draw from the theatre step: choose "draw" in the list, add vertices (Marche / Adriatico), close
await page.click('[data-tab="scenario"]'); await page.evaluate(()=>{ APP.S.meta.events=[]; APP.setEvents(['MIX']); APP.S.gen=null; APP.S.zones=[]; APP.WOPEN='th'; APP.renderAll(); });
await page.selectOption('#theatre','CUSTOM'); await page.waitForTimeout(100);
let r=await page.evaluate(()=>APP.ADDMODE); if(r!=='th:draw') fail.push('draw mode not started: '+r);
await page.evaluate(()=>{ APP.S.thDraft=[[43.95,12.35],[43.95,13.6],[43.15,13.95],[42.95,12.9]]; APP.renderAll(); });
await page.click('#thclose'); await page.waitForTimeout(150);
r=await page.evaluate(()=>{const t=APP.theatre(); return {id:t.id, fir:t.fir, blue:t.blue, red:t.red, draw:APP.ADDMODE, bases:APP.S.blueBases};});
if(r.id!=='CUSTOM'||!r.fir||!r.blue.length||r.draw) fail.push('custom theatre '+JSON.stringify(r));
await page.fill('#thname','MARCHE'); await page.dispatchEvent('#thname','change'); await page.waitForTimeout(80);
if(await page.evaluate(()=>APP.theatre().name)!=='MARCHE') fail.push('theatre name');
for (const ev of [['MIX'],['AAR'],['CAS']]) { r=await page.evaluate(([ev,pipS])=>{ const pip=eval(pipS); APP.S.custom=[]; APP.S.resMode='auto'; APP.setEvents(ev); APP.generateGeneric(); APP.parseLines('4x F-35A\n2x AMX\n1x KC-767\n1x E-3'); APP.tailor();
  const poly=APP.theatre().poly, touch=z=>z.poly.some(p=>pip(p,poly))||poly.some(p=>pip(p,z.poly));
  return {th:APP.theatre().id, n:APP.RES().length, out:APP.RES().filter(z=>!touch(z)&&!(APP.S.t.airspace||[]).some(a=>a.name&&a.name.includes(z.name))).map(z=>z.id), thr:APP.S.t.threats.filter(t=>!pip(t.pos,poly)).length, all:APP.S.t.threats.length, iss:(APP.containmentIssues()||[]).length}; },[ev,pip]);
  if(r.th!=='CUSTOM') fail.push(ev+' theatre lost'); if(!r.n) fail.push(ev+' no reserved area'); if(r.iss) fail.push(ev+' '+r.iss+' containment issues');
  if(r.thr>r.all/2) fail.push(`${ev}: ${r.thr}/${r.all} threats outside the drawn theatre`); }
// proposals before tailoring only touch the theatre
r=await page.evaluate(([pipS])=>{ const pip=eval(pipS), poly=APP.theatre().poly; APP.S.custom=[]; APP.S.reserved=[]; APP.S.resMode='auto'; APP.setEvents(['AAR']); APP.generateGeneric(); return APP.RES().filter(z=>!(z.poly.some(p=>pip(p,poly))||poly.some(p=>pip(p,z.poly)))).map(z=>z.id); },[pip]);
if(r.length) fail.push('proposed areas outside the theatre: '+r);
// complete reset: everything back to an empty event
await page.evaluate(()=>{ APP.ZF.q='R49'; APP.S.border=[[43,12],[43.5,13]]; APP.POINTS().items.push(['AAA','FIX',43,12,'']); });
await page.click('#fullreset'); await page.waitForTimeout(80); if(!(await page.evaluate(()=>APP.S.meta.events.length))) fail.push('reset without confirmation');
await page.click('#fullreset'); await page.waitForTimeout(150);
r=await page.evaluate(()=>({ev:APP.S.meta.events.length, gen:!!APP.S.gen, border:APP.S.border||null, th:APP.S.thCustom||null, q:APP.ZF.q, pts:APP.POINTS().items.length, open:APP.wOpen(), asp:APP.S.asp&&APP.S.asp.source, thr:APP.S.meta.theatre, bases:APP.S.blueBases.length, res:APP.RES().length, cur:localStorage.getItem('ivao-so-current')?JSON.parse(localStorage.getItem('ivao-so-current')).meta.events.length:-1}));
if(r.ev||r.gen||r.border||r.th||r.q||r.pts||r.open!=='ev'||r.cur||r.thr||r.bases||r.res) fail.push('reset left '+JSON.stringify(r)); if(r.asp!=='aip') fail.push('reset: AIP zones not loaded ('+r.asp+')');

// drawing / choosing a theatre never selects areas by itself; "Proponile tu" does
r=await page.evaluate(()=>{ APP.fullReset(); APP.fullReset(); APP.setEvents(['AAR']); APP.S.thCustom=APP.mkTheatre([[43.95,12.35],[43.95,13.6],[43.15,13.95],[42.95,12.9]],''); APP.setTheatre('CUSTOM'); const a=APP.RES().length, c=(APP.S.cor||[]).length;
  APP.setTheatre('CT'); const b=APP.RES().length; APP.WOPEN='asp'; APP.renderAll(); document.querySelector('#resauto').click(); return {a,c,b,auto:APP.RES().length}; });
if(r.a||r.c||r.b) fail.push('areas selected without asking '+JSON.stringify(r)); if(!r.auto) fail.push('"Proponile tu" proposed nothing');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
