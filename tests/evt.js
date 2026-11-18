const ENV = require('./_env.js');
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});
const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1300,height:900}});const page=await ctx.newPage();const errs=[];
page.on('pageerror',e=>errs.push('PAGEERR '+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
await page.route('**/*',r=>{const u=r.request().url();
 if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK});
 if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX});
 if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB});
 if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(800);
const R={
 AAR:'4x F-35A\n2x KC-767A\n2x Eurofighter',
 ID:'4x Eurofighter\n2x E-3A',
 NAVI:'3x C-130J\n2x Eurofighter',
 NAVL:'3x AW139\n2x HH-101',
 SAR:'3x AW139\n1x ATR 72',
 HEMS:'3x H145\n2x AW109',
 MEDEVAC:'2x HH-101\n2x AW139\n1x C-130J',
 HOSPITAL:'2x H145\n1x PC-12',
 HUMAN:'2x C-130J\n2x CH-47',
 AIB:'2x CL-415\n3x AW139\n1x AT-802',
 CAS:'4x AMX\n2x A-129',
 MIX:'4x F-35A\n2x Eurofighter\n2x KC-767A\n2x AW139\n1x E-3A',
 COMBO:'4x F-35A\n2x KC-767A\n3x AW139\n2x H145',
};
const combos={AAR:['AAR'],ID:['ID'],NAVI:['NAVI'],NAVL:['NAVL'],SAR:['SAR'],HEMS:['HEMS'],MEDEVAC:['MEDEVAC'],HOSPITAL:['HOSPITAL'],HUMAN:['HUMAN'],AIB:['AIB'],CAS:['CAS'],MIX:['MIX'],COMBO:['AAR','SAR','HEMS','NAVL']};
for(const k of Object.keys(combos)){
 const out=await page.evaluate(({k,ev,txt})=>{try{
  APP.S=JSON.parse(JSON.stringify(APP.S)); const S=APP.S; S.roster={pilots:[],controllers:[{name:'Mario Rossi',pref:'APP'},{name:'Luigi Bianchi',pref:'GCI'}]}; S.t=null;
  APP.setEvents(ev); APP.generateGeneric(); APP.parseLines(txt); APP.tailor();
  const t=APP.S.t; return {k, op:APP.S.meta.op, ev:APP.S.meta.events, cats:APP.S.cats, flights:t.flights.map(f=>f.cs+':'+f.task), serials:t.serials.length, routes:t.airspace.filter(a=>a.type==='ROUTE').map(a=>a.names.join('>')), sers:t.serials.map(x=>x.text.slice(0,110)), ser0:t.serials[0]&&t.serials[0].title, thr:t.threats.length, obj:t.objectives.length, asp:t.airspace.map(a=>a.type).join(','), c2:t.c2.map(c=>c.cs+'='+c.freq).join(','), warn:t.warnings, bg:APP.S.background.slice(0,90), tl:t.timeline.length}
 }catch(e){return {k,err:e.message+e.stack.slice(0,300)}}},{k,ev:combos[k],txt:R[k]});
 console.log(JSON.stringify(out));
}
console.log(errs.join('\n')||'no errors'); await b.close();})();
