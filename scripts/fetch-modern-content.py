#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Verify and repack HD opaque materials for EDGE's HIRES namespace.

No image generation/transformation occurs here. Original source PNG bytes are
selected only after matching the pinned IWAD's names, dimensions and opacity.
Two explicitly pinned Poly Haven 4K albedos replace named opaque materials;
all other images come from the pinned 4x Freedoom reconstruction. The upstream
pack's magenta-backed sprites and masked textures are excluded.
"""
from __future__ import annotations

from collections import Counter
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import struct
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
META = json.loads((ROOT / "engine/MODERN-CONTENT.json").read_text())
CACHE = ROOT / "build/modern-content"
OUTPUT = ROOT / "web/generated"
PNG = b"\x89PNG\r\n\x1a\n"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def checked_file(path: Path, spec: dict) -> bool:
    if not path.is_file() or path.stat().st_size != spec["bytes"]:
        return False
    return file_sha256(path) == spec["sha256"]


def download(spec: dict, url: str, dest: Path) -> bytes | None:
    """Stream to a temporary file, validate before replacing any existing file."""
    if not checked_file(dest, spec):
        temporary = dest.with_name(dest.name + ".part")
        digest = hashlib.sha256()
        length = 0
        print(f"Downloading pinned content: {dest.name}", flush=True)
        with urllib.request.urlopen(url, timeout=180) as response, temporary.open("wb") as out:
            while block := response.read(1024 * 1024):
                length += len(block)
                if length > spec["bytes"]:
                    raise ValueError(f"Unexpected download size for {dest.name}")
                digest.update(block)
                out.write(block)
        if length != spec["bytes"] or digest.hexdigest() != spec["sha256"]:
            raise ValueError(f"Pinned content verification failed: {dest.name}")
        temporary.replace(dest)
    return dest.read_bytes() if spec["bytes"] < 1024 * 1024 else None


def wad_lumps(data: bytes) -> tuple[dict[str, bytes], list[tuple[str, bytes]]]:
    count, directory = struct.unpack_from("<ii", data, 4)
    ordered = []
    for index in range(count):
        at = directory + index * 16
        position, length = struct.unpack_from("<ii", data, at)
        name = data[at + 8:at + 16].rstrip(b"\0").decode("ascii")
        ordered.append((name, data[position:position + length]))
    return dict(ordered), ordered


def opaque_texture(texture: bytes, at: int, width: int, height: int,
                   lumps: dict[str, bytes], pnames: list[str]) -> bool:
    """Inspect vanilla patch coverage without resampling or rewriting an image."""
    coverage = bytearray(width * height)
    patches = struct.unpack_from("<h", texture, at + 20)[0]
    for patch_index in range(patches):
        left, top, name_index = struct.unpack_from("<hhh", texture, at + 22 + patch_index * 10)
        patch = lumps[pnames[name_index]]
        patch_width = struct.unpack_from("<h", patch)[0]
        for column in range(patch_width):
            x = column + left
            if not 0 <= x < width:
                continue
            position = struct.unpack_from("<i", patch, 8 + column * 4)[0]
            previous_top = -1
            while patch[position] != 255:
                delta, length = patch[position:position + 2]
                if delta <= previous_top:  # tall-patch continuation semantics
                    delta += previous_top
                previous_top = delta
                for y in range(max(0, delta + top), min(height, delta + top + length)):
                    coverage[y * width + x] = 1
                position += length + 4
    return 0 not in coverage


def materials(data: bytes) -> tuple[dict[str, tuple[str, int, int]], list[str]]:
    lumps, ordered = wad_lumps(data)
    names = lumps["PNAMES"]
    pnames = [names[4 + i * 8:12 + i * 8].rstrip(b"\0").decode("ascii")
              for i in range(struct.unpack_from("<i", names)[0])]
    targets = {}
    masked = []
    for key in ("TEXTURE1", "TEXTURE2"):
        if key not in lumps:
            continue
        texture = lumps[key]
        for i in range(struct.unpack_from("<i", texture)[0]):
            at = struct.unpack_from("<i", texture, 4 + i * 4)[0]
            name = texture[at:at + 8].rstrip(b"\0").decode("ascii")
            width, height = struct.unpack_from("<hh", texture, at + 12)
            if opaque_texture(texture, at, width, height, lumps, pnames):
                targets.setdefault(name, ("texture", width, height))
            else:
                masked.append(name)
    flat = False
    for name, lump in ordered:
        if name in ("F_START", "FF_START"):
            flat = True
            continue
        if name in ("F_END", "FF_END"):
            flat = False
            continue
        # EDGE resolves HIRES textures before flats: preserve that precedence.
        if flat and len(lump) == 4096 and name not in masked:
            targets.setdefault(name, ("flat", 64, 64))
    return targets, sorted(masked)


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode()


def write_entry(out: zipfile.ZipFile, name: str, data: bytes) -> None:
    entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    entry.create_system = 3
    entry.external_attr = 0o100644 << 16
    entry.compress_type = zipfile.ZIP_STORED
    out.writestr(entry, data)


def write_delivery(bundle: Path) -> dict:
    """Publish bounded, hash-pinned transport responses without changing bytes."""
    delivery = META["delivery"]
    part_bytes = delivery["partBytes"]
    parts = delivery["parts"]
    if part_bytes != 33554432 or not parts:
        raise ValueError("Unexpected delivery partition policy")
    pending = CACHE / "delivery"
    pending.mkdir(exist_ok=True)
    complete = hashlib.sha256()
    offset = 0
    staged = []
    with bundle.open("rb") as stream:
        for index, spec in enumerate(parts):
            name = f"modern-hd.{index:03}.bin"
            expected_length = min(part_bytes, META["output"]["bytes"] - offset)
            if (spec["file"] != name or spec["offset"] != offset
                    or spec["bytes"] != expected_length or expected_length <= 0):
                raise ValueError(f"Invalid delivery partition metadata: {name}")
            temporary = pending / (name + ".part")
            digest = hashlib.sha256()
            remaining = expected_length
            with temporary.open("wb") as out:
                while remaining:
                    block = stream.read(min(1024 * 1024, remaining))
                    if not block:
                        raise ValueError(f"Unexpected end of material bundle: {name}")
                    out.write(block)
                    digest.update(block)
                    complete.update(block)
                    remaining -= len(block)
            if digest.hexdigest() != spec["sha256"]:
                raise ValueError(f"Delivery partition checksum differs: {name}")
            staged.append((temporary, OUTPUT / name))
            offset += expected_length
        if stream.read(1) or offset != META["output"]["bytes"]:
            raise ValueError("Delivery partitions do not cover the complete material bundle")
    if complete.hexdigest() != META["output"]["sha256"]:
        raise ValueError("Concatenated delivery checksum differs from the full bundle")
    # All parts and their concatenation are validated before promotion.
    for temporary, final in staged:
        temporary.replace(final)
    return delivery


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    iwad = OUTPUT / META["iwad"]["file"]
    if not checked_file(iwad, META["iwad"]):
        raise ValueError("Run scripts/fetch-content.py first: pinned Freedoom Phase 1 required")
    source = META["source"]
    archive = CACHE / source["file"]
    download(source, source["url"], archive)
    raw_base = f'https://raw.githubusercontent.com/m4cd4r4/freedoom-hd/{source["revision"]}/'
    notices = {}
    for spec in META["notices"]:
        notices[spec["file"]] = download(spec, raw_base + spec["file"], CACHE / spec["file"])
    for spec in META["freedoomNotices"]:
        if not checked_file(OUTPUT / spec["file"], spec):
            raise ValueError(f'Freedoom license/credits verification failed: {spec["file"]}')
    targets, masked = materials(iwad.read_bytes())
    overrides = META.get("materialOverrides", [])
    for spec in overrides:
        if targets.get(spec["target"]) != (spec["kind"], spec["logicalWidth"], spec["logicalHeight"]):
            raise ValueError(f'Override is not an eligible opaque IWAD material: {spec["target"]}')
        download(spec, spec["url"], CACHE / spec["file"])
    selected = {}
    dimension_mismatches = []
    with zipfile.ZipFile(archive) as incoming:
        for item in incoming.infolist():
            # The known input contains GAMEINFO and duplicate names; only this
            # exact image namespace is eligible. No files are extracted to disk.
            match = re.fullmatch(r"hires/([A-Za-z0-9_\-\[\]^]{1,8})\.png", item.filename)
            if not match:
                continue
            name = match[1].replace("^", "\\").upper()
            if name not in targets:
                continue
            kind, logical_width, logical_height = targets[name]
            image = incoming.read(item)  # zipfile verifies each CRC
            if image[:8] != PNG or image[12:16] != b"IHDR":
                raise ValueError(f"PNG header invalid: {item.filename}")
            width, height = struct.unpack_from(">II", image, 16)
            if (width, height) != (logical_width * 4, logical_height * 4):
                dimension_mismatches.append(name)
                continue
            if name in selected:
                raise ValueError(f"Ambiguous eligible source image: {name}")
            selected[name] = {
                "source": item,
                "path": "hires/" + PurePosixPath(item.filename).name.upper().replace(".PNG", ".png"),
                "kind": kind,
                "width": width,
                "height": height,
                "logicalWidth": logical_width,
                "logicalHeight": logical_height,
                "bytes": len(image),
                "sha256": hashlib.sha256(image).hexdigest(),
                "origin": "Freedoom-HD"
            }
        for spec in overrides:
            if spec["target"] not in selected:
                raise ValueError(f'Override original was not selected: {spec["target"]}')
            image = (CACHE / spec["file"]).read_bytes()
            if image[:8] != PNG or image[12:16] != b"IHDR" or struct.unpack_from(">II", image, 16) != (spec["width"], spec["height"]):
                raise ValueError(f'Override PNG dimensions/signature invalid: {spec["file"]}')
            selected[spec["target"]] = {
                "override": spec["file"],
                "path": f'hires/{spec["target"]}.png', "kind": spec["kind"],
                "width": spec["width"], "height": spec["height"],
                "logicalWidth": spec["logicalWidth"], "logicalHeight": spec["logicalHeight"],
                "bytes": spec["bytes"], "sha256": spec["sha256"],
                "origin": "Poly Haven", "asset": spec["asset"], "author": spec["author"],
                "license": spec["license"], "sourceURL": spec["url"], "channel": spec["channel"]
            }
        if len(selected) != META["output"]["assetCount"]:
            raise ValueError(f"Unexpected selected asset count: {len(selected)}")
        counts = dict(Counter(asset["kind"] for asset in selected.values()))
        manifest = {
            "id": META["id"], "version": META["version"], "iwad": META["iwad"],
            "source": source, "upscaleFactor": 4, "counts": counts,
            "materialOverrides": overrides,
            "policy": META["selection"],
            "excludedMaskedTextures": masked,
            "dimensionMismatches": sorted(set(dimension_mismatches)),
            "assets": [{k: v for k, v in selected[name].items() if k not in ("source", "override")}
                       for name in sorted(selected)]
        }
        copying = ("DOOM Classic Browser — Freedoom Phase 1 HD materials\n\n"
                   "Source: https://github.com/m4cd4r4/freedoom-hd/releases/tag/v1.0\n"
                   "Reconstruction by Macdara O'Murchu's Freedoom-HD project.\n"
                   "1113 image assets retain the Freedoom BSD-3-Clause license below.\n"
                   "Two 4096x4096 albedos (BASE2 and FLAT1) are Poly Haven CC0 assets.\n"
                   "Selected PNG bytes are unchanged. No commercial DOOM assets included.\n"
                   "Sprites, HUD and masked materials use the original IWAD images.\n\n").encode()
        poly_credits = ("Poly Haven CC0 material credits\n\n"
                        "Assets are CC0-1.0 as identified by Poly Haven.\n"
                        "Library license: https://polyhaven.com/license\n"
                        "CC0: https://creativecommons.org/publicdomain/zero/1.0/\n"
                        "Original downloaded PNG bytes are preserved.\n"
                        "Only albedo is used; no PBR/normal/roughness rendering is implied.\n\n")
        for spec in overrides:
            poly_credits += (f'{spec["target"]}: {spec["title"]}, {spec["author"]}\n'
                             f'Asset: {spec["page"]}\nSource: {spec["url"]}\n'
                             f'SHA256: {spec["sha256"]}\n'
                             f'Dimensions: {spec["width"]}x{spec["height"]}; '
                             f'logical tile: {spec["logicalWidth"]}x{spec["logicalHeight"]}\n\n')
        copying += poly_credits.encode() + b"\n\nFreedoom license:\n\n"
        copying += (OUTPUT / "FREEDOOM-COPYING.txt").read_bytes()
        copying += b"\n\nUpstream pipeline license (not the image asset license):\n\n" + notices["LICENSE"]
        temporary = CACHE / (META["output"]["file"] + ".part")
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_STORED) as out:
            for name in sorted(selected):
                asset = selected[name]
                image = ((CACHE / asset["override"]).read_bytes() if "override" in asset
                         else incoming.read(asset["source"]))
                write_entry(out, asset["path"], image)
            write_entry(out, "licenses/COPYING.txt", copying)
            write_entry(out, "licenses/FREEDOOM-CREDITS.txt", (OUTPUT / "FREEDOOM-CREDITS.txt").read_bytes())
            write_entry(out, "licenses/FREEDOOM-HD-README.md", notices["README.md"])
            write_entry(out, "licenses/POLY-HAVEN-CREDITS.txt", poly_credits.encode())
            write_entry(out, "manifest.json", json_bytes(manifest))
    final = CACHE / META["output"]["file"]
    digest = file_sha256(temporary)
    length = temporary.stat().st_size
    if "sha256" in META["output"] and (digest != META["output"]["sha256"] or length != META["output"]["bytes"]):
        raise ValueError("Repacked material bundle differs from pinned output")
    temporary.replace(final)
    delivery = write_delivery(final)
    # Preserve a previous monolithic generated file as build-cache evidence;
    # it must not be included alongside the parts in the published runtime.
    legacy = OUTPUT / META["output"]["file"]
    if legacy.exists():
        legacy.replace(CACHE / ("legacy-" + META["output"]["file"]))
    summary = {k: v for k, v in manifest.items() if k != "assets"}
    summary.update({"file": final.name, "bytes": length, "sha256": digest,
                    "delivery": delivery,
                    "assetCount": len(selected),
                    "pixelCount": sum(x["width"] * x["height"] for x in selected.values())})
    (OUTPUT / META["output"]["metadata"]).write_bytes(json_bytes(summary))
    (OUTPUT / META["output"]["copying"]).write_bytes(copying)
    print(f"Verified HD bundle: {len(selected)} assets, {counts}, {length} bytes, SHA256 {digest}")
    print(f"Published delivery: {len(delivery['parts'])} verified parts; full EPK retained in build cache")


if __name__ == "__main__":
    main()
