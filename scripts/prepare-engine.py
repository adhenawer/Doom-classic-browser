#!/usr/bin/env python3
"""Make deterministic browser changes to a copy of the pinned upstream tree."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parent.parent
target = root / 'build/engine'
if target.exists(): shutil.rmtree(target)
shutil.copytree(root / 'engine/upstream', target)
def replace(path, old, new):
    p = target / path
    s = p.read_text()
    if s.count(old) != 1: raise RuntimeError(f'Patch context changed: {path}: {old[:60]}')
    p.write_text(s.replace(old, new))
replace('src/doom/g_game.c', '#include "doomdef.h"', '#include "doomdef.h"\n#include "turn.h"\n#include <emscripten.h>\n#include "d_ticcmd.h"\nextern int web_suspended;\nstatic void web_apply(ticcmd_t *cmd);')
p = target / 'src/doom/g_game.c'
p.write_text(p.read_text() + '\n#include "bridge.c"\nstatic void web_apply(ticcmd_t *cmd) {\n'
    ' if (menuactive || web_suspended || paused) { web_turn_reset(&web_turn); return; }\n'
    ' cmd->angleturn += web_turn_tick(&web_turn, web_left, web_right);\n'
    ' web_last_forward = cmd->forwardmove; web_last_side = cmd->sidemove;\n'
    ' web_last_angle = cmd->angleturn; web_last_buttons = cmd->buttons;\n}\n')
replace('src/doom/g_game.c', '    // low-res turning', '    web_apply(cmd);\n\n    // low-res turning')
replace('src/doom/g_game.c', '    M_rename(temp_savegame_file, savegame_file);',
    '    M_rename(temp_savegame_file, savegame_file);\n    EM_ASM({ Module["onSaveWritten"]?.(); });')
for name in ['bridge.c', 'turn.h', 'turn.c']:
    shutil.copy(root / 'engine' / name, target / 'src/doom' / name)
with (target / 'src/doom/CMakeLists.txt').open('a') as f:
    f.write('\ntarget_sources(doom PRIVATE turn.c)\n')
replace('src/doom/d_main.c', 'void D_RunFrame()\n{',
    'extern int web_suspended;\nvoid D_RunFrame()\n{\n    if (web_suspended) return;')
replace('src/doom/d_main.c', '        D_RunFrame();',
    '        D_RunFrame();\n        emscripten_sleep(1);')
replace('src/doom/d_main.c', '#include "doomdef.h"', '#include "doomdef.h"\n#include <emscripten.h>')
replace('src/i_timer.c', '#include "SDL.h"', '''#include "SDL.h"
#include <emscripten.h>
static Uint32 web_offset, web_frozen;
static int web_clock_stopped;
void web_clock_pause(int stop) {
    if (stop && !web_clock_stopped) web_frozen = SDL_GetTicks();
    if (!stop && web_clock_stopped) web_offset += SDL_GetTicks() - web_frozen;
    web_clock_stopped = stop;
}
static Uint32 web_now(void) {
    return (web_clock_stopped ? web_frozen : SDL_GetTicks()) - web_offset;
}''')
p = target / 'src/i_timer.c'
p.write_text(p.read_text().replace('ticks = SDL_GetTicks();', 'ticks = web_now();').replace('SDL_Delay(ms);', 'emscripten_sleep(ms);'))
# DOM input is delivered exclusively through bridge.c. SDL must not duplicate it.
p = target / 'src/i_video.c'
s = p.read_text()
a = s.index('            case SDL_KEYDOWN:')
b = s.index('            case SDL_MOUSEBUTTONDOWN:', a)
p.write_text(s[:a] + '            case SDL_KEYDOWN:\n            case SDL_KEYUP:\n                break;\n\n' + s[b:])
# Disable pointer capture unconditionally in this keyboard-only build.
replace('src/i_video.c', 'static void UpdateGrab(void)\n{', 'static void UpdateGrab(void)\n{\n    return;')
# Upstream exports runtime symbols through EXPORTED_FUNCTIONS; current emcc uses a separate option.
p = target / 'src/CMakeLists.txt'
p.write_text(p.read_text().replace('-s EXPORTED_FUNCTIONS=_main,ccall,cwrap,FS,ENV,PATH,ERRNO_CODES',
    '-s MODULARIZE=1 -s EXPORT_NAME=createDoom -s EXPORTED_FUNCTIONS=_main -s EXPORTED_RUNTIME_METHODS=callMain,FS,ccall -s FORCE_FILESYSTEM=1 -lidbfs.js -s ENVIRONMENT=web -s SDL2_MIXER_FORMATS=[] -s MAXIMUM_MEMORY=268435456 -s INITIAL_MEMORY=33554432'))
print('Prepared pinned Chocolate Doom browser build')
