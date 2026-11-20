#!/usr/bin/env python3
"""Terrain tiles for the SO event generator (run by .github/workflows/dem.yml).

Source: Copernicus DEM GLO-90 (3 arc-second, ~90 m), AWS open data bucket copernicus-dem-90m.
Output: data/dem/N{lat}E{lon}.bin for every 1 x 1 degree land tile of Italy and its neighbours,
resampled 3 x 3 -> 9 arc-second cells (~250 m), 400 x 400 cells, rows from north to south.
File = gzip of: int16 LE mean elevation (m) [400*400] then int16 LE max elevation (m) [400*400],
each row delta-encoded (first value absolute, then differences) so that gzip compresses well.
data/dem/index.json lists the tiles and the grid parameters.
Copernicus DEM: (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
"""
import gzip, json, os, sys, urllib.request
import numpy as np
import rasterio

LAT = range(35, 48)   # tile south edges 35..47 -> 35N..48N
LON = range(5, 20)    # tile west edges 5..19 -> 5E..20E
N = 400               # cells per side after 3x3 resampling
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'dem')
URL = 'https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N{la:02d}_00_E{lo:03d}_00_DEM/Copernicus_DSM_COG_30_N{la:02d}_00_E{lo:03d}_00_DEM.tif'

def delta(a):
    d = a.astype(np.int32).copy()
    d[:, 1:] = a[:, 1:].astype(np.int32) - a[:, :-1].astype(np.int32)
    return np.clip(d, -32768, 32767).astype('<i2')

def main():
    os.makedirs(OUT, exist_ok=True)
    tiles = []
    for la in LAT:
        for lo in LON:
            url = URL.format(la=la, lo=lo)
            try:
                with rasterio.open(url) as src:
                    z = src.read(1).astype(np.float32)
            except Exception as e:  # sea tiles do not exist
                print('skip', la, lo, type(e).__name__); continue
            h, w = z.shape
            # resample to N x N: mean and max of the source cells falling in each output cell
            ri = (np.arange(h) * N // h); ci = (np.arange(w) * N // w)
            z = np.where(np.isfinite(z) & (z > -1000), z, 0)
            mean = np.zeros((N, N), np.float64); cnt = np.zeros((N, N), np.float64); mx = np.full((N, N), -1000.0)
            R, C = np.meshgrid(ri, ci, indexing='ij')
            np.add.at(mean, (R, C), z); np.add.at(cnt, (R, C), 1); np.maximum.at(mx, (R, C), z)
            mean = np.round(mean / np.maximum(cnt, 1)).astype(np.int16); mx = np.round(mx).astype(np.int16)
            if int(mx.max()) <= 0: print('flat sea', la, lo); continue
            name = f'N{la:02d}E{lo:03d}'
            with gzip.open(os.path.join(OUT, name + '.bin'), 'wb', compresslevel=9) as f:
                f.write(delta(mean).tobytes()); f.write(delta(mx).tobytes())
            tiles.append(name); print('tile', name, int(mx.max()), 'm')
    json.dump({'source': 'Copernicus DEM GLO-90 (resampled to 9 arc-seconds)', 'credit': 'Copernicus DEM (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA',
               'cells': N, 'format': 'gzip, int16 LE, mean then max, rows north to south, row delta encoded', 'tiles': sorted(tiles)},
              open(os.path.join(OUT, 'index.json'), 'w'), indent=1)
    print(len(tiles), 'tiles')

if __name__ == '__main__':
    sys.exit(main())
