#!/usr/bin/env python3
"""Archive matching library/runtime sources alongside the GPL corresponding source."""
from pathlib import Path
import json, hashlib, urllib.request, zipfile, tarfile, io
root = Path(__file__).resolve().parent.parent
output = root / 'build/dependency-sources'
output.mkdir(parents=True, exist_ok=True)
notices = ['Third-party notices for the browser binary. Complete matching sources are in source.tar.gz.\n']
for dependency in json.loads((root / 'engine/DEPENDENCIES.json').read_text()):
    path = output / dependency['file']
    data = path.read_bytes() if path.exists() else urllib.request.urlopen(dependency['url'],timeout=180).read()
    if hashlib.sha256(data).hexdigest() != dependency['sha256']: raise RuntimeError('Source hash mismatch: '+dependency['file'])
    path.write_bytes(data)
    notices.append('\n===== ' + dependency['file'] + ' =====\n')
    if path.suffix == '.zip':
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            name = next(n for n in z.namelist() if n.count('/') == 1 and n.endswith('/LICENSE.txt'))
            notices.append(z.read(name).decode())
    else:
        with tarfile.open(fileobj=io.BytesIO(data)) as t:
            for name in ['emscripten-4.0.18/LICENSE', 'emscripten-4.0.18/system/lib/libc/musl/COPYRIGHT']:
                notices.append(t.extractfile(name).read().decode())
    print('Verified corresponding dependency source:', dependency['file'])
notices.append('\n===== Optional Crispy Doom renderer =====\n')
notices.append((root / 'web/generated/CRISPY-COPYING.txt').read_text())
notices.append('\n===== Vite build helper / module preload polyfill =====\n')
notices.append((root / 'node_modules/vite/LICENSE.md').read_text())
(root / 'web/generated/THIRD-PARTY-NOTICES.txt').write_text('\n'.join(notices))
