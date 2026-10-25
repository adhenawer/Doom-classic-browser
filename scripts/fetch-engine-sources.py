#!/usr/bin/env python3
"""Fetch the exact optional renderer source, preserving it in corresponding source."""
from pathlib import Path
import hashlib, io, json, shutil, tarfile, urllib.request
root = Path(__file__).resolve().parent.parent
pin = json.loads((root / 'engine/CRISPY.json').read_text())
archive = root / 'build/dependency-sources' / pin['file']
archive.parent.mkdir(parents=True, exist_ok=True)
data = archive.read_bytes() if archive.exists() else urllib.request.urlopen(pin['url'], timeout=180).read()
if len(data) != pin['bytes'] or hashlib.sha256(data).hexdigest() != pin['sha256']:
    raise RuntimeError('Crispy source length/SHA-256 mismatch')
archive.write_bytes(data)
target = root / 'build/crispy-upstream'
if target.exists(): shutil.rmtree(target)
target.mkdir()
with tarfile.open(fileobj=io.BytesIO(data)) as source:
    prefix = f"crispy-doom-{pin['commit']}/"
    for member in source.getmembers():
        if not member.name.startswith(prefix):
            if member.name == prefix[:-1]: continue
            raise RuntimeError('Unexpected source archive root')
        member.name = member.name[len(prefix):]
        if member.name: source.extract(member, target, filter='data')
output = root / 'web/generated'
output.mkdir(parents=True, exist_ok=True)
shutil.copyfile(target / 'COPYING.md', output / 'CRISPY-COPYING.txt')
print('Verified optional renderer source:', pin['commit'], pin['sha256'])
