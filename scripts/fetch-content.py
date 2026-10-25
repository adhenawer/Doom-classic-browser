#!/usr/bin/env python3
"""Fetch only freely licensed content; verify the fixed release archive."""
import hashlib, io, urllib.request, zipfile
from pathlib import Path
url = 'https://github.com/freedoom/freedoom/releases/download/v0.13.0/freedoom-0.13.0.zip'
expected = '3f9b264f3e3ce503b4fb7f6bdcb1f419d93c7b546f4df3e874dd878db9688f59'
data = urllib.request.urlopen(url, timeout=120).read()
if hashlib.sha256(data).hexdigest() != expected: raise RuntimeError('Freedoom archive checksum mismatch')
output = Path(__file__).resolve().parent.parent / 'web/generated'
output.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(io.BytesIO(data)) as z:
    for src, dest in [('freedoom1.wad', 'freedoom1.wad'), ('COPYING.txt', 'FREEDOOM-COPYING.txt'), ('CREDITS.txt', 'FREEDOOM-CREDITS.txt'), ('CREDITS-MUSIC.txt', 'FREEDOOM-CREDITS-MUSIC.txt')]:
        (output / dest).write_bytes(z.read('freedoom-0.13.0/' + src))
print('Verified Freedoom Phase 1 v0.13.0 and licenses')
