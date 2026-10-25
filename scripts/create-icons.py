#!/usr/bin/env python3
"""Rasterize the project's simple original D mark without external dependencies."""
from pathlib import Path
import struct, zlib
def inside(x, y, polygon):
    result = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            result = not result
    return result
outer = [(44,40),(102,40),(148,78),(148,148),(44,148)]
inner = [(71,67),(92,67),(121,91),(121,121),(71,121)]
def chunk(name, data):
    return struct.pack('>I', len(data)) + name + data + struct.pack('>I', zlib.crc32(name+data))
output = Path(__file__).resolve().parent.parent / 'web/generated'
output.mkdir(exist_ok=True)
for size in [192, 512]:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            px, py = (x+.5)*192/size, (y+.5)*192/size
            raw.extend((211,166,84) if inside(px,py,outer) and not inside(px,py,inner) else (17,18,16))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>2I5B',size,size,8,2,0,0,0)) + chunk(b'IDAT',zlib.compress(raw,9)) + chunk(b'IEND',b'')
    (output / f'icon-{size}.png').write_bytes(png)
