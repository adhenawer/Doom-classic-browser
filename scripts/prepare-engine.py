#!/usr/bin/env python3
"""Make deterministic browser changes to a copy of the pinned upstream tree."""
from pathlib import Path
import shutil, sys
root = Path(__file__).resolve().parent.parent
high = '--high' in sys.argv
target = root / ('build/engine-high' if high else 'build/engine')
if target.exists(): shutil.rmtree(target)
shutil.copytree(root / ('build/crispy-upstream' if high else 'engine/upstream'), target)
def replace(path, old, new):
    p = target / path
    s = p.read_text()
    if s.count(old) != 1: raise RuntimeError(f'Patch context changed: {path}: {old[:60]}')
    p.write_text(s.replace(old, new))
# DOM keydown/keyup pairs can arrive as one burst between the 35 Hz tics.
# The upstream 64-slot ring aliases full with empty after exactly 64 events
# (e.g. clearing a save name, typing CLASSIC and Enter). Keep its FIFO behavior
# but accommodate browser/menu bursts without losing the final key releases.
replace('src/d_event.c', '#define MAXEVENTS 64\n', '#define MAXEVENTS 1024\n')
replace('src/doom/g_game.c', '#include "doomdef.h"', '#include "doomdef.h"\n#include "turn.h"\n#include <emscripten.h>\n#include "d_ticcmd.h"\nextern int web_suspended;\nstatic void web_apply(ticcmd_t *cmd);')
replace('src/doom/g_game.c', 'void G_DoLoadLevel (void) \n{ \n    int             i;',
    'extern void web_prepare_map(int episode, int map);\nvoid G_DoLoadLevel (void) \n{ \n    int             i;\n    web_prepare_map(gameepisode, gamemap);')
# The host fills sparse map ranges after the file is already open. Do not keep
# stdio read-ahead copies of their previous zero-filled contents.
replace('src/w_file_stdc.c', '    // Create a new stdc_wad_file_t to hold the file handle.',
    '    setvbuf(fstream, NULL, _IONBF, 0);\n\n    // Create a new stdc_wad_file_t to hold the file handle.')
p = target / 'src/doom/g_game.c'
p.write_text(p.read_text() + '\n#include "bridge.c"\nstatic void web_apply(ticcmd_t *cmd) {\n'
    ' if (menuactive || web_suspended || paused) { web_turn_reset(&web_turn); return; }\n'
    ' cmd->angleturn += web_turn_tick(&web_turn, web_left, web_right);\n'
    ' web_last_forward = cmd->forwardmove; web_last_side = cmd->sidemove;\n'
    ' web_last_angle = cmd->angleturn; web_last_buttons = cmd->buttons;\n}\n')
replace('src/doom/g_game.c', '    // low-res turning', '    web_apply(cmd);\n\n    // low-res turning')
replace('src/doom/g_game.c', '    M_rename(temp_savegame_file, savegame_file);',
    '    M_rename(temp_savegame_file, savegame_file);\n    EM_ASM({ Module["onSaveWritten"]?.(); });')
# Browser back navigation also closes the root menu (DOS only backed out of submenus).
replace('src/doom/m_menu.c',
    '    else if (key == key_menu_back)\n    {\n        // Go back to previous menu',
    '    else if (key == key_menu_back)\n    {\n        if (!currentMenu->prevMenu) { M_ClearMenus(); return true; }\n        // Go back to previous menu')
for name in ['bridge.c', 'turn.h', 'turn.c', 'map-delivery.h']:
    shutil.copy(root / 'engine' / name, target / 'src/doom' / name)
with (target / 'src/doom/CMakeLists.txt').open('a') as f:
    f.write('\ntarget_sources(doom PRIVATE turn.c)\n')
replace('src/doom/d_main.c', 'void D_RunFrame()\n{',
    'extern int web_suspended;\nvoid D_RunFrame()\n{\n    if (web_suspended) return;')
replace('src/doom/d_main.c', '        D_RunFrame();',
    '''        D_RunFrame();
        EM_ASM({
            const name = Module['mapReadyName'];
            if (name) { delete Module['mapReadyName']; Module['onMapReady']?.(name); }
        });
        emscripten_sleep(1);''')
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
# The OPL emulation attenuates at volume zero but retains a small analog-like
# residual. Gate only its contribution; still generate and advance music time.
# This web build selects the SDL OPL backend, with no hardware OPL drivers.
replace('opl/opl_sdl.c', 'static uint8_t *mix_buffer = NULL;',
    'static uint8_t *mix_buffer = NULL;\nint web_opl_music_muted = 0;')
replace('src/i_oplmusic.c', 'static int current_music_volume;',
    'static int current_music_volume;\nextern int web_opl_music_muted;')
replace('src/i_oplmusic.c', 'static void I_OPL_SetMusicVolume(int volume)\n{\n    unsigned int i;',
    'static void I_OPL_SetMusicVolume(int volume)\n{\n    unsigned int i;\n    web_opl_music_muted = volume == 0;')
replace('opl/opl_sdl.c', '    SDL_MixAudioFormat(buffer, mix_buffer, AUDIO_S16SYS, nsamples * 4,\n                       SDL_MIX_MAXVOLUME);',
    '    if (!web_opl_music_muted)\n        SDL_MixAudioFormat(buffer, mix_buffer, AUDIO_S16SYS, nsamples * 4,\n                           SDL_MIX_MAXVOLUME);')
# Present the optional post-process synchronously before WebGL discards its buffer.
replace('src/i_video.c', '#include "SDL.h"', '#include "SDL.h"\n#include <emscripten.h>')
replace('src/i_video.c', '    // Draw!\n\n    SDL_RenderPresent(renderer);',
    '    // Draw!\n\n    SDL_RenderPresent(renderer);\n    EM_ASM({ Module["onFrame"]?.(); });')
# Disable pointer capture unconditionally in this keyboard-only build.
replace('src/i_video.c', 'static void UpdateGrab(void)\n{', 'static void UpdateGrab(void)\n{\n    return;')
# Upstream exports runtime symbols through EXPORTED_FUNCTIONS; current emcc uses a separate option.
p = target / 'src/CMakeLists.txt'
p.write_text(p.read_text().replace('-s EXPORTED_FUNCTIONS=_main,ccall,cwrap,FS,ENV,PATH,ERRNO_CODES',
    f'-s MODULARIZE=1 -s EXPORT_NAME={"createDoomHigh" if high else "createDoom"} -s EXPORTED_FUNCTIONS=_main -s EXPORTED_RUNTIME_METHODS=callMain,FS,ccall -s FORCE_FILESYSTEM=1 -lidbfs.js -s ENVIRONMENT=web -s SDL2_MIXER_FORMATS=[] -s MAXIMUM_MEMORY=268435456 -s INITIAL_MEMORY=33554432'))
if high:
    # Expose six vanilla slots, one page, without new gameplay toggle menus.
    replace('src/doom/m_menu.c', 'static const int savepage_max = 7;', 'static const int savepage_max = 0;')
    replace('src/doom/m_menu.c', '    load7, // [crispy] up to 8 savegames\n    load8, // [crispy] up to 8 savegames\n', '')
    for action in ['M_LoadSelect', 'M_SaveSelect']:
        replace('src/doom/m_menu.c', f'    {{1,"", {action},\'7\'}}, // [crispy] up to 8 savegames\n    {{1,"", {action},\'8\'}}  // [crispy] up to 8 savegames\n', '')
    replace('src/doom/m_menu.c', '    {1,"M_CRISPY",\tM_CrispnessCur,\'c\', "Crispness"} // [crispy] Crispness menu',
        '    {-1,"",NULL,\'\\0\',NULL} // Browser owns renderer configuration.')
    replace('src/doom/m_menu.c', '    detailLevel = 1 - detailLevel;', '    detailLevel = 0;')
print('Prepared pinned', 'Crispy 640x400' if high else 'Chocolate Classic', 'browser build')
