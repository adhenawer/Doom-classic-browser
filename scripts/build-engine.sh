#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/prepare-engine.py
emcmake cmake -S build/engine -B build/wasm -DCMAKE_BUILD_TYPE=Release \
  -DENABLE_SDL2_NET=OFF -DENABLE_SDL2_MIXER=ON \
  -DCMAKE_DISABLE_FIND_PACKAGE_PNG=TRUE -DCMAKE_DISABLE_FIND_PACKAGE_SampleRate=TRUE \
  -DCMAKE_DISABLE_FIND_PACKAGE_FluidSynth=TRUE \
  '-DCMAKE_C_FLAGS=-sUSE_SDL=2 -sUSE_SDL_MIXER=2 -sSDL2_MIXER_FORMATS=[]'
cmake --build build/wasm --target chocolate-doom -j 4
mkdir -p web/generated
cp build/wasm/src/chocolate-doom.js web/generated/doom.js
cp build/wasm/src/chocolate-doom.wasm web/generated/chocolate-doom.wasm

# High resolution is a separate, explicitly selected backend. Never load both.
python3 scripts/fetch-engine-sources.py
python3 scripts/prepare-engine.py --high
emcmake cmake -S build/engine-high -B build/wasm-high -DCMAKE_BUILD_TYPE=Release \
  -DENABLE_SDL2_NET=OFF -DENABLE_SDL2_MIXER=ON -DCRISPY_TRUECOLOR=OFF \
  -DCMAKE_EXE_LINKER_FLAGS=-sEMULATE_FUNCTION_POINTER_CASTS=1 \
  -DCMAKE_DISABLE_FIND_PACKAGE_PNG=TRUE -DCMAKE_DISABLE_FIND_PACKAGE_SampleRate=TRUE \
  -DCMAKE_DISABLE_FIND_PACKAGE_FluidSynth=TRUE \
  '-DCMAKE_C_FLAGS=-DWEB_HIRES_ENGINE=1 -sUSE_SDL=2 -sUSE_SDL_MIXER=2 -sSDL2_MIXER_FORMATS=[]'
cmake --build build/wasm-high --target crispy-doom -j 4
cp build/wasm-high/src/crispy-doom.js web/generated/doom-high.js
cp build/wasm-high/src/crispy-doom.wasm web/generated/crispy-doom.wasm
