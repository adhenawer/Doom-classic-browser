#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -x build/modern-tools/cmake/data/bin/cmake ]; then
  python3 -m pip install --disable-pip-version-check --target build/modern-tools cmake==3.31.6
fi
export PATH="$PWD/build/modern-tools/cmake/data/bin:$PATH"
python3 scripts/fetch-modern-engine.py
python3 scripts/prepare-modern-engine.py
emcmake cmake -S build/engine-modern -B build/wasm-modern -DCMAKE_BUILD_TYPE=Release \
  -DEDGE_LEGACY_GL=OFF -DEDGE_SOKOL_GLES3=ON -DEDGE_WEB_MULTITHREADED=OFF -DEDGE_WEB_SIMD=OFF
cmake --build build/wasm-modern --target edge-classic -j 6
mkdir -p web/generated
cp build/wasm-modern/source_files/edge/doom-modern.js web/generated/doom-modern.js
cp build/wasm-modern/source_files/edge/doom-modern.wasm web/generated/edge.wasm
cp build/wasm-modern/source_files/edge/doom-modern.data web/generated/doom-modern.data
# Preserve canonical module name while presenting a stable backend-specific artifact.
python3 - <<'PY'
from pathlib import Path
p=Path('web/generated/doom-modern.js')
s=p.read_text().replace('doom-modern.wasm','edge.wasm')
p.write_text(s)
PY
