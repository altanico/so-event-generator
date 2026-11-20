const ENV = require('./_env.js');
// v1.18.5: wheel IP inside the orbit, egress choice (back to overhead), JTAC pack only when the scenario is complete
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
const r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.S.casCfg={nJtac:1,perJ:3,rw:0}; APP.setEvents(['CAS']); APP.generateGeneric(); APP.S.t=null;
  APP.S.zones=APP.S.zones.filter(z=>!/SHORAD|IADS/.test(z.cat)); const J=APP.S.cas.jtacs[0], fw=J.tasks.filter(T=>!T.rw);
  J.hold='RACETRACK'; J.ref='CP'; APP.casDeconf(J); const orig=fw.map(T=>JSON.stringify(APP.S.cas.jtacs[0].ips.find(x=>x.name===T.ip).pos));
  J.hold='WHEEL'; APP.casDeconf(J); o.inside=fw.every(T=>{ const ip=J.ips.find(x=>x.name===T.ip); return dist(J.echo,ip.pos)<=(5-1)*1.852+0.01; });
  o.eg=APP.egress(J,fw[0]); o.optOvh=APP.egrOpts(J,fw[0]).some(x=>x[0]==='OVH');
  J.ref='KEYHOLE'; APP.casDeconf(J); o.insideKh=fw.every(T=>{ const ip=J.ips.find(x=>x.name===T.ip), k=APP.khGroups(J).find(g=>g.tg.includes(T.target)); return dist(k.E,ip.pos)<=4*1.852+0.01; });
  J.ref='CP'; const m=J.ips.find(x=>x.name===fw[1].ip); APP.casMovePt(m,[m.pos[0]+0.3,m.pos[1]],'IP '+m.name); const mp=JSON.stringify(m.pos);
  J.hold='RACETRACK'; APP.casDeconf(J); o.restored=fw.map(T=>JSON.stringify(J.ips.find(x=>x.name===T.ip).pos)); o.orig=orig; o.manKept=JSON.stringify(m.pos)===mp;
  o.eg2=APP.egress(J,fw[0]); o.optOvh2=APP.egrOpts(J,fw[0]).some(x=>x[0]==='OVH');
  fw[0].egr={to:'PT',turn:'RIGHT',block:'20-22',name:'EXIT'}; o.eg3=APP.egress(J,fw[0]);
  o.done=APP.casDone(); return o; });
if(!r.inside) fail.push('wheel IP outside the orbit'); if(!r.insideKh) fail.push('keyhole wheel IP outside the orbit');
if(r.eg.to!=='OVH'||!r.optOvh) fail.push('wheel egress default '+r.eg.to); if(!['LEFT','RIGHT'].includes(r.eg.turn)) fail.push('turn '+r.eg.turn);
if(r.restored[0]!==r.orig[0]||r.restored[2]!==r.orig[2]) fail.push('IP not restored'); if(!r.manKept) fail.push('dragged IP moved');
if(!/^CP:/.test(r.eg2.to)||r.optOvh2) fail.push('racetrack egress '+r.eg2.to); if(r.eg3.to!=='PT'||r.eg3.turn!=='RIGHT'||r.eg3.block!=='20-22'||r.eg3.name!=='EXIT') fail.push('free egress '+JSON.stringify(r.eg3));
if(r.done.ok||!/fase 3/.test(r.done.why)) fail.push('casDone before phase 3 '+JSON.stringify(r.done));
// line 9 in the JTAC pack text of the CAS tab
await page.click('#tabcas'); await page.waitForTimeout(300);
const txt=await page.evaluate(()=>{ const J=APP.S.cas.jtacs[0]; J.hold='WHEEL'; APP.casDeconf(J); APP.S.cas.jtacs[0].tasks.forEach(T=>delete T.egr); APP.renderAll(); return document.body.textContent; });
if(!/EGRESS (LEFT|RIGHT), BACK TO OVERHEAD, BLOCK/.test(txt)) fail.push('line 9 back to overhead missing');
if(await page.$('[data-jpack]')) fail.push('JTAC pack buttons before completion'); if(!/JTAC pack disponibile a scenario completato/.test(txt)) fail.push('completion note missing');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
