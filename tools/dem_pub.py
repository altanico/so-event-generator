#!/usr/bin/env python3
"""Terrain tiles for the published artifact: the artifact serves only web types, so the .bin tiles are copied
as base64 text (dist/data/dem/N..E...b64.txt) with an index.json that tells the app the extension."""
import base64, json, os
src = os.path.join(os.path.dirname(__file__), '..', 'data', 'dem'); dst = os.path.join(os.path.dirname(__file__), '..', 'dist', 'data', 'dem')
os.makedirs(dst, exist_ok=True); idx = json.load(open(os.path.join(src, 'index.json')))
for n in idx['tiles']:
    open(os.path.join(dst, n + '.b64.txt'), 'w').write(base64.b64encode(open(os.path.join(src, n + '.bin'), 'rb').read()).decode())
idx['ext'] = 'b64.txt'; json.dump(idx, open(os.path.join(dst, 'index.json'), 'w'), indent=1); print(len(idx['tiles']), 'tiles ->', dst)
