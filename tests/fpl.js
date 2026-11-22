const ENV = require('./_env.js');
// v1.22: suggested flight plans (tab 4), navigation database, OAT / GAT rules, outputs
const { chromium } = require(ENV.PW); const { execSync } = require('child_process');
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.includes('pptxgen'))return r.fulfill({path:ENV.PPTX}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
await page.waitForFunction(()=>!!APP.NAV,{timeout:15000}).catch(()=>fail.push('navdb not loaded'));
const nav=await page.evaluate(()=>({ n:APP.NAV.pts.length, aw:Object.keys(APP.NAV.awy).length, risom:!!APP.navRes('RISOM'), gate:APP.NAV.pts.some(p=>p.k==='G'&&p.x.startsWith('LIPA|')) }));
if(nav.n<2000||nav.aw<200||!nav.risom||!nav.gate) fail.push('navdb '+JSON.stringify(nav));
// airway routing between two areas (GAT IFR): Venezia area to Bologna area
const aw=await page.evaluate(()=>{ const p=APP.awyPath([45.5,12.35],[44.53,11.29]); return p?p.map(x=>x.id+(x.aw?'/'+x.aw:'')).join(' '):null; }); if(!aw||!/\//.test(aw)) fail.push('no airway path '+aw);
// scenario: NE theatre, mixed event, roster with fighters, tankers, helos, a civil helo from a civil base
await page.evaluate(()=>{ APP.S.custom=[]; APP.setTheatre('NE'); APP.S.resMode='auto'; APP.setEvents(['MIX']); APP.generateGeneric(); APP.S.meta.hHour='19:00Z'; APP.S.meta.date='12 DEC 2026';
  APP.S.roster={pilots:[],controllers:[]}; APP.parseLines('1x KC-767A\n2x EF-2000\n2x Tornado IDS\n1x HH-139A\n2x F-35A\n1x AW109'); APP.tailor(); APP.TAB='fpl'; APP.renderAll(); });
await page.click('[data-tab="fpl"]'); await page.waitForTimeout(300);
const tabTxt=await page.textContent('#panel'); if(!/Piani di volo/.test(tabTxt)||!/OAT ICAO Format/.test(tabTxt)) fail.push('tab content');
if(!(await page.$('[data-tab="export"]'))||!/5 · Export/.test(await page.textContent('#tabs'))) fail.push('export tab renamed');
const r=await page.evaluate(()=>APP.fplAll().map(({f,p})=>({cs:f.cs,type:f.type,task:f.task,size:f.size,base:f.base,o:p.out,warn:p.warn,pts:p.pts.map(x=>x.name),area:p.s.aid,oat:p.s.oat,vfr:p.s.vfr})));
if(!r.length) fail.push('no plans');
r.forEach(x=>{ if(!/^N\d{4}[FA]\d{3} /.test(x.o.f15)) fail.push('f15 '+x.cs+' '+x.o.f15); if(!/^[A-Z0-9]{2,7}$/.test(x.o.f7)) fail.push('f7 '+x.o.f7);
  if(x.oat){ if(!/^[IV]M$/.test(x.o.f8)) fail.push('f8 '+x.cs+' '+x.o.f8); if(!/STS\/STATE/.test(x.o.f18)) fail.push('no STS/STATE '+x.cs); if(!/RMK\/OAT/.test(x.o.f18)) fail.push('no RMK/OAT '+x.cs); if(/\bOAT\b/.test(x.o.f15)) fail.push('OAT in f15 (italian format) '+x.cs); }
  if(x.size>1&&x.oat&&!/MARSA/.test(x.o.f18)) fail.push('no MARSA for formation '+x.cs);
  if(/STAY/.test(x.o.f15)&&(x.oat||x.vfr)) fail.push('STAY on OAT/VFR '+x.cs);
  if(!/DOF\/261212/.test(x.o.f18)) fail.push('DOF '+x.cs+' '+x.o.f18); if(!/1900$/.test(x.o.f13)) fail.push('EOBT '+x.o.f13); });
const helo=r.find(x=>/HH-139/.test(x.type)); if(!helo||helo.o.f8!=='VM'||!/A\d{3} /.test(helo.o.f15)) fail.push('helo VFR '+JSON.stringify(helo&&helo.o));
const civ=r.find(x=>/AW109/.test(x.type)); if(civ&&(civ.oat||/STATE/.test(civ.o.f18))) fail.push('civil helo as OAT '+JSON.stringify(civ.o));
// no automatic route: every plan starts empty (DCT), the documents say "route to be filed"
if(r.some(x=>x.pts.length)||r.some(x=>!/ DCT$/.test(x.o.f15))) fail.push('automatic route '+JSON.stringify(r.filter(x=>x.pts.length).map(x=>[x.cs,x.o.f15])));
if(!/Crea la rotta di/.test(tabTxt)||!/rott[ea] da creare/.test(tabTxt)) fail.push('call to action');
// area identifier in field 15 once the route enters the work area
const ar=await page.evaluate(()=>{ const x=APP.fplAll().find(({p})=>p.s.oat&&p.s.aid&&p.s.W.pts.length); if(!x) return null; const R=APP.routeOf(x.f); R.pts=[{id:'',name:'W',pos:x.p.s.W.pts[0],k:''}]; R.legs=[R.legs[0],{...R.legs[0]}]; const p=APP.fplBuild(x.f); const o={aid:p.s.aid,f15:p.out.f15,f18:p.out.f18}; R.pts=[]; R.legs=R.legs.slice(0,1); return o; });
if(!ar||!new RegExp(' '+ar.aid.replace('/','\\/')+'( |$)').test(ar.f15)||!new RegExp('OPAREA/'+ar.aid).test(ar.f18)) fail.push('no AIP area identifier in f15 + OPAREA '+JSON.stringify(ar));
// IGAT below FL195 between two points of the same airway: the airway, not DCT; airways layer switched on by itself
const aw2=await page.evaluate(()=>{ const N=APP.NAV; let A=null,B=null,AW=null; for(const [aw,segs] of Object.entries(N.awy)){ if((N.manual||[]).includes(aw)) continue; for(const sg of segs){ const ok=sg.filter(id=>APP.navRes(id)); if(ok.length>=3){A=APP.navRes(ok[0]);B=APP.navRes(ok[1]);AW=aw;break;} } if(A) break; }
  const f=APP.S.t.flights[0], R=APP.routeOf(f), keep=JSON.stringify(R); R.pts=[A,B].map(p=>({id:p.id,name:p.id,pos:p.pos,k:p.k,x:p.x})); R.legs=[0,1,2].map(()=>({type:'IGAT',lvl:150,agl:1000}));
  const p=APP.fplBuild(f); APP.S.navOn=true; APP.drawNav(); const awyOn=APP.S.navL.awy; R.pts=[]; R.legs=[{type:'IOAT',lvl:150,agl:1000}]; APP.drawNav(); const awyOff=APP.S.navL.awy; Object.assign(R,JSON.parse(keep));
  return { aw:AW, a:A.id, b:B.id, f15:p.out.f15, f8:p.out.f8, warn:p.warn.join(' | '), awyOn, awyOff }; });
if(!new RegExp(`${aw2.a} ${aw2.aw} ${aw2.b}`).test(aw2.f15)||aw2.f8!=='IG'||!/EUROCONTROL/.test(aw2.warn)) fail.push('IGAT airway '+JSON.stringify(aw2));
if(aw2.awyOn!==1||aw2.awyOff!==0) fail.push('airways layer automatic with IGAT '+JSON.stringify(aw2));
// procedure points (IAF / VORxx of MIL.fix) are never used to snap a dropped point
const pr=await page.evaluate(()=>{ const v=APP.NAV.pts.find(p=>p.id==='VOR08'&&p.x==='LIPS'); if(!v) return 'no VOR08'; const s=APP.snapPt(v.pos,3); return { proc:APP.navProc(v), snapped:s.id }; });
if(pr==='no VOR08'||!pr.proc||pr.snapped==='VOR08') fail.push('procedure point snapped '+JSON.stringify(pr));
// ICAO OAT format
await page.evaluate(()=>{ document.querySelector('#panel details').open=true; }); await page.check('#fploat'); await page.waitForTimeout(200);
const r2=await page.evaluate(()=>APP.fplAll().filter(({p})=>p.s.oat).map(({p})=>p.out)); if(r2.some(o=>!/\bOAT\b/.test(o.f15)||/RMK\/OAT/.test(o.f18))) fail.push('ICAO format '+JSON.stringify(r2[0]));
await page.evaluate(()=>{ document.querySelector('#panel details').open=true; }); await page.uncheck('#fploat'); await page.waitForTimeout(200);
// open a card, edit field 18 by hand, it stays after re-render and after a re-tailor of the same flights; restore
const fid=await page.evaluate(()=>APP.S.t.flights[0].id); await page.click(`[data-fplsel="${fid}"]`); await page.waitForTimeout(200);
await page.evaluate(()=>{ document.querySelector('#panel details').open=true; }); await page.fill(`[data-fpl="${fid}:f18"]`,'STS/STATE RMK/TEST EDIT'); await page.dispatchEvent(`[data-fpl="${fid}:f18"]`,'change'); await page.waitForTimeout(200);
const ed=await page.evaluate(id=>{ const f=APP.S.t.flights.find(x=>x.id===id); return APP.fplBuild(f).icaoTxt; },fid); if(!/RMK\/TEST EDIT/.test(ed)) fail.push('manual edit not kept');
if(await page.$eval(`[data-fplreset="${fid}"]`,e=>e.disabled)) fail.push('edited flag');
const ed2=await page.evaluate(id=>{ const f=APP.S.t.flights.find(x=>x.id===id); f.id='NEWID'; const t=APP.fplBuild(f).icaoTxt; f.id=id; APP.fplBuild(f); return t; },fid); if(!/RMK\/TEST EDIT/.test(ed2)) fail.push('manual edit lost when the flight is regenerated (new id, same callsign)');
// map: drag a point (route points of the open card), insert one, remove one -> field 15 follows
const mp=await page.evaluate(id=>{ const f=APP.S.t.flights.find(x=>x.id===id); const P=APP.routeOf(f).pts; const n0=P.length; APP.routeInsertAt(f,{id:'RISOM',name:'RISOM',pos:APP.navRes('RISOM').pos,k:'F'},0); return { n0, f15:APP.fplBuild(f).out.f15 }; },fid);
if(!/ RISOM /.test(mp.f15+' ')) fail.push('route point added on the map not in f15 '+mp.f15);
await page.click(`[data-fplreset="${fid}"]`); await page.waitForTimeout(200);
const rs=await page.evaluate(id=>{ const m=APP.fplStore().man[id]; return { f18:m&&m.f18, pts:m&&m.route&&m.route.pts.length }; },fid); if(rs.f18||!rs.pts) fail.push('restore fields, keep the route '+JSON.stringify(rs));
await page.evaluate(id=>{ const f=APP.S.t.flights.find(x=>x.id===id); APP.routeOf(f).pts=[]; APP.routeOf(f); },fid);
// text file, deck, masterplan, public payload
const [d1]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.click('#fpldl')]); await d1.saveAs('fpl.txt'); const txt=require('fs').readFileSync('fpl.txt','utf8');
if((txt.match(/\(FPL-/g)||[]).length!==r.length||!/Route: to be filed by the flight/.test(txt)) fail.push('text file plans'); if(/[Ç-ž]/.test(txt.replace(/[–·×°]/g,''))) fail.push('non English text?');
const [d2]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.evaluate(()=>exportMasterplan(document.createElement('button')))]); await d2.saveAs('fpl_mp.pdf');
const mpt=execSync('pdftotext fpl_mp.pdf -').toString(); if(!/Suggested flight plans/.test(mpt)||!/\(FPL-/.test(mpt)||!/Route to be filed by the flight/.test(mpt)) fail.push('masterplan section');
const pub=await page.evaluate(()=>{ const pl=APP.buildPayload(true); return { n:(pl.scenario.fplTxt||[]).length, names:JSON.stringify(pl.scenario.fplTxt||[]).includes('Pilot') }; }); if(pub.n!==r.length) fail.push('public payload plans '+pub.n);
// CAS IP / CP correspondence to published points
const cor=await page.evaluate(()=>{ const p=APP.navRes('RISOM'); return { a:APP.pubRef(p.pos), b:APP.pubCor({name:'LANCIA',pos:p.pos}), c:APP.pubRef([43.0,15.5]) }; });
if(cor.a!=='RISOM'||cor.b!==' (corresponds to RISOM)'||cor.c) fail.push('pubRef '+JSON.stringify(cor));
await page.evaluate(id=>{APP.S.fplSel=id;APP.renderAll();},fid); await page.waitForTimeout(200); await page.screenshot({path:'fpl_tab.png',fullPage:false});
// navigation layer toggle
if(await page.evaluate(()=>APP.MAPWIN)!=='nav') fail.push('navigation window not open by itself in the flight plan tab '+await page.evaluate(()=>APP.MAPWIN));
await page.check('#navon'); await page.waitForTimeout(200); if(!(await page.evaluate(()=>APP.S.navOn))) fail.push('nav layer toggle');
if((await page.$$('[data-navl]')).length!==12) fail.push('layer panel switches');
await page.uncheck('[data-navl="vrp"]'); await page.waitForTimeout(100); if(await page.evaluate(()=>APP.S.navL.vrp)) fail.push('layer switch not saved');
if(!/punti visibili|caricamento/.test(await page.textContent('#navcount'))) fail.push('nav counter '+await page.textContent('#navcount'));
const cls=await page.evaluate(()=>{ const c={}; APP.NAV.pts.forEach(p=>{const k=APP.navCls(p)||'-'; c[k]=(c[k]||0)+1;}); return c; });
['VOR','VORTAC','TACAN','NDB','FE','VRP','MIL','GATE'].forEach(k=>{ if(!cls[k]) fail.push('no points of class '+k); }); if(cls.FRA) fail.push('FRA must be an attribute, not a class');
const fra=await page.evaluate(()=>{ const p=APP.NAV.pts.find(x=>x.k==='F'&&x.x.includes('*')&&x.x[0]==='E'); APP.S.navL.fra=1; const a=APP.navSvgP(p); APP.S.navL.fra=0; const b=APP.navSvgP(p); APP.S.navL.fra=1; return { cls:APP.navCls(p), filled:/fill="#1e293b"/.test(a), open:/fill="#fff"/.test(b), type:APP.navTypeTxt(p) }; });
if(fra.cls!=='FE'||!fra.filled||!fra.open||!/FRA/.test(fra.type)) fail.push('FRA attribute symbol '+JSON.stringify(fra));
if(!/#9333ea/.test(await page.evaluate(()=>APP.navSvg('VRP')))) fail.push('VRP not purple');
if(await page.evaluate(()=>{ const d=JSON.parse(JSON.stringify(APP.S.navL)); return d.awy; })) {} // user state may differ
if(await page.evaluate(()=>APP.NAVL_DEF.awy)) fail.push('airways must be off by default');

const svgs=await page.evaluate(()=>['VOR','VORDME','VORTAC','TACAN','DME','NDB','FE','FT','FRA','VRP','MIL','GATE'].map(c=>APP.navSvg(c)));
if(new Set(svgs).size!==12||svgs.some(x=>!/^<svg/.test(x))) fail.push('symbols not distinct');
// route editor: search, add, move, delete, coordinates
await page.evaluate(id=>{APP.S.fplSel=id;APP.renderAll();},fid); await page.waitForTimeout(150);
await page.fill(`[data-fplq="${fid}"]`,'RISO'); await page.waitForTimeout(150);
const resB=await page.$(`#fplres-${fid} [data-fpladd]`); if(!resB) fail.push('search no result'); else { await resB.click(); await page.waitForTimeout(200); }
let r15=await page.evaluate(id=>APP.fplBuild(APP.S.t.flights.find(x=>x.id===id)).out.f15,fid); if(!/ RISOM( |$)/.test(r15)) fail.push('point from search not in route '+r15);
const n1=await page.evaluate(id=>APP.fplBuild(APP.S.t.flights.find(x=>x.id===id)).pts.length,fid);
await page.fill(`[data-fplq="${fid}"]`,'4530N01230E'); await page.waitForTimeout(150); await page.click(`#fplres-${fid} [data-fpladd]`); await page.waitForTimeout(200);
r15=await page.evaluate(id=>APP.fplBuild(APP.S.t.flights.find(x=>x.id===id)).out.f15,fid); if(!/4530N01230E/.test(r15)) fail.push('coordinate point '+r15);
const rows=await page.$$(`[data-rpdel^="${fid}|"]`); if(rows.length!==n1+1) fail.push('editor rows '+rows.length+' vs '+(n1+1));
const before=await page.evaluate(id=>APP.fplBuild(APP.S.t.flights.find(x=>x.id===id)).pts.map(x=>x.name),fid);
await page.click(`[data-rpup="${fid}|1"]`); await page.waitForTimeout(150);
const after=await page.evaluate(id=>APP.fplBuild(APP.S.t.flights.find(x=>x.id===id)).pts.map(x=>x.name),fid); if(after[0]!==before[1]||after[1]!==before[0]) fail.push('move up '+JSON.stringify([before,after]));
await page.click(`[data-rpdel="${fid}|0"]`); await page.waitForTimeout(150); if((await page.evaluate(id=>APP.fplBuild(APP.S.t.flights.find(x=>x.id===id)).pts.length,fid))!==before.length-1) fail.push('delete');
// map popup "add to route" path
const pop=await page.evaluate(id=>{ const f=APP.S.t.flights.find(x=>x.id===id), p=APP.navRes('PES'); const n=APP.fplBuild(f).pts.length; APP.routeInsertBest(f,{id:p.id,name:p.id,pos:p.pos,k:p.k,x:p.x}); return [n, APP.fplBuild(f).pts.length, APP.fplBuild(f).out.f15]; },fid);
if(pop[1]!==pop[0]+1||!/ PES /.test(pop[2])) fail.push('insert from map '+JSON.stringify(pop));
await page.screenshot({path:'fpl_editor.png'}); await page.fill('[data-fplq]','PE'); await page.waitForTimeout(150); await page.screenshot({path:'fpl_editor2.png',fullPage:true});
// map tools: 3 icons, auto windows per tab, one window at a time, style radio, threats list
const mt=await page.evaluate(async()=>{ const o={}; const btns=[...document.querySelectorAll('#maptools .mtbtn')].map(b=>b.dataset.mapwin).join(); o.btns=btns;
  document.querySelector('[data-tab="scenario"]').click(); await new Promise(r=>setTimeout(r,150)); o.scen=APP.MAPWIN; o.items=document.querySelectorAll('#maptools [data-addmode^="zone:"]').length;
  document.querySelector('#maptools [data-addmode^="zone:"]').click(); await new Promise(r=>setTimeout(r,50)); o.mode=APP.ADDMODE;
  document.querySelector('[data-mapwin="style"]').click(); await new Promise(r=>setTimeout(r,50)); o.style=APP.MAPWIN; o.nwin=document.querySelectorAll('#maptools .mtwin').length;
  document.querySelector('#maptools .mtclose').click(); await new Promise(r=>setTimeout(r,50)); o.closed=APP.MAPWIN; o.nwin2=document.querySelectorAll('#maptools .mtwin').length;
  document.querySelector('[data-tab="tailor"]').click(); await new Promise(r=>setTimeout(r,150)); o.tailor=APP.MAPWIN;
  document.querySelector('[data-mapwin="thr"]').click(); await new Promise(r=>setTimeout(r,50)); o.thr=document.querySelectorAll('#maptools [data-addmode^="threat:"]').length+'/'+document.querySelectorAll('#maptools [data-addmode^="obj:"]').length;
  document.querySelector('[data-tab="fpl"]').click(); await new Promise(r=>setTimeout(r,150)); o.fpl=APP.MAPWIN; return o; });
if(mt.btns!=='style,nav,thr'||mt.scen!=='thr'||!(mt.items>5)||!/^zone:/.test(mt.mode||'')||mt.style!=='style'||mt.nwin!==1||mt.closed!==null||mt.nwin2!==0||mt.tailor!==null||!/^\d+\/\d+$/.test(mt.thr)||mt.thr.startsWith('0')||mt.fpl!=='nav') fail.push('map tools '+JSON.stringify(mt));
// low-level navigation: tactical areas switched on (auto and manual)
const at=await page.evaluate(()=>{ const S=APP.S; S.custom=[]; APP.setTheatre('CT'); S.resMode='auto'; APP.setEvents(['NAVL']); APP.generateGeneric(); const auto=APP.RES().map(z=>z.id).filter(id=>/^LI-AT/.test(id));
  S.resMode='manual'; S.reserved=S.reserved.filter(id=>!/^LI-AT/.test(id)); S.atSig=''; APP.aspCard(); const man=(S.reserved||[]).filter(id=>/^LI-AT/.test(id));
  APP.setEvents(['CAS']); S.resMode='auto'; APP.generateGeneric(); const none=APP.RES().map(z=>z.id).filter(id=>/^LI-AT/.test(id)); return {auto,man,none}; });
if(!at.auto.length||!at.man.length||at.none.length) fail.push('AT areas '+JSON.stringify(at));
console.log(JSON.stringify(r.map(x=>[x.cs,x.type,x.o.f8,x.o.f15,x.o.f18,x.warn]),null,0).slice(0,3000));
console.log(fail.length?'"err": '+fail.join(' | '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
