#!/usr/bin/env python3
"""Package only Aurora and its freely licensed content; no engine/commercial WAD."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / 'web/generated'
OUT = ROOT / 'build/aurora'
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((GENERATED / 'aurora.json').read_text())
files = ['aurora.wad', 'aurora-map.wad', 'aurora.json', 'AURORA-CREDITS.txt',
         'FREEDOOM-COPYING.txt', 'FREEDOOM-CREDITS.txt', 'FREEDOOM-CREDITS-MUSIC.txt']
payloads = {name: (GENERATED / name).read_bytes() for name in files}
for item in manifest['files']:
    data = payloads[item['name']]
    if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
        raise SystemExit('Map checksum mismatch: ' + item['name'])
payloads['LEIA-ME.txt'] = ('''ESTAÇÃO AURORA
No DOOM Classic Browser: Importar WAD -> aurora.wad -> Jogar.
Ou use Selecionar conteúdo -> Estação Aurora no site atualizado.
aurora.wad: IWAD completo com assets livres Freedoom; somente E1M1 é original.
aurora-map.wad: PWAD do mapa/título próprios; para ports que aceitam PWAD.
Após a saída, o IWAD continua em E1M2 Freedoom.
Geometria/gerador MIT; assets Freedoom BSD-3-Clause. Veja os créditos incluídos.
Fontes: https://github.com/adhenawer/Doom-classic-browser
''').encode('utf-8')
payloads['SHA256SUMS.txt'] = ''.join(
    f'{hashlib.sha256(data).hexdigest()}  {name}\n'
    for name, data in sorted(payloads.items())
).encode('ascii')
archive = OUT / 'Estacao-Aurora.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(payloads.items()):
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, data)
print(f'{archive.relative_to(ROOT)}: {archive.stat().st_size} bytes')
print('SHA-256:', hashlib.sha256(archive.read_bytes()).hexdigest())
