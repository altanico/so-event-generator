const ENV = require('./_env.js');
// BLUE / RED boundary: automatic by default, editable polyline (add / move / remove points), reset; ground elements generated on their own side
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
// automatic boundary: no ground element on the wrong side, every theatre and military event
let r=await page.evaluate(()=>{const o=[]; for (const ev of ['MIX','CAS','CSAR','STRIKE']) for (const th of ['NE','NO','CT','SA','SI','PU']) { APP.S.border=null; APP.S.custom=[]; APP.S.resMode='auto'; APP.S.meta.theatre=th; APP.setEvents([ev]); APP.generateGeneric(); APP.parseLines('4x F-35A\n2x AMX\n1x E-3\n2x HH-101'); APP.tailor(); const i=APP.borderIssues(); if(i.length) o.push(ev+' '+th+': '+i.slice(0,3).join('; ')); } return o;});
fail.push(...r);
// edit: the button creates an editable line, then add a bent point and regenerate
await page.evaluate(()=>{ APP.S.border=null; APP.S.meta.theatre='NE'; APP.setEvents(['MIX']); APP.generateGeneric(); APP.WOPEN='thr'; APP.renderAll(); });
await page.click('[data-tab="scenario"]'); await page.waitForTimeout(100); await page.click('#bedit'); await page.waitForTimeout(100);
r=await page.evaluate(()=>({own:APP.borderGeom().own, n:(APP.S.border||[]).length, edit:APP.BEDIT})); if(!r.own||r.n!==3||!r.edit) fail.push('edit mode '+JSON.stringify(r));
r=await page.evaluate(()=>{ const B=APP.S.border, g=APP.geom(), blueRef=APP.geom().front; const toward=(p,d)=>{const R=Math.PI/180, b=(g.dir)*R, lat=p[0]+d/111*Math.cos(b), lon=p[1]+d/(111*Math.cos(p[0]*R))*Math.sin(b); return [+lat.toFixed(5),+lon.toFixed(5)];}; B[1]=toward(B[1],25); g.blueC=toward(g.front,80);
  APP.generateGeneric(); APP.parseLines('4x F-35A\n2x AMX\n1x E-3'); APP.tailor(); const bd=APP.borderGeom();
  return {iss:APP.borderIssues(), keep:(APP.S.border||[]).length, flot:(APP.S.t.airspace.find(a=>a.type==='FLOT')||{}).pts, line:bd.line, blueC:APP.borderSide(g.blueC), redC:APP.borderSide(g.redC), cont:(APP.containmentIssues()||[]).length}; });
if(r.keep!==3) fail.push('edited boundary lost on generation'); if(JSON.stringify(r.flot)!==JSON.stringify(r.line)) fail.push('FLOT airspace does not follow the edited line');
if(r.blueC!=='BLUE'||r.redC!=='RED') fail.push(`sides ${r.blueC}/${r.redC}`); if(r.iss.length>2) fail.push('edited boundary issues: '+r.iss.slice(0,4).join('; ')); if(r.cont) fail.push(r.cont+' containment issues');
// panel: reset brings back the automatic line; theatre change resets too
await page.evaluate(()=>APP.renderAll()); await page.click('[data-tab="tailor"]'); await page.waitForTimeout(100); if(!(await page.$('#breset'))) fail.push('no reset button'); else { await page.click('#breset'); await page.waitForTimeout(100); if(await page.evaluate(()=>APP.borderGeom().own)) fail.push('reset'); }
// public payload carries the edited line
r=await page.evaluate(()=>{ APP.S.border=[[45.5,12.0],[45.7,12.6],[45.6,13.2]]; const p=APP.buildPayload(false); return JSON.stringify((p.scenario||p.sc||p).border||null); });
if(!/45\.7/.test(r)) fail.push('public payload without the edited line: '+r.slice(0,80));
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
