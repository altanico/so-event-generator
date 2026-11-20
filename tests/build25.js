const ENV = require('./_env.js');
// v1.18.4: CAS wheel / keyhole above the AA threat ceiling, or not proposed
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
const r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.setTheatre('PU'); APP.S.resMode='auto'; APP.S.casCfg={nJtac:1,perJ:3,rw:0}; APP.setEvents(['CAS']); APP.generateGeneric(); APP.S.t=null; APP.S.meta.levels=null;
  const J=APP.S.cas.jtacs[0]; APP.S.zones=APP.S.zones.filter(z=>!/SHORAD|IADS/.test(z.cat));
  J.hold='WHEEL'; APP.casDeconf(J); o.none=J.tasks.map(T=>T.block).join(); o.noneAbove=J.tasks.some(T=>T.above);
  APP.S.zones.push({id:'zz',cat:'SHORAD',name:'x',center:J.echo,r:5}); J.hold='WHEEL'; J.ref='KEYHOLE'; APP.casDeconf(J); o.kh=J.ref+J.hold; o.blocks=J.tasks.map(T=>T.block).join(); o.txt=APP.casHold(J,J.tasks[0]);
  J.tasks[1].block='30-32'; J.tasks[1].blockMan=true; J.hold='WHEEL'; APP.casDeconf(J); o.man=J.tasks[1].block;
  APP.S.meta.levels=[0,150]; o.lvl=APP.casHoldCheck(J,'WHEEL'); J.hold='WHEEL'; APP.casDeconf(J); o.lvlHold=J.hold; o.warn=J.holdWarn; APP.S.meta.levels=null;
  J.ref='CP'; APP.S.zones.push({id:'zy',cat:'IADS',name:'y',center:dest(J.echo,bearing(J.cps[0].pos,J.echo),15),r:2}); o.sam=APP.casHoldCheck(J,'WHEEL'); o.rt=APP.casHoldCheck(J,'RACETRACK').ok;
  APP.S.zones=APP.S.zones.filter(z=>!/^z[yz]$/.test(z.id)); J.tasks[1].blockMan=false; J.tasks[1].above='x'; J.hold='WHEEL'; APP.casDeconf(J); o.back=J.tasks.map(T=>T.block).join();
  return o; });
if(r.noneAbove||r.none!=='10-12,13-15,16-18') fail.push('no threat blocks '+r.none);
if(r.kh!=='KEYHOLEWHEEL'||r.blocks!=='14-16,17-19,20-22') fail.push('MANPADS blocks '+r.kh+' '+r.blocks); if(!/ABOVE THE MANPADS \/ AAA \(12000 FT\) THREAT/.test(r.txt)) fail.push('holding text '+r.txt);
if(r.man!=='30-32') fail.push('manual block overwritten '+r.man);
if(r.lvl.ok||r.lvlHold!=='RACETRACK'||!/racetrack/.test(r.warn)) fail.push('level limit '+JSON.stringify(r.lvl)+' '+r.lvlHold);
if(r.sam.ok||!/SAM/.test(r.sam.reason)||!r.rt) fail.push('SAM '+JSON.stringify(r.sam));
if(r.back!=='10-12,13-15,16-18') fail.push('blocks not restored '+r.back);
// phase 3: real threats (MR-SAM disables both options in the select)
const s=await page.evaluate(()=>{ const J=APP.S.cas.jtacs[0]; J.ref='CP'; APP.S.t={threats:[{id:'T1',type:'SAM_MR',pos:dest(J.echo,bearing(J.cps[0].pos,J.echo),20)}],airspace:[],c2:[],flights:[]}; return ['WHEEL','FIGURE8','RACETRACK'].map(h=>APP.casHoldCheck(J,h).ok).join(); });
if(s!=='false,true,true') fail.push('phase-3 SAM '+s);
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
