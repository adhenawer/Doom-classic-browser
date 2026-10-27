"""Lossless transport, phase isolation and dependency closure regressions."""
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lazy_content', ROOT / 'scripts/build-lazy-content.py')
lazy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lazy)


def wad(lumps):
    payload = bytearray(b'IWAD' + bytes(8))
    directory = bytearray()
    for label, data in lumps:
        directory.extend(struct.pack('<ii8s', len(payload), len(data), label.encode()))
        payload.extend(data)
    struct.pack_into('<ii', payload, 4, len(lumps), len(payload))
    return bytes(payload + directory)


def texture_table(names):
    offsets = [4 + 4 * len(names) + 22 * i for i in range(len(names))]
    return (struct.pack('<i', len(names)) + struct.pack('<' + 'i' * len(names), *offsets)
            + b''.join(struct.pack('<8sihhih', n.encode(), 0, 64, 64, 0, 0) for n in names))


def map_lumps(label, wall, flat, marker):
    sides = struct.pack('<hh8s8s8sH', 0, 0, wall.encode(), b'-', b'-', 0)
    sectors = struct.pack('<hh8s8shhh', 0, 128, flat.encode(), b'CEILING', 160, 0, 0)
    return [(label, b'')] + [(n, sides if n == 'SIDEDEFS' else sectors if n == 'SECTORS'
                              else marker) for n in lazy.MAP_LUMPS]


def rules():
    return {
        'anims.ddf': {'WATER': {'TYPE': 'FLAT', 'FIRST': 'WATER1', 'LAST': 'WATER3'},
                      'FIRE': {'TYPE': 'TEXTURE', 'FIRST': 'FIRE1', 'LAST': 'FIRE3'}},
        'switch.ddf': {'SWITCH': {'ON_TEXTURE': 'SW1TEST', 'OFF_TEXTURE': 'SW2TEST'},
                       'CHAIN': {'ON_TEXTURE': 'SW2TEST', 'OFF_TEXTURE': 'FIRE1'}},
        'levels.ddf': {'E1M1': {'SKY_TEXTURE': 'SKY1', 'SURROUND_FLAT': 'SURROUND'},
                       'E1M2': {'SKY_TEXTURE': 'SKY2', 'SURROUND_FLAT': 'SURROUND'}},
    }


def fixture_wad():
    return wad([('GLOBAL', b'common sprites and sounds'),
                ('TEXTURE1', texture_table(['FIRE1', 'UNUSUAL', 'FIRE3'])),
                ('F_START', b''), ('WATER1', b'a'), ('WATER2', b'b'),
                ('WATER3', b'c'), ('F_END', b'')]
               + map_lumps('E1M1', 'SW1TEST', 'WATER1', b'FIRST-MAP-GEOMETRY')
               + map_lumps('E1M2', 'SECONDW', 'SECONDF', b'SECOND-MAP-GEOMETRY'))


def png(color=2, transparency=False):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    result = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, color, 0, 0, 0))
    if transparency:
        result += chunk(b'tRNS', bytes(6))
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    return result + chunk(b'IDAT', zlib.compress(bytes(1 + channels))) + chunk(b'IEND', b'')


class LazyContentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.publisher = lazy.Publisher(self.root, 32)

    def tearDown(self):
        self.temp.cleanup()

    def read_asset(self, asset):
        result = bytearray()
        for part in asset['parts']:
            data = (self.root / part['file']).read_bytes()
            self.assertEqual(part['offset'], len(result))
            self.assertEqual(part['bytes'], len(data))
            self.assertEqual(part['sha256'], lazy.sha(data))
            self.assertLessEqual(len(data), lazy.PART_BYTES)
            result.extend(data)
        self.assertEqual(len(result), asset['bytes'])
        self.assertEqual(lazy.sha(result), asset['sha256'])
        return bytes(result)

    def reconstruct(self, ranges, length):
        result = bytearray(length)
        previous = 0
        for entry in sorted(ranges, key=lambda x: x['offset']):
            self.assertEqual(entry['offset'], previous)
            data = self.read_asset(entry['asset'])
            result[previous:previous + len(data)] = data
            previous += len(data)
        self.assertEqual(previous, length)
        return bytes(result)

    def test_chunk_roundtrip_dedup_and_corruption_rejection(self):
        data = bytes(range(120))
        first = self.publisher.asset(data)
        count = len(list((self.root / 'content').iterdir()))
        self.assertEqual(first, self.publisher.asset(data))
        self.assertEqual(count, len(list((self.root / 'content').iterdir())))
        self.assertEqual(self.read_asset(first), data)
        (self.root / first['parts'][0]['file']).write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError, 'Corrupt immutable'):
            self.publisher.asset(data)

    def test_wad_exact_reconstruction_and_no_other_map_in_bootstrap(self):
        original = fixture_wad()
        manifest = lazy.build_wad(original, self.publisher, rules(), {'WATER1', 'SECONDW'})
        ranges = manifest['bootstrap'] + [r for m in manifest['maps'].values() for r in m['ranges']]
        self.assertEqual(self.reconstruct(ranges, len(original)), original)
        self.assertEqual(manifest['sha256'], lazy.sha(original))
        bootstrap = b''.join(self.read_asset(r['asset']) for r in manifest['bootstrap'])
        first = b''.join(self.read_asset(r['asset']) for r in manifest['maps']['E1M1']['ranges'])
        self.assertNotIn(b'FIRST-MAP-GEOMETRY', bootstrap)
        self.assertNotIn(b'SECOND-MAP-GEOMETRY', bootstrap + first)
        self.assertEqual(manifest['maps']['E1M1']['hdAssets'], ['WATER1'])
        self.assertEqual(manifest['maps']['E1M2']['hdAssets'], ['SECONDW'])
        self.assertEqual(manifest, lazy.build_wad(original, self.publisher, rules(), {'WATER1', 'SECONDW'}))

    def test_transitive_closure_includes_switch_animation_sky_and_surround(self):
        result = lazy.build_wad(fixture_wad(), self.publisher, rules(), set())
        first = set(result['maps']['E1M1']['materials'])
        self.assertTrue({'SW1TEST', 'SW2TEST', 'FIRE1', 'UNUSUAL', 'FIRE3',
                         'WATER1', 'WATER2', 'WATER3', 'SKY1', 'SURROUND'} <= first)
        self.assertNotIn('SKY2', first)
        self.assertNotIn('SECONDW', first)

    def test_native_switch_precache_pair_without_ddf_definition(self):
        data = wad([('TEXTURE1', texture_table(['SW1TSTON', 'SW2TSTON']))]
                   + map_lumps('E1M1', 'SW1TSTON', 'CEILING', b'geom'))
        definitions = rules()
        definitions['anims.ddf'] = {}
        definitions['switch.ddf'] = {}
        result = lazy.build_wad(data, self.publisher, definitions, {'SW1TSTON', 'SW2TSTON'})
        self.assertEqual(result['maps']['E1M1']['hdAssets'], ['SW1TSTON', 'SW2TSTON'])

    def test_unsupported_dependency_rules_and_map_layout_fail_closed(self):
        data = wad([('ANIMATED', b'unknown')] + map_lumps('E1M1', 'X', 'Y', b'geom'))
        with self.assertRaisesRegex(ValueError, 'Unmodelled'):
            lazy.build_wad(data, self.publisher, rules(), set())
        data = wad([('E1M1', b''), ('TEXTMAP', b'udmf')])
        with self.assertRaises(ValueError):
            lazy.build_wad(data, self.publisher, rules(), set())

    def test_finale_and_intermission_belong_to_current_map_not_next_map(self):
        definitions = rules()
        definitions['levels.ddf']['E1M1'].update(lazy.ddf_sections('''
            [CURRENT]
            PRE.TEXT_FLAT="PREBG";
            END.TEXT_FLAT="ENDBG";
            EPISODE=TEST_EPISODE;
            NEXT_MAP=E1M2;
        ''')['CURRENT'])
        definitions['levels.ddf']['E1M2']['PRE.TEXT_FLAT'] = 'NEXTBG'
        definitions['games.ddf'] = {'TEST_EPISODE': {'INTERMISSION_GRAPHIC': 'INTERBG'}}
        definitions['styles.ddf'] = {'STATS': {'BACKGROUND.IMAGE': 'STYLEBG'}}
        ids = {'PREBG', 'ENDBG', 'INTERBG', 'STYLEBG', 'NEXTBG'}
        result = lazy.build_wad(fixture_wad(), self.publisher, definitions, ids)
        self.assertEqual(result['maps']['E1M1']['hdAssets'], ['ENDBG', 'INTERBG', 'PREBG', 'STYLEBG'])
        self.assertIn('NEXTBG', result['maps']['E1M2']['hdAssets'])

    def test_overlapping_lumps_rejected(self):
        original = bytearray(fixture_wad())
        _, directory = struct.unpack_from('<ii', original, 4)
        first_offset, _ = struct.unpack_from('<ii', original, directory)
        struct.pack_into('<i', original, directory + 16, first_offset)
        with self.assertRaisesRegex(ValueError, 'Overlapping'):
            lazy.build_wad(bytes(original), self.publisher, rules(), set())

    def test_png_channel_metadata_matches_decoded_transparency(self):
        for color, transparent, expected in ((0, False, 1), (0, True, 2), (2, False, 3),
                                             (2, True, 4), (3, False, 3), (3, True, 4),
                                             (4, False, 2), (6, False, 4)):
            self.assertEqual(lazy.png_info(png(color, transparent)), (1, 1, expected))

    def make_hd(self, image_hash=None):
        image = png()
        entry = dict(path='hires/TEST.png', width=1, height=1, logicalWidth=1, logicalHeight=1,
                     bytes=len(image), sha256=image_hash or lazy.sha(image))
        path = self.root / 'source.epk'
        with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_STORED) as archive:
            archive.writestr('hires/TEST.png', image)
            archive.writestr('manifest.json', json.dumps({'assets': [entry]}))
            archive.writestr('licenses/COPYING.txt', 'original notices')
        data = path.read_bytes()
        return path, dict(sha256=lazy.sha(data), bytes=len(data), assetCount=1), image

    def test_epk_and_png_reconstruct_byte_identical_and_preserve_notices(self):
        path, expected, image = self.make_hd()
        manifest = lazy.build_hd(path, self.publisher, expected)
        self.assertEqual(self.read_asset(manifest['assets']['TEST']), image)
        self.assertEqual(manifest['assets']['TEST']['channels'], 3)
        self.assertEqual(self.reconstruct(manifest['archiveRanges'], expected['bytes']), path.read_bytes())
        self.assertEqual(self.read_asset(manifest['metadataEntries']['licenses/COPYING.txt']), b'original notices')
        self.assertEqual(manifest, lazy.build_hd(path, self.publisher, expected))

    def test_hd_checks_archive_pin_and_per_image_metadata(self):
        path, expected, _ = self.make_hd()
        with self.assertRaisesRegex(ValueError, 'Pinned HD'):
            lazy.build_hd(path, self.publisher, dict(expected, sha256='0' * 64))
        path, expected, _ = self.make_hd('0' * 64)
        with self.assertRaisesRegex(ValueError, 'image metadata'):
            lazy.build_hd(path, self.publisher, expected)


if __name__ == '__main__':
    unittest.main()
