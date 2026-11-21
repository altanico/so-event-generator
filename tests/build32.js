const ENV = require('./_env.js');
// v1.20: AAR in the assignment step – receiver windows 5'-15' with ARCT, overload warning / rebalancing, tanker -> track, tankers on one track >= 5000 ft apart
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const page=await b.newPage({viewport:{width:1280,height:800}});const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
let r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.setTheatre('NE'); APP.S.resMode='auto'; APP.setEvents(['AAR']); APP.generateGeneric();
  APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('1x KC-767A\n2x EF-2000\n2x F-35A\n2x Tornado IDS\n2x M-346'); APP.tailor(); const t=APP.S.t, c=t.aar.cards[0];
  o.rcv=c.rcv; o.win=c.win; const w=APP.tl(); o.w=[w.on0,w.on1]; o.spins=t.spins.filter(x=>/AAR card/.test(x)).length; asgApply(); asgApply(); o.spins2=APP.S.t.spins.filter(x=>/AAR card/.test(x)).length; o.card=c.card.filter(x=>x[0]==='RECEIVERS C/S').map(x=>x[1]);
  // short window: 5 min floor and warning
  APP.S.meta.tl={dur:90,dep:15,tr:20,ret:20,land:15}; asgApply(); o.short=APP.S.t.aar.cards[0].win; o.warn=(APP.S.t.aarWarn||[]).length; APP.S.meta.tl=null;
  return o; });
if(!r.rcv.length) fail.push('no receivers'); const ar=r.rcv.map(x=>x.arct); if(ar.some((x,i)=>i&&x-ar[i-1]!==r.win)) fail.push('ARCT not queued '+ar);
if(r.win<5||r.win>15) fail.push('window '+r.win); if(ar[0]<r.w[0]) fail.push('ARCT before arriving on the track');
if(r.spins2!==r.spins) fail.push(`SPINS duplicated ${r.spins}->${r.spins2}`); if(!r.card.every(x=>/ARCT .+, window \d+ min/.test(x))) fail.push('AAR card without ARCT '+r.card[0]);
if(!(r.short<=5&&r.warn)) fail.push(`short window ${r.short} warn ${r.warn}`);
// two tankers: put both on the same track -> 5000 ft apart; a narrow band -> warning
r=await page.evaluate(()=>{ const o={}; APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('1x KC-767A\n1x KC-767A\n2x EF-2000\n2x F-35A\n2x Tornado IDS\n2x M-346'); APP.tailor(); const t=APP.S.t, tks=t.flights.filter(f=>f.task==='AAR');
  o.n=tks.length; const trk=TRK().filter(x=>x.kind==='AAR').sort((a,b)=>(b.hi-b.lo)-(a.hi-a.lo)); tks.forEach(tk=>tk.trkSel=trk[0].id); asgApply();
  o.alts=APP.S.t.aar.cards.map(c=>+c.alt.replace('FL','')); o.band=[trk[0].lo,trk[0].hi]; o.w1=(APP.S.t.aarWarn||[]).filter(x=>/5000 ft/.test(x)).length;
  const narrow=trk[trk.length-1]; tks.forEach(tk=>tk.trkSel=narrow.id); asgApply(); o.nb=[narrow.lo,narrow.hi]; o.w2=(APP.S.t.aarWarn||[]).filter(x=>/5000 ft/.test(x)).length;
  // move a receiver by hand
  const rc=APP.S.t.flights.find(f=>f.task==='RECEIVER'), other=tks.find(tk=>tk.id!==rc.tanker); rc.tanker=other.id; rc.tankerMan=true; asgApply(); o.moved=APP.S.t.aar.cards.find(c=>c.tid===other.id).receivers.includes(rc.cs);
  return o; });
if(r.n!==2) fail.push('tankers '+r.n); else { if(Math.abs(r.alts[0]-r.alts[1])<50&&r.band[1]-r.band[0]>=50) fail.push('tankers on one track less than 5000 ft apart '+r.alts+' band '+r.band); if(r.band[1]-r.band[0]>=50&&r.w1) fail.push('warning with enough band');
  if(r.nb[1]-r.nb[0]<50&&!r.w2) fail.push('no warning with a narrow band '+r.nb); if(!r.moved) fail.push('receiver not moved'); }
// UI table
await page.click('[data-tab="tailor"]'); await page.waitForTimeout(300); const ui=await page.$$eval('[data-aartrk]',x=>x.length); if(ui!==2) fail.push('AAR assignment rows '+ui);
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
