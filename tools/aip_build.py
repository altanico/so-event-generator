# Step 2 of 2: keeps only the military areas (military / firing / State aircraft / Army / military UA), parses lateral limits
# (points, circles, arcs), vertical limits, activity and hours, and writes the generator's airspace JSON.
# Usage: python3 tools/aip_build.py /tmp/raw.json data/aip_zones.json "09 JUL 2026"
# Remove the AIP layer by deleting data/aip_zones.json, data/aip_src/ and tools/aip_*.py.
import json, re, math, sys
e=json.load(open(sys.argv[1])); AIRAC=sys.argv[3] if len(sys.argv)>3 else ''
P=r'(\d{2})°(\d{2})\'(\d{2}(?:\.\d+)?)"([NS])\s*(\d{3})°(\d{2})\'(\d{2}(?:\.\d+)?)"([EW])'
def pt(m): la=int(m[0])+int(m[1])/60+float(m[2])/3600; lo=int(m[4])+int(m[5])/60+float(m[6])/3600; return [la*(-1 if m[3]=='S' else 1), lo*(-1 if m[7]=='W' else 1)]
def km(u,v): return float(v)*{'NM':1.852,'KM':1.0,'M':0.001}[u.upper()]
def dest(c,b,d):
    R=6371.0; la1=math.radians(c[0]); lo1=math.radians(c[1]); br=math.radians(b); dr=d/R
    la2=math.asin(math.sin(la1)*math.cos(dr)+math.cos(la1)*math.sin(dr)*math.cos(br))
    lo2=lo1+math.atan2(math.sin(br)*math.sin(dr)*math.cos(la1),math.cos(dr)-math.sin(la1)*math.sin(la2))
    return [math.degrees(la2),math.degrees(lo2)]
def brg(a,b):
    la1,la2=math.radians(a[0]),math.radians(b[0]); dl=math.radians(b[1]-a[1])
    return (math.degrees(math.atan2(math.sin(dl)*math.cos(la2),math.cos(la1)*math.sin(la2)-math.sin(la1)*math.cos(la2)*math.cos(dl)))+360)%360
def geom(t):
    m=re.search(r'Circular area centered on\s*'+P+r'.*?within a ([\d.]+) (NM|KM|M) radius',t)
    if m:
        c=pt(m.groups()[:8]); r=km(m.group(10),m.group(9)); return [dest(c,b,r) for b in range(0,360,10)], None
    toks=[]; i=0
    for x in re.finditer(P+r'|then arc of circle in (anti-clockwise|clockwise) direction radius ([\d.]+) (NM|KM|M) centred on|till point of origin|till point|border|coast',t):
        if x.group(1): toks.append(('P',pt(x.groups()[:8])))
        elif x.group(9): toks.append(('ARC',x.group(9),km(x.group(11),x.group(10))))
        elif x.group(0)=='till point of origin': toks.append(('ORIG',))
        elif x.group(0) in ('border','coast'): toks.append(('NOTE',x.group(0)))
    out=[]; k=0; notes=set()
    while k<len(toks):
        tk=toks[k]
        if tk[0]=='P': out.append(tk[1]); k+=1
        elif tk[0]=='ARC':
            cw=tk[1]=='clockwise'; r=tk[2]; c=toks[k+1][1]; k+=2
            if k<len(toks) and toks[k][0]=='ORIG': end=out[0]; k+=1
            elif k<len(toks) and toks[k][0]=='P': end=toks[k][1]; k+=1
            else: end=out[0]
            a0=brg(c,out[-1]); a1=brg(c,end); span=((a1-a0)%360) if cw else -((a0-a1)%360)
            n=max(2,int(abs(span)/8))
            for j in range(1,n): out.append(dest(c,a0+span*j/n,r))
            if end is not out[0]: out.append(end)
        elif tk[0]=='NOTE': notes.add(tk[1]); k+=1
        else: k+=1
    return out, notes
LIM=r'UNL|SFC|GND|FL\s?\d{2,3}|\d{2,5}\s?ft\s?(?:AMSL|AGL)?'
def limits(c2):
    t=' '.join(c2); ms=re.findall(LIM,t,flags=re.I)
    up=ms[0] if ms else 'TBC'; lo=ms[-1] if len(ms)>1 else 'TBC'
    if re.search(r'whichever|quale dei due',t,re.I) and len(ms)>=3: lo=f'{ms[1]} or {ms[2]} (whichever higher)'
    if re.search(r'whichever|quale dei due',t,re.I) and len(ms)>=3 and ms[-1].upper() in('SFC','GND') and re.match(r'\d',ms[0]): up=f'{ms[0]} or {ms[1]} (whichever higher)'; lo=ms[-1]
    f=lambda s: re.sub(r'\s+',' ',s.replace('ft',' FT')).strip()
    return f(up), f(lo)
def english(c3):
    t=' '.join(c3)
    m=re.search(r'(Heavy|Firing|Military|Air/ground|Area|VDS|Free|Captive|Helicopters?|UA |UAS|Civil|Hang|Test|Heavy|State|Intensa)',t)
    # English part starts at first capitalised English keyword after the Italian text
    for kw in ['Heavy','Firing','Military','Air/ground','UA military','Test flights','Helicopters','Captive','Free flight','Civil','UAS','Area','Areas','Hang','inside']:
        i=t.find(kw)
        if i>0: return t[i:].strip()
    return t
MIL=re.compile(r'militar|military|tir[oi] a fuoco|firing|aeromobili di Stato|State aircraft|E\.I\.|Italian Army|APR militare',re.I)
def tags(a):
    a=a.lower(); s=[]
    if 'air/ground' in a or 'firing' in a: s.append('FIRING')
    if 'air/ground' in a: s.append('A2G')
    if 'parachute' in a: s.append('PARA')
    if 'helicopter' in a: s.append('HELO')
    if 'ua ' in a or 'ua military' in a or 'rpas' in a or 'ua military' in a: s.append('UAV')
    if 'towing' in a: s.append('TOW')
    if 'heavy military air' in a or 'military air activity' in a or 'state aircraft' in a or 'military air traffic' in a: s.append('AIR')
    return s
zones=[]; skipped=[]
for x in e:
    head=re.sub(r'\s+',' ',x['head']).strip(); act_it_en=' '.join(x['c3'])
    m=re.match(r'LI (R\s?[\d]+\s?(?:/\s?\w+|\w)?)\s*-?\s*(.*)',head)
    code=re.sub(r'\s+','',m.group(1)).replace('/',''); name=m.group(2).strip()
    if not MIL.search(act_it_en) or re.search(r'civil',act_it_en,re.I): skipped.append(f'{code} {name}: {english(x["c3"])}'); continue
    poly,notes=geom(' '.join(x['c1']))
    if len(poly)<3: skipped.append(f'{code} {name}: GEOMETRY?'); continue
    up,lo=limits(x['c2']); act=english(x['c3'])
    rem=' '.join(x['c4']); hr=re.search(r'1\)\s*HR:\s*(.*?)(?:\s2\)|$)',rem); 
    zones.append({'id':'LI-'+code,'name':f'{code} {name}','type':'R','lower':lo,'upper':up,'activity':act.rstrip('.'),'use':tags(act),
      'hours':(hr.group(1)[:160] if hr else ''),'notes':(f'{act.rstrip(".")}. ' + ('Lateral limit partly along a coastline / border: drawn as straight lines. ' if notes else '') + f'Source: AIP Italia ENR 5.1.2{(" (AIRAC "+AIRAC+")") if AIRAC else ""}.').strip(),
      'source':'aip','poly':[[round(a,5),round(b,5)] for a,b in poly]})
json.dump({'source':f'AIP Italia ENR 5.1.2 – restricted areas, military only{(" (AIRAC "+AIRAC+")") if AIRAC else ""}','zones':zones},open(sys.argv[2],'w'),ensure_ascii=False,separators=(',',':'))
print(len(zones),'zones;',len(skipped),'skipped'); print('\n'.join('  - '+s for s in skipped))
