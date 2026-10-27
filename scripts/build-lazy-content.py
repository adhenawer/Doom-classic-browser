#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Publish immutable, lossless transport objects and map dependency manifests.

Only the pinned Freedoom and its generated Aurora derivative are supported.
Bootstrap retains global IWAD resources (sprites/audio/registries), but never
another map's geometry. PNGs are copied byte-for-byte. No prefetch policy lives
in this build tool: each map lists only its own transitive HD dependencies.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PART_BYTES = 4 * 1024 * 1024
MAP_LUMPS = ['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS',
             'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP']
DDF_HASHES = {
    'anims.ddf': '19fd0768baa19d4ea3130a6413d68f52697fe6b964dcd8fee9543ffb8a9fd9d4',
    'switch.ddf': '056eef775bd6819d32af4845df1bcd740c41b5f0e401dedf861962a01747d694',
    'levels.ddf': '012aadb1c6a58f40fb40bb69f2b2761c88bb66eb96f33c678a5f3fe3b7b55bf6',
    'games.ddf': '952c7da214af1d21faf0453d6b8ea58d2e36cbacd5c2df084e7a07a2fb253807',
    'styles.ddf': 'b39ceb58a3d0d6a2a705495b791a1f6973fa4f7b1eb7f077d690c572c915dcc2',
    'freedoom-games.ddf': '391df81ae737562e2002a3fceac2f252b756eec238ec085cdbf5a1b96bf0c90e',
    'freedoom-styles.ddf': 'ec59c334ff791e6584391081e8d3c88b9078c4981d7bc08e0b37fe37558f2f87',
}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def name(data: bytes) -> str:
    return data.rstrip(b'\0').decode('ascii').upper()


class Publisher:
    def __init__(self, output: Path, part_bytes: int = PART_BYTES):
        if not 1 <= part_bytes <= PART_BYTES:
            raise ValueError('Transport parts must be at most 4 MiB')
        self.output, self.part_bytes = output, part_bytes
        (output / 'content').mkdir(parents=True, exist_ok=True)

    def asset(self, data: bytes) -> dict:
        parts = []
        for offset in range(0, len(data), self.part_bytes):
            block = data[offset:offset + self.part_bytes]
            digest = sha(block)
            filename = f'content/{digest}.bin'
            dest = self.output / filename
            if dest.exists():
                if dest.read_bytes() != block:
                    raise ValueError(f'Corrupt immutable output: {filename}')
            else:
                temp = dest.with_suffix('.tmp')
                temp.write_bytes(block)
                temp.replace(dest)
            parts.append(dict(file=filename, bytes=len(block), sha256=digest, offset=offset))
        return dict(bytes=len(data), sha256=sha(data), parts=parts)


def read_wad(data: bytes) -> list[dict]:
    if len(data) < 12 or data[:4] not in (b'IWAD', b'PWAD'):
        raise ValueError('Invalid WAD header')
    count, directory = struct.unpack_from('<ii', data, 4)
    if count < 0 or directory < 12 or directory + count * 16 > len(data):
        raise ValueError('Invalid WAD directory')
    lumps = []
    for i in range(count):
        offset, size, raw_name = struct.unpack_from('<ii8s', data, directory + i * 16)
        if offset < 0 or size < 0 or offset + size > len(data):
            raise ValueError('Invalid WAD lump range')
        if size and (offset < 12 or (offset < directory + count * 16 and offset + size > directory)):
            raise ValueError('WAD lump overlaps structural metadata')
        lumps.append(dict(name=name(raw_name), offset=offset, bytes=size, data=data[offset:offset + size]))
    spans = sorted((lump['offset'], lump['offset'] + lump['bytes']) for lump in lumps if lump['bytes'])
    if any(left[1] > right[0] for left, right in zip(spans, spans[1:])):
        raise ValueError('Overlapping WAD lumps are unsupported')
    return lumps


def ddf_sections(text: str) -> dict[str, dict[str, str]]:
    text = re.sub(r'/\*.*?\*/|//[^\n]*', '', text, flags=re.S)
    result = {}
    matches = list(re.finditer(r'\[([^\]]+)\]', text))
    for i, match in enumerate(matches):
        section = match[1].upper()
        if section in result:
            raise ValueError(f'Ambiguous DDF section: {section}')
        body = text[match.end():matches[i + 1].start() if i + 1 < len(matches) else len(text)]
        result[section] = {key.upper(): value.strip() for key, value in
                           re.findall(r'([A-Z_][A-Z0-9_.]*)\s*=\s*([^;]+);', body, re.I)}
    return result


def unquote(value: str) -> str:
    return value.strip().strip('"').upper()


def read_rules(source: Path) -> dict:
    rules = {}
    for filename, digest in DDF_HASHES.items():
        location = (source / 'edge_base/freedoom1/scripts' / filename.removeprefix('freedoom-')
                    if filename.startswith('freedoom-') else source / 'edge_defs/scripts' / filename)
        data = location.read_bytes()
        if sha(data) != digest:
            raise ValueError(f'Unsupported EDGE rules revision: {filename}')
        rules[filename] = ddf_sections(data.decode())
    for filename in ('games.ddf', 'styles.ddf'):
        rules[filename].update(rules['freedoom-' + filename])
    return rules


def texture_names(data: bytes) -> list[str]:
    count = struct.unpack_from('<i', data)[0]
    if count < 0 or 4 + count * 4 > len(data):
        raise ValueError('Invalid texture table')
    names = []
    for i in range(count):
        offset = struct.unpack_from('<i', data, 4 + i * 4)[0]
        if offset < 0 or offset + 22 > len(data):
            raise ValueError('Invalid texture record')
        names.append(name(data[offset:offset + 8]))
    return names


def dependency_groups(lumps: list[dict], rules: dict) -> list[set[str]]:
    """Match EDGE's FIRST/LAST WAD order, not alphabetical/name arithmetic."""
    textures, flats, active = [], [], False
    for lump in lumps:
        label = lump['name']
        if label in ('TEXTURE1', 'TEXTURE2'):
            textures.append(texture_names(lump['data']))
        if label in ('F_START', 'FF_START'):
            active = True
        elif label in ('F_END', 'FF_END'):
            active = False
        elif active:
            flats.append(label)
    groups = []
    for definition in rules['anims.ddf'].values():
        kind = unquote(definition.get('TYPE', ''))
        if kind == 'GRAPHIC':
            continue
        if kind not in ('TEXTURE', 'FLAT'):
            raise ValueError('Unsupported animation type')
        if 'SEQUENCE' in definition:
            groups.append({unquote(x) for x in definition['SEQUENCE'].split(',')})
            continue
        first, last = unquote(definition['FIRST']), unquote(definition['LAST'])
        sequences = textures if kind == 'TEXTURE' else [flats]
        found = False
        for sequence in sequences:
            if first not in sequence or last not in sequence:
                continue
            start, end = sequence.index(first), sequence.index(last)
            if end <= start:
                raise ValueError(f'Unsupported animation order: {first}/{last}')
            groups.append(set(sequence[start:end + 1]))
            found = True
        # EDGE may try name-based TX fallback. These pinned WADs use ordinary
        # sequences; retaining endpoints is conservative if neither exists.
        if not found:
            if any(first in seq or last in seq for seq in sequences):
                raise ValueError(f'Incomplete animation sequence: {first}/{last}')
            groups.append({first, last})
    for definition in rules['switch.ddf'].values():
        groups.append({unquote(definition['ON_TEXTURE']), unquote(definition['OFF_TEXTURE'])})
    # ImagePrecache also eagerly resolves the conventional SW1/SW2 counterpart
    # independent of DDF. Freedoom contains additional pairs beyond switch.ddf.
    texture_set = {value for sequence in textures for value in sequence}
    for value in sorted(texture_set):
        if value.startswith('SW1') and ('SW2' + value[3:]) in texture_set:
            groups.append({value, 'SW2' + value[3:]})
    return groups


def map_dependencies(map_name: str, lumps: list[dict], groups: list[set[str]], rules: dict) -> list[str]:
    by_name = {entry['name']: entry['data'] for entry in lumps}
    sides, sectors = by_name['SIDEDEFS'], by_name['SECTORS']
    if len(sides) % 30 or len(sectors) % 26:
        raise ValueError('Malformed map material records')
    materials = {name(sides[at + col:at + col + 8])
                 for at in range(0, len(sides), 30) for col in (4, 12, 20)}
    materials.update(name(sectors[at + col:at + col + 8])
                     for at in range(0, len(sectors), 26) for col in (4, 12))
    level = rules['levels.ddf'].get(map_name)
    if not level or 'SKY_TEXTURE' not in level:
        raise ValueError(f'No authoritative level definition: {map_name}')
    # EDGE precaches the sky even when no sector uses F_SKY1; surround flat can
    # appear with a smaller view window. Neither is a next-map dependency.
    for field in ('SKY_TEXTURE', 'SURROUND_FLAT', 'PRE.TEXT_FLAT', 'END.TEXT_FLAT',
                  'PRE.TEXT_GRAPHIC', 'END.TEXT_GRAPHIC', 'ENTERING_BACKGROUND', 'LEAVING_BACKGROUND'):
        if field in level:
            materials.add(unquote(level[field]))
    # Finale and intermission execute after leaving this level and before the
    # next level barrier. They belong to this map's prepared set, not prefetch.
    episode = unquote(level.get('EPISODE', ''))
    if episode:
        game = rules.get('games.ddf', {}).get(episode)
        if game is None:
            raise ValueError(f'Unknown episode dependency definition: {episode}')
        if 'INTERMISSION_GRAPHIC' in game:
            materials.add(unquote(game['INTERMISSION_GRAPHIC']))
    for style in rules.get('styles.ddf', {}).values():
        if 'BACKGROUND.IMAGE' in style:
            materials.add(unquote(style['BACKGROUND.IMAGE']))
    materials -= {'', '-'}
    previous = set()
    while materials != previous:
        previous = set(materials)
        for group in groups:
            if materials & group:
                materials.update(group)
    return sorted(materials)


def build_wad(data: bytes, publisher: Publisher, rules: dict, hd_ids: set[str]) -> dict:
    lumps = read_wad(data)
    # Unsupported dynamic material definitions must never silently fall back.
    for lump in lumps:
        if lump['name'] in ('ANIMATED', 'SWITCHES', 'ANIMDEFS', 'UMAPINFO', 'MAPINFO',
                            'DDFANIM', 'DDFSWTH', 'DDFLEVL', 'RSCRIPT', 'TEXTMAP'):
            raise ValueError(f'Unmodelled dependency source: {lump["name"]}')
    groups = dependency_groups(lumps, rules)
    owners, maps = {}, {}
    for i, lump in enumerate(lumps):
        label = lump['name']
        if not re.fullmatch(r'(?:E[1-4]M[1-9]|MAP\d\d)', label):
            continue
        if label in maps or [x['name'] for x in lumps[i + 1:i + 11]] != MAP_LUMPS:
            raise ValueError(f'Unsupported map layout: {label}')
        for index in range(i, i + 11):
            owners[index] = label
        materials = map_dependencies(label, lumps[i + 1:i + 11], groups, rules)
        maps[label] = dict(ranges=[], materials=materials, hdAssets=sorted(set(materials) & hd_ids))
    if not maps:
        raise ValueError('WAD has no supported maps')
    spans = sorted((lump['offset'], lump['offset'] + lump['bytes'], owners.get(i))
                   for i, lump in enumerate(lumps) if lump['bytes'])
    # Include every original byte: gaps, header and directory belong to bootstrap.
    coverage, cursor = [], 0
    for start, end, owner in spans:
        if start < cursor:
            raise ValueError('Overlapping WAD lumps are unsupported')
        if cursor < start:
            coverage.append((cursor, start, None))
        coverage.append((start, end, owner))
        cursor = end
    if cursor < len(data):
        coverage.append((cursor, len(data), None))
    merged = []
    for start, end, owner in coverage:
        if merged and merged[-1][1] == start and merged[-1][2] == owner:
            merged[-1] = (merged[-1][0], end, owner)
        else:
            merged.append((start, end, owner))
    bootstrap = []
    for start, end, owner in merged:
        record = dict(offset=start, asset=publisher.asset(data[start:end]))
        (bootstrap if owner is None else maps[owner]['ranges']).append(record)
    return dict(sha256=sha(data), bytes=len(data), bootstrap=bootstrap, maps=maps)


def png_info(data: bytes) -> tuple[int, int, int]:
    if data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR':
        raise ValueError('Invalid PNG')
    width, height, depth, color = struct.unpack_from('>IIBB', data, 16)
    channels = {0: 1, 2: 3, 3: 3, 4: 2, 6: 4}.get(color)
    if not channels or not width or not height:
        raise ValueError('Unsupported PNG color type/dimensions')
    at, transparent = 8, False
    while at + 12 <= len(data):
        length = struct.unpack_from('>I', data, at)[0]
        if at + length + 12 > len(data):
            raise ValueError('Truncated PNG chunk')
        kind = data[at + 4:at + 8]
        transparent |= kind == b'tRNS'
        at += length + 12
        if kind == b'IEND':
            break
    if transparent and color in (0, 2, 3):
        channels = 4 if color == 3 else channels + 1
    return width, height, channels


def build_hd(epk: Path, publisher: Publisher, expected: dict) -> dict:
    """Expose PNGs individually and retain ZIP framing for exact reconstruction."""
    digest = hashlib.sha256()
    with epk.open('rb') as source:
        for block in iter(lambda: source.read(PART_BYTES), b''):
            digest.update(block)
    if digest.hexdigest() != expected['sha256'] or epk.stat().st_size != expected['bytes']:
        raise ValueError('Pinned HD EPK integrity mismatch')
    assets, entries, spans = {}, {}, []
    with zipfile.ZipFile(epk) as archive, epk.open('rb') as source:
        infos = archive.infolist()
        if len({info.filename for info in infos}) != len(infos):
            raise ValueError('Ambiguous ZIP names')
        manifest = json.loads(archive.read('manifest.json'))
        metadata = {item['path']: item for item in manifest['assets']}
        for info in infos:
            if info.compress_type != zipfile.ZIP_STORED or info.flag_bits & 1:
                raise ValueError('Only original unencrypted STORED EPK is supported')
            path = PurePosixPath(info.filename)
            if path.is_absolute() or '..' in path.parts:
                raise ValueError('Unsafe ZIP path')
            payload = archive.read(info)
            asset = publisher.asset(payload)
            if info.filename in metadata:
                item = metadata.pop(info.filename)
                width, height, channels = png_info(payload)
                if (asset['sha256'] != item['sha256'] or asset['bytes'] != item['bytes']
                        or (width, height) != (item['width'], item['height'])):
                    raise ValueError(f'HD image metadata mismatch: {info.filename}')
                if path.parent != PurePosixPath('hires') or path.suffix != '.png':
                    raise ValueError('Unsupported image namespace')
                identifier = path.stem.upper().replace('^', '\\')
                if identifier in assets:
                    raise ValueError('Duplicate HD material name')
                assets[identifier] = dict(asset, path=info.filename, width=width, height=height,
                                          channels=channels, logicalWidth=item['logicalWidth'],
                                          logicalHeight=item['logicalHeight'])
            else:
                if info.filename.startswith('hires/'):
                    raise ValueError('Uninventoried HD image')
                entries[info.filename] = asset
            source.seek(info.header_offset)
            header = source.read(30)
            if header[:4] != b'PK\x03\x04':
                raise ValueError('Invalid ZIP local header')
            name_length, extra_length = struct.unpack_from('<HH', header, 26)
            offset = info.header_offset + 30 + name_length + extra_length
            spans.append((offset, offset + len(payload), asset))
        if metadata or len(assets) != expected['assetCount']:
            raise ValueError('Incomplete HD manifest')
        ranges, cursor = [], 0
        for start, end, asset in sorted(spans, key=lambda item: item[0]):
            if start < cursor:
                raise ValueError('Overlapping ZIP payloads')
            if start > cursor:
                source.seek(cursor)
                ranges.append(dict(offset=cursor, asset=publisher.asset(source.read(start - cursor))))
            ranges.append(dict(offset=start, asset=asset))
            cursor = end
        source.seek(cursor)
        tail = source.read()
        if tail:
            ranges.append(dict(offset=cursor, asset=publisher.asset(tail)))
    return dict(sourceSHA=expected['sha256'], bytes=expected['bytes'], assets=assets,
                metadataEntries=entries, archiveRanges=ranges)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, default=ROOT / 'web/generated/freedoom1.wad')
    parser.add_argument('--aurora', type=Path, default=ROOT / 'web/generated/aurora.wad')
    parser.add_argument('--aurora-manifest', type=Path, default=ROOT / 'web/generated/aurora.json')
    parser.add_argument('--hd', type=Path, default=ROOT / 'build/modern-content/modern-hd.epk')
    parser.add_argument('--edge-source', type=Path, default=ROOT / 'build/modern-upstream')
    parser.add_argument('--out', type=Path, default=ROOT / 'web/generated')
    args = parser.parse_args()
    pin = json.loads((ROOT / 'engine/MODERN-CONTENT.json').read_text())
    rules = read_rules(args.edge_source)
    publisher = Publisher(args.out)
    hd = build_hd(args.hd, publisher, pin['output'])
    hd['iwad'] = pin['iwad']['sha256']
    iwads = {}
    aurora = json.loads(args.aurora_manifest.read_text())
    for path, expected in ((args.base, pin['iwad']), (args.aurora, aurora)):
        data = path.read_bytes()
        if len(data) != expected['bytes'] or sha(data) != expected['sha256']:
            raise ValueError(f'WAD identity mismatch: {path.name}')
        # Preserve current compatibility: the HD pack applies only to Freedoom.
        ids = set(hd['assets']) if sha(data) == hd['iwad'] else set()
        result = build_wad(data, publisher, rules, ids)
        result['file'] = path.name
        iwads[result['sha256']] = result
    index = dict(version=1, partBytes=PART_BYTES, iwads=iwads, hd=hd,
                 dependencyRules=dict(edgeCommit=json.loads((ROOT / 'engine/EDGE.json').read_text())['commit'],
                                      files=DDF_HASHES),
                 bootstrapPolicy='All global IWAD resources; excludes every map geometry range.')
    encoded = (json.dumps(index, sort_keys=True, indent=2) + '\n').encode()
    target = args.out / 'content-index.json'
    temporary = target.with_suffix('.tmp')
    temporary.write_bytes(encoded)
    temporary.replace(target)
    print(f'Lazy inventory: {len(iwads)} IWADs, {len(hd["assets"])} original HD images, SHA256 {sha(encoded)}')


if __name__ == '__main__':
    main()
