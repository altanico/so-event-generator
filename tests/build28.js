const ENV = require('./_env.js');
// v1.18.7: no automatic marks (lines 7 / 8), weapon choice, racetrack / figure 8 orientation, holdings inside the reserved areas
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage({viewport:{width:1280,height:800}});const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
const r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.setTheatre('NE'); APP.S.resMode='auto'; APP.S.casCfg={nJtac:2,perJ:3,rw:0}; APP.setEvents(['CAS']); APP.generateGeneric();
  const Js=APP.S.cas.jtacs; o.marks=Js.flatMap(J=>J.tasks.map(T=>T.mark)); o.fmarks=Js.flatMap(J=>J.friendlies.map(x=>x.mark));
  o.inside=Js.map(J=>APP.holdInside(J)||!!J.fitWarn); o.res=(APP.S.reserved||[]).length;
  // tailoring with participants: weapons from the aircraft list, staff choice kept, MQ-9
  APP.S.roster={pilots:[],controllers:[{id:'c1',name:'J',pref:'JTAC'}]}; APP.parseLines('2x AMX\n1x MQ-9\n2x F-35A'); APP.tailor();
  const all=APP.S.cas.jtacs.flatMap(J=>J.tasks.map(T=>({J,T}))).filter(x=>x.T.flight); o.marks2=all.map(x=>x.T.mark);
  const mq=all.find(x=>/MQ-9/.test((APP.S.t.flights.find(f=>f.id===x.T.flight)||{}).type)); o.mq=mq?APP.wpnChoices(mq.T):null;
  const amx=all.find(x=>/F-35A/.test((APP.S.t.flights.find(f=>f.id===x.T.flight)||{}).type)); if(amx){ amx.T.wpn='GBU-31'; amx.T.wpnMan=true; } APP.tailor();
  const amx2=APP.S.cas.jtacs.flatMap(J=>J.tasks).find(T=>T.id===(amx&&amx.T.id)); o.kept=amx2&&amx2.wpn;
  // orientation
  const J=APP.S.cas.jtacs[0]; J.hold='RACETRACK'; J.ref='CP'; J.hAxis=null; J.hMan=false; APP.casDeconf(J); const T=J.tasks.find(x=>!x.rw); o.t0=APP.casHold(J,T); const s0=JSON.stringify(APP.casHoldShape(J));
  J.hAxis=45; J.hMan=true; J.hTurn='LEFT'; APP.casDeconf(J); o.t1=APP.casHold(J,T); o.rot=JSON.stringify(APP.casHoldShape(J))!==s0; o.axis=Math.round(APP.holdAxis(J));
  J.hold='FIGURE8'; APP.casDeconf(J); o.t2=APP.casHold(J,T);
  return o; });
if(r.marks.some(m=>m!=='NONE')||r.marks2.some(m=>m!=='NONE')) fail.push('automatic target marks '+r.marks+' / '+r.marks2); if(r.fmarks.some(m=>m!=='none')) fail.push('automatic friendly marks '+r.fmarks);
if(!r.res) fail.push('no reserved areas in the test'); if(r.inside.some(x=>!x)) fail.push('holding outside the reserved areas without warning');
if(!r.mq||r.mq.join()!=='GBU-12,AGM-114 Hellfire') fail.push('MQ-9 weapons '+r.mq); if(r.kept!=='GBU-31') fail.push('staff weapon not kept '+r.kept);
if(!/RACETRACK, (10|8|6|5) MILE LEGS, AXIS \d{3}\/\d{3}/.test(r.t0)) fail.push('racetrack text '+r.t0); if(!r.rot||r.axis!==45||!/LEFT TURNS/.test(r.t1)) fail.push('orientation '+r.t1);
if(!/FIGURE EIGHT, \d+ MILE LEGS, AXIS/.test(r.t2)) fail.push('figure 8 text '+r.t2);
// line 8 without "MARKED BY", the friendly mark menu works
await page.click('#tabcas'); await page.waitForTimeout(300);
let txt=await page.evaluate(()=>document.getElementById('panel').textContent); if(/MARKED BY/.test(txt)) fail.push('MARKED BY without a staff choice');
await page.selectOption('select[data-casf="J1:0"]','IR strobe'); await page.waitForTimeout(200);
txt=await page.evaluate(()=>{ const J=APP.S.cas.jtacs[0]; if(J.friendlies[0].mark!=='IR strobe') return 'NOSET'; J.friendlies.forEach(x=>x.mark='IR strobe'); APP.renderAll(); return document.getElementById('panel').textContent; }); if(!/MARKED BY IR STROBE/.test(txt)) fail.push('friendly mark menu');
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
