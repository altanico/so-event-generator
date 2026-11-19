const ENV = require('./_env.js');
// Reserved-area selection: ask before generating, "proponile tu" vs "le scelgo io", deselect all, union of the ticked areas, no demo data
const { chromium } = require(ENV.PW);
(async()=>{const b=await chromium.launch({executablePath:ENV.CHROME,args:['--no-sandbox']});const ctx=await b.newContext();const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.route('**/*',r=>{const u=r.request().url(); if(u.includes('leaflet.min.js'))return r.fulfill({path:ENV.LMOCK}); if(u.includes('pdf-lib.min.js'))return r.fulfill({path:ENV.PDFLIB}); if(u.startsWith(ENV.BASE))return r.continue(); return r.abort();});
await page.goto(ENV.BASE+'/index.html#staff'); await page.waitForTimeout(1500); const fail=[];
const html=await page.content(); if(/Dati DEMO|id="aspdemo"/.test(html)) fail.push('demo button still present');
// fresh scenario, no mode chosen: the generate area asks
await page.evaluate(()=>{ APP.S.custom=[]; APP.S.resMode=undefined; APP.S.zones=[]; APP.S.gen=null; APP.S.meta.theatre='NE'; APP.setEvents(['MIX']); APP.WOPEN='gen'; APP.renderAll(); });
await page.click('[data-tab="scenario"]').catch(()=>{}); await page.waitForTimeout(200);
if(!(await page.$('#genauto'))||!(await page.$('#genman'))) fail.push('no question before generating');
// deselect all
await page.evaluate(()=>{ APP.S.reserved=APP.RES().length?APP.S.reserved:['LI-R49A','LI-R49B']; APP.WOPEN='asp'; APP.renderAll(); });
if(await page.$('#resnone')){ await page.click('#resnone'); await page.waitForTimeout(100); } else fail.push('no deselect-all button');
let r=await page.evaluate(()=>({n:APP.RES().length,m:APP.S.resMode})); if(r.n||r.m!=='manual') fail.push('deselect all: '+JSON.stringify(r));
// manual: pick two areas and generate; the generator must keep them and stay inside
r=await page.evaluate(()=>{ const pick=['LI-R49A','LI-R49B']; APP.S.reserved=pick.slice(); APP.S.resMode='manual'; APP.generateGeneric(); APP.parseLines('4x F-35A\n2x AMX\n1x E-3\n1x KC-767'); APP.tailor();
  return {res:(APP.S.reserved||[]).slice().sort().join(','), iss:(APP.containmentIssues()||[]).length, ast:APP.S.t.airspace.length}; });
if(r.res!=='LI-R49A,LI-R49B') fail.push('manual selection changed: '+r.res); if(r.iss) fail.push('manual: '+r.iss+' containment issues');
// union of the ticked areas
await page.evaluate(()=>{ APP.WOPEN='asp'; APP.renderAll(); }); if(!(await page.$('#cuscombo'))) fail.push('no union button under the table'); else {
 await page.fill('#cuslo','FL100'); await page.fill('#cusup','FL240'); await page.click('#cuscombo'); await page.waitForTimeout(150);
 r=await page.evaluate(()=>{const c=(APP.S.custom||[]).slice(-1)[0]; return c?{lo:c.lower,up:c.upper,res:APP.RES().some(z=>z.id===c.id)}:null;});
 if(!r||r.lo!=='FL100'||r.up!=='FL240'||!r.res) fail.push('union: '+JSON.stringify(r)); }
// auto mode proposes again
r=await page.evaluate(()=>{ APP.S.custom=[]; APP.S.reserved=[]; APP.S.resMode='auto'; APP.generateGeneric(); APP.parseLines('4x F-35A\n2x AMX'); APP.tailor(); return APP.RES().length; });
if(!r) fail.push('auto mode reserved nothing');

// overlapping areas on the map: every area under the click is listed, none is toggled blindly
r=await page.evaluate(()=>{ APP.S.meta.theatre='NE'; let hit=null; for (const z of APP.AIP().zones.filter(z=>z.type!=='COR')) { const c=z.poly[0], p=[c[0]+(z.poly[2][0]-c[0])*0.05, c[1]+(z.poly[2][1]-c[1])*0.05]; const zs=APP.zonesAt(p); if (zs.length>1) { hit={p,ids:zs.map(z=>z.id)}; break; } }
  if (!hit) return null; const h=APP.zonePickHtml(APP.zonesAt(hit.p)); return {n:hit.ids.length, boxes:(h.match(/data-res=/g)||[]).length}; });
if(!r) fail.push('no overlapping point found'); else if(r.boxes!==r.n) fail.push('pick list '+JSON.stringify(r));
// list filters: search, type, state, select shown
await page.evaluate(()=>{ APP.S.reserved=[]; APP.WOPEN='asp'; APP.renderAll(); });
await page.fill('#zfq','R49'); await page.waitForTimeout(100);
r=await page.evaluate(()=>[...document.querySelectorAll('tr[data-zrow]:not([hidden])')].map(t=>t.dataset.zrow));
if(!r.length||r.some(id=>!/R49/i.test(id))) fail.push('search filter: '+r.slice(0,5));
await page.click('#zfon'); await page.waitForTimeout(100);
r=await page.evaluate(()=>APP.S.reserved.slice()); if(!r.length||r.some(id=>!/R49/i.test(id))) fail.push('select shown: '+r.slice(0,5));
await page.selectOption('#zfsel','on'); await page.waitForTimeout(100);
if((await page.$$('tr[data-zrow]:not([hidden])')).length!==r.length) fail.push('state filter');
await page.click('#zfreset'); await page.selectOption('#zftype','TSA'); await page.waitForTimeout(100);
r=await page.evaluate(()=>[...document.querySelectorAll('tr[data-zrow]:not([hidden])')].map(t=>APP.S.asp.zones.find(z=>z.id===t.dataset.zrow)).map(z=>z&&z.type));
if(!r.length||r.some(t=>t!=='TSA')) fail.push('type filter: '+r.slice(0,5));
await page.selectOption('#zfall','1'); await page.selectOption('#zfsort','name'); await page.waitForTimeout(100);
r=await page.evaluate(()=>({n:document.querySelectorAll('tr[data-zrow]').length, names:[...document.querySelectorAll('tr[data-zrow]:not([hidden]) td:nth-child(3)')].map(t=>t.firstChild.textContent)}));
if(r.n<200) fail.push('all-Italy list '+r.n); if(r.names.join('|')!==r.names.slice().sort((a,b)=>a.toLowerCase()<b.toLowerCase()?-1:1).join('|')) fail.push('sort by name');

// ticking an area keeps the list where it was; search ignores spaces and dashes
await page.selectOption('#zftype',''); await page.fill('#zfq',''); await page.waitForTimeout(100);
await page.evaluate(()=>{document.querySelector('#zlist').scrollTop=600;}); const before=await page.evaluate(()=>document.querySelector('#zlist').scrollTop);
await page.evaluate(()=>{ const rows=[...document.querySelectorAll('#zlist input[data-res]')]; const el=rows.find(i=>{const r=i.getBoundingClientRect(), b=document.querySelector('#zlist').getBoundingClientRect(); return r.top>b.top+5&&r.bottom<b.bottom-5;}); el.click(); });
await page.waitForTimeout(150); const after=await page.evaluate(()=>document.querySelector('#zlist').scrollTop);
if(!(before>0)||Math.abs(after-before)>2) fail.push(`list scroll ${before} -> ${after}`);
await page.fill('#zfq','tsa 73'); await page.waitForTimeout(100);
r=await page.evaluate(()=>[...document.querySelectorAll('tr[data-zrow]:not([hidden])')].map(t=>t.dataset.zrow)); if(!r.length||r.some(id=>!/TSA.?73/i.test(id))) fail.push('normalised search: '+r.slice(0,5));

// the map follows the list: all Italy draws every area, the search narrows the map too
await page.fill('#zfq',''); await page.selectOption('#zfall',''); await page.waitForTimeout(100); const nNear=await page.evaluate(()=>APP.mapZones().length);
await page.selectOption('#zfall','1'); await page.waitForTimeout(100); const nAll=await page.evaluate(()=>APP.mapZones().length);
if(!(nAll>nNear)) fail.push(`map all-Italy ${nNear} -> ${nAll}`);
await page.fill('#zfq','R49'); await page.waitForTimeout(100); r=await page.evaluate(()=>APP.mapZones().filter(z=>!APP.S.reserved.includes(z.id)).map(z=>z.id)); if(r.some(id=>!/R49/i.test(id))) fail.push('map search filter '+r.slice(0,4));
await page.fill('#zfq',''); await page.selectOption('#zfall','');

// manual mode: OAT corridors off unless ticked; auto mode proposes them
r=await page.evaluate(()=>{ const o={}; APP.S.custom=[]; APP.S.meta.theatre='SA'; APP.setEvents(['MIX']); APP.WOPEN='asp'; APP.renderAll();
  APP.S.resMode='auto'; APP.S.reserved=[]; APP.generateGeneric(); APP.parseLines('4x F-35A\n1x KC-767'); APP.tailor(); o.auto=(APP.S.cor||[]).length;
  document.querySelector('#resman').click(); o.afterSwitch=(APP.S.cor||[]).length;
  APP.generateGeneric(); APP.parseLines('4x F-35A\n1x KC-767'); APP.tailor(); o.manual=(APP.S.cor||[]).length; return o; });
if(!r.auto) fail.push('auto mode: no corridors proposed (SA)'); if(r.afterSwitch||r.manual) fail.push('manual mode corridors on: '+JSON.stringify(r));

// proposals follow the levels the event flies: AAR / intercept training never get low-level areas, and always get one fitting area
r=await page.evaluate(()=>{ const o=[], lim=s=>{const m=String(s).match(/FL\s?(\d+)/); return m?+m[1]:(/(\d+)\s?FT/.exec(s)||[0,0])[1]/100;};
  for (const [ev,b] of [['AAR',[150,280]],['ID',[100,350]]]) for (const th of ['NE','NO','CT','SA','SI','PU']) { APP.S.custom=[]; APP.S.resMode='auto'; APP.S.meta.theatre=th; APP.setEvents([ev]); APP.generateGeneric();
    const res=APP.RES(); const low=res.filter(z=>z.type!=='IND'&&!/TBC/.test(z.upper)&&lim(z.upper)<b[0]); if(low.length) o.push(`${ev} ${th}: low ${low.map(z=>z.id)}`);
    if(!res.some(z=>z.type!=='IND'&&lim(z.upper)>=b[0]+50)) o.push(`${ev} ${th}: no area for FL${b[0]}-${b[1]}`); } return o; });
fail.push(...r);
console.log(fail.length?'"err": '+fail.join('; '):'checks ok'); console.log(errs.join('\n')||'no errors'); await b.close();})();
