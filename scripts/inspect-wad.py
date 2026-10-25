#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Read-only WAD structural inventory; never exports payloads or map geometry."""
import argparse
import collections
import hashlib
import json
import re
import struct
from pathlib import Path

MAP_LUMPS = {'THINGS': 10, 'LINEDEFS': 14, 'SIDEDEFS': 30, 'VERTEXES': 4,
             'SEGS': 12, 'SSECTORS': 4, 'NODES': 28, 'SECTORS': 26,
             'REJECT': None, 'BLOCKMAP': None}


def inspect(path):
    data = path.read_bytes()
    errors, warnings = [], []
    if len(data) < 12:
        raise ValueError('Header shorter than 12 bytes')
    magic, count, directory = struct.unpack_from('<4sii', data)
    if magic not in (b'IWAD', b'PWAD') or count < 0 or directory < 12 or directory + count * 16 > len(data):
        raise ValueError('Invalid WAD header or directory bounds')
    lumps = []
    namespace = None
    namespaces = []
    for i in range(count):
        offset, size, raw = struct.unpack_from('<ii8s', data, directory + i * 16)
        name = raw.split(b'\0', 1)[0].decode('ascii', errors='backslashreplace')
        valid = offset >= 0 and size >= 0 and offset + size <= len(data)
        if not valid:
            errors.append(f'Lump {i}: invalid bounds')
        if name.endswith('_START'):
            namespaces.append(name.split('_')[0].rstrip('0123456789'))
            namespace = namespaces[-1]
        category = {'S': 'sprite', 'P': 'patch', 'F': 'flat'}.get(namespace, 'other')
        if re.fullmatch(r'E\dM\d|MAP\d\d', name): category = 'map_marker'
        elif name in MAP_LUMPS: category = 'map_data'
        elif name.endswith(('_START', '_END')): category = 'namespace_marker'
        elif name.startswith('DS'): category = 'sound_digital'
        elif name.startswith('DP'): category = 'sound_pc_speaker'
        elif name.startswith('D_'): category = 'music'
        elif name.startswith('DEMO'): category = 'demo'
        elif name == 'ENDOOM': category = 'end_screen_text'
        elif name == 'GENMIDI': category = 'fm_instrument_bank'
        elif name == 'DMXGUS': category = 'gus_instrument_mapping'
        elif name in ('PLAYPAL', 'COLORMAP'): category = 'palette_lighting'
        elif name in ('PNAMES', 'TEXTURE1', 'TEXTURE2'): category = 'texture_definition'
        lumps.append(dict(index=i, name=name, offset=offset, size=size, category=category, bounds_valid=valid))
        if name.endswith('_END'):
            if namespaces: namespaces.pop()
            namespace = namespaces[-1] if namespaces else None
    def payload(lump):
        return data[lump['offset']:lump['offset'] + lump['size']]
    maps = []
    for i, marker in enumerate(lumps):
        if marker['category'] != 'map_marker': continue
        group = lumps[i + 1:i + 11]
        issues = []
        if [x['name'] for x in group] != list(MAP_LUMPS): issues.append('Incorrect vanilla map lump order')
        byname = {x['name']: x for x in group}
        totals = {}
        for name, stride in MAP_LUMPS.items():
            lump = byname.get(name)
            if lump is None or not lump['bounds_valid']:
                issues.append(f'Missing or invalid {name}')
                continue
            if stride:
                totals[name] = lump['size'] // stride
                if lump['size'] % stride: issues.append(f'{name}: incomplete record')
        # Validate numeric references without serializing positions or layouts.
        for name, fmt, refs in [
            ('LINEDEFS', '<7H', [(0, 'VERTEXES'), (1, 'VERTEXES'), (5, 'SIDEDEFS'), (6, 'SIDEDEFS')]),
            ('SIDEDEFS', '<hh8s8s8sH', [(5, 'SECTORS')]),
            ('SEGS', '<6H', [(0, 'VERTEXES'), (1, 'VERTEXES'), (3, 'LINEDEFS')])]:
            lump = byname.get(name)
            if not lump or not lump['bounds_valid'] or lump['size'] % struct.calcsize(fmt): continue
            for rec in struct.iter_unpack(fmt, payload(lump)):
                for field, target in refs:
                    if name == 'LINEDEFS' and target == 'SIDEDEFS' and rec[field] == 65535: continue
                    if rec[field] >= totals.get(target, 0): issues.append(f'{name}: invalid {target} reference')
        ss = byname.get('SSECTORS')
        if ss and ss['bounds_valid'] and ss['size'] % 4 == 0:
            for number, first in struct.iter_unpack('<HH', payload(ss)):
                if first + number > totals.get('SEGS', 0): issues.append('SSECTORS: invalid seg range')
        node = byname.get('NODES')
        if node and node['bounds_valid'] and node['size'] % 28 == 0:
            for rec in struct.iter_unpack('<12h2H', payload(node)):
                for child in rec[-2:]:
                    target = 'SSECTORS' if child & 0x8000 else 'NODES'
                    if (child & 0x7fff) >= totals.get(target, 0): issues.append('NODES: invalid child reference')
        reject = byname.get('REJECT')
        needed = (totals.get('SECTORS', 0) ** 2 + 7) // 8
        if reject and reject['size'] < needed: issues.append('REJECT shorter than sector visibility matrix')
        block = byname.get('BLOCKMAP')
        blockinfo = {}
        if block and block['bounds_valid']:
            b = payload(block)
            if len(b) < 8 or len(b) % 2: issues.append('BLOCKMAP invalid size')
            else:
                _, _, width, height = struct.unpack_from('<hhHH', b)
                words = struct.unpack('<' + 'H' * (len(b) // 2), b)
                blockinfo = dict(columns=width, rows=height)
                if 4 + width * height > len(words): issues.append('BLOCKMAP truncated cell table')
                else:
                    for off in set(words[4:4 + width * height]):
                        if off >= len(words): issues.append('BLOCKMAP invalid list offset'); continue
                        if words[off] != 0: issues.append('BLOCKMAP missing initial zero')
                        end = off + 1
                        while end < len(words) and words[end] != 65535:
                            if words[end] >= totals.get('LINEDEFS', 0): issues.append('BLOCKMAP invalid linedef')
                            end += 1
                        if end == len(words): issues.append('BLOCKMAP unterminated list')
        entry = dict(name=marker['name'], marker_index=i, records=totals, reject_bytes=reject['size'] if reject else None,
                     reject_minimum_bytes=needed, blockmap=blockinfo, validation_errors=sorted(set(issues)))
        maps.append(entry)
        errors.extend(f"{marker['name']}: {issue}" for issue in sorted(set(issues)))
    # Resource dependency validation: no texture composition or image data exported.
    lookup = {x['name'].upper(): x for x in lumps}
    dependencies = {}
    pnames = []
    p = lookup.get('PNAMES')
    if p and p['bounds_valid']:
        b = payload(p)
        n = struct.unpack_from('<i', b)[0] if len(b) >= 4 else -1
        if n < 0 or 4 + n * 8 > len(b): errors.append('Invalid PNAMES table')
        else:
            pnames = [b[4 + j * 8:12 + j * 8].split(b'\0')[0].decode('ascii') for j in range(n)]
            dependencies['patch_names_count'] = n
            dependencies['missing_patch_lumps'] = sorted({name.upper() for name in pnames} - set(lookup))
            if dependencies['missing_patch_lumps']: errors.append('PNAMES references missing lumps')
    for name in ('TEXTURE1', 'TEXTURE2'):
        t = lookup.get(name)
        if not t or not t['bounds_valid']: continue
        b = payload(t)
        n = struct.unpack_from('<i', b)[0] if len(b) >= 4 else -1
        bad = 0
        if n < 0 or 4 + n * 4 > len(b): errors.append(f'{name}: invalid offset table'); continue
        for j in range(n):
            off = struct.unpack_from('<i', b, 4 + j * 4)[0]
            if off < 0 or off + 22 > len(b): bad += 1; continue
            patches = struct.unpack_from('<h', b, off + 20)[0]
            if patches < 0 or off + 22 + patches * 10 > len(b): bad += 1; continue
            for k in range(patches):
                patch = struct.unpack_from('<h', b, off + 22 + k * 10 + 4)[0]
                if patch < 0 or patch >= len(pnames): bad += 1
        dependencies[name] = dict(texture_count=n, invalid_definitions_or_patch_indices=bad)
        if bad: errors.append(f'{name}: invalid texture definition/dependency')
    for lump in lumps:
        if lump['bounds_valid'] and lump['size'] > 0:
            start, end = lump['offset'], lump['offset'] + lump['size']
            if start < 12: errors.append(f"Lump {lump['index']}: payload intersects header")
            if start < directory + count * 16 and end > directory:
                errors.append(f"Lump {lump['index']}: payload intersects directory")
    intervals = sorted((x['offset'], x['offset'] + x['size'], x['index']) for x in lumps if x['size'] > 0 and x['bounds_valid'])
    overlaps = []
    for a, b in zip(intervals, intervals[1:]):
        if a[1] > b[0]: overlaps.append([a[2], b[2]])
    duplicates = {k: v for k, v in collections.Counter(x['name'] for x in lumps).items() if v > 1}
    categories = {}
    for x in lumps:
        c = categories.setdefault(x['category'], dict(count=0, bytes=0))
        c['count'] += 1
        c['bytes'] += x['size']
    return dict(schema_version=1, source_basename=path.name, sha256=hashlib.sha256(data).hexdigest(),
                bytes=len(data), magic=magic.decode(), lump_count=count, directory_offset=directory,
                directory_bytes=count * 16, directory_ends_at_eof=directory + count * 16 == len(data),
                categories=categories, duplicate_names=duplicates, adjacent_payload_overlaps=overlaps,
                maps=maps, dependencies=dependencies, errors=errors, warnings=warnings, lumps=lumps)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('wad', type=Path)
    parser.add_argument('--output', type=Path, help='JSON inventory (metadata only)')
    args = parser.parse_args()
    result = inspect(args.wad)
    output = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output)
    else: print(output, end='')
    raise SystemExit(1 if result['errors'] else 0)


if __name__ == '__main__': main()
