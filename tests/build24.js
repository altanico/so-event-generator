const ENV = require('./_env.js');
// v1.18.3: CAS points draggable on the map (ECHO, JTAC, friendlies, targets, CP, IP); geometry and texts follow
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.S.casCfg={nJtac:1,perJ:3,rw:0}; APP.setEvents(['CAS']); APP.generateGeneric(); APP.renderAll(); });
await page.click('#tabcas'); await page.waitForTimeout(300);
const r=await page.evaluate(()=>{ const o={}; const rec=[]; const om=L.marker; L.marker=(p,opt)=>{ const m=om(p,opt); m._h={}; m.on=(ev,fn)=>{ m._h[ev]=fn; return m; }; rec.push({p,opt,m}); return m; };
  drawMap(); L.marker=om; const J=APP.S.cas.jtacs[0], T=J.tasks.find(x=>!x.rw), ip=J.ips.find(x=>x.name===T.ip);
  const find=pos=>rec.find(x=>x.p===pos); o.missing=[['ECHO',J.echo],['JTAC',J.jtacPos],['IP',ip.pos],['CP',J.cps[0].pos],['TGT',J.targets[0].pos],...J.friendlies.map(f=>['FR',f.pos])].filter(([n,p])=>{ const x=find(p); return !x||!x.opt.draggable||!x.m._h.dragend; }).map(x=>x[0]);
  J.hold='KEYHOLE'; const ax0=Math.round(APP.keyhole(J).axis), l2a=APP.casNine?null:null; const h0=APP.casHold(J,T);
  const mIp=find(ip.pos); const np=[ip.pos[0]+0.15, ip.pos[1]-0.2]; mIp.m._h.dragend({ target:{ getLatLng:()=>({lat:np[0],lng:np[1]}) } });
  const J2=APP.S.cas.jtacs[0], ip2=J2.ips.find(x=>x.name===T.ip); o.moved=Math.abs(ip2.pos[0]-np[0])<1e-4; o.h1=APP.casHold(J2,J2.tasks.find(x=>x.id===T.id)); o.h0=h0;
  return o; });
if(r.missing.length) fail.push('not draggable: '+r.missing.join(',')); if(!r.moved) fail.push('IP not moved'); if(r.h0===r.h1) fail.push('keyhole axis did not follow the IP');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
