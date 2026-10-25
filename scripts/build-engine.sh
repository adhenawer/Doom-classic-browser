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
