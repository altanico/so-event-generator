# Step 1 of 2: reads an AIP Italia ENR 5.1.x PDF (area table) into raw rows per area.
# Usage: python3 tools/aip_extract.py data/aip_src/LI-ENR_5.1.2.pdf /tmp/r512.json
import pdfplumber, json, re, sys
pdf=pdfplumber.open(sys.argv[1])
entries=[]; cur=None
for pn,p in enumerate(pdf.pages):
    w=p.extract_words(keep_blank_chars=False, x_tolerance=1.5)
    idw=[x for x in w if x['text']=='Identification,']; upw=[x for x in w if x['text']=='Upper']
    if idw: off=idw[0]['x0']-90; htop=idw[0]['top']
    elif upw: off=upw[0]['x0']-240; htop=upw[0]['top']
    else: continue
    if any(x['text']=='CONFIGURAZIONI' for x in w) and cur: stop=True
    else: stop=False
    b1,b2,b3=off+228,off+282,off+402
    rows={}
    for x in w:
        if x['top']<htop+40 or x['top']>p.height-55: continue
        k=round(x['top']/2.5)
        rows.setdefault(k,[]).append(x)
    for k in sorted(rows):
        ws=sorted(rows[k],key=lambda x:x['x0'])
        cols=['','','','']
        for x in ws:
            c=0 if x['x0']<b1 else 1 if x['x0']<b2 else 2 if x['x0']<b3 else 3
            cols[c]+=(' ' if cols[c] else '')+x['text']
        if cols[0].startswith('CONFIGURAZIONI'): cur=None; break
        if re.match(r'^(LI(/L\w)? (R|D|TSA|TRA|CBA)\s?\d|EUC\s?\d)',cols[0]):
            cur={'head':cols[0],'c1':[],'c2':[],'c3':[],'c4':[],'page':pn+1}; entries.append(cur)
            for i in (1,2,3):
                if cols[i]: cur['c%d'%(i+1)].append(cols[i])
            continue
        if cur is None: continue
        for i in range(4):
            if cols[i]: cur['c%d'%(i+1)].append(cols[i])
json.dump(entries,open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
print(len(entries))
