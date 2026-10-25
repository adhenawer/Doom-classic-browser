#!/usr/bin/env python3
"""Apply the browser contract to a disposable copy of the pinned EDGE tree."""
from pathlib import Path
import shutil, json
root=Path(__file__).resolve().parent.parent
source=root/'build/modern-upstream'; target=root/'build/engine-modern'
if target.exists(): shutil.rmtree(target)
shutil.copytree(source,target)
def replace(path,old,new):
 p=target/path;s=p.read_text()
 if s.count(old)!=1: raise RuntimeError(f'Patch context changed: {path}: {old[:80]}')
 p.write_text(s.replace(old,new))
# Identify the pinned source without embedding the wall-clock compilation time.
# Application name/version remain upstream-owned; no build date is fabricated.
pin=json.loads((root/'engine/EDGE.json').read_text())
replace('source_files/edge/e_main.cc',
 '    LogPrint("%s v%s compiled on " __DATE__ " at " __TIME__ "\\n", application_name.c_str(), edge_version.c_str());',
 f'    LogPrint("%s v%s | upstream {pin["commit"]} | browser WebGL2\\n", application_name.c_str(), edge_version.c_str());')
# Use the upstream one-thread WebGL2 backend, exporting the shared browser ABI.
p=target/'cmake/Emscripten.cmake';s=p.read_text().replace('-sEXPORT_ES6=1','-sEXPORT_ES6=0').replace('createEdgeModule','createDoomModern').replace('-sINITIAL_MEMORY=512Mb','-sINITIAL_MEMORY=512Mb -sMAXIMUM_MEMORY=2147483648').replace('-gsource-map --source-map-base=/','')
s += '\nadd_link_options("SHELL: -sEXPORTED_RUNTIME_METHODS=callMain,FS,ccall -sEXPORTED_FUNCTIONS=_main -sFORCE_FILESYSTEM=1")\n'
p.write_text(s)
# No upstream preloader, unpinned content downloads, or output-copy side effects.
p=target/'source_files/edge/CMakeLists.txt';s=p.read_text();a=s.index('  set (SOURCE_DIR "${CMAKE_SOURCE_DIR}/build/source_files/edge")');b=s.index('\nendif()',a)
s=s[:a]+'  target_link_options(edge-classic PRIVATE "--preload-file=${CMAKE_SOURCE_DIR}/browser-support@/")\n  set_target_properties(edge-classic PROPERTIES OUTPUT_NAME "doom-modern")\n'+s[b:]
s+='\ntarget_sources(edge-classic PRIVATE turn.c)\n'
p.write_text(s)
# Host mounts IDBFS, restores saves, and writes its IWAD before callMain.
p=target/'source_files/edge/i_web.cc';s=p.read_text();a=s.index('        EM_ASM_(\n            {\n                const args = [];');b=s.index('\n        return 0;',a)
s=s[:a]+'        WebMain(argc, const_cast<const char **>(argv));\n'+s[b:]
s=s.replace('    // We always do this once here, although the engine may', '    extern int web_suspended;\n    if (web_suspended) return;\n\n    // We always do this once here, although the engine may')
s=s.replace('        emscripten_set_main_loop(WebTick, 0, 0);', '')
s=s.replace('        EdgeMain(argc, argv);', '        EdgeMain(argc, argv);\n        emscripten_set_main_loop(WebTick, 0, 0);')
# A frame callback before SDL's Asyncify yield does not prove a completed tick.
# Signal only after EdgeTicker (display, input and simulation) has returned.
s=s.replace('    if (app_state & kApplicationActive)\n        EdgeTicker();',
 '''    if (app_state & kApplicationActive) {
        EdgeTicker();
        EM_ASM({ Module["onTickComplete"]?.(); });
    }''')
p.write_text(s)
# Busy-spin is inappropriate on the single browser/UI thread, especially while
# the host has frozen logical time during an Asyncify yield. Preserve 35 Hz,
# but cooperate with browser timers/input while waiting for the next tic.
replace('source_files/edge/n_network.cc',
 'EDGE_DEFINE_CONSOLE_VARIABLE(busy_wait, "1",',
 'EDGE_DEFINE_CONSOLE_VARIABLE(busy_wait, "0",')
# Ignore duplicate SDL keyboard events: DOM owns the input queue.
replace('source_files/edge/i_ctrl.cc','void HandleKeyEvent(SDL_Event *ev)\n{','void HandleKeyEvent(SDL_Event *ev)\n{\n    return; // Browser host dispatches the authoritative physical-key state.\n')
# SDL queues focus events independently from the DOM host. A queued blur can
# arrive only after web_suspend(0), disabling its separate app_state flag forever
# after a synthetic blur or a canvas/shell focus change. The host is the single
# authority for focus, visibility, audio and clock suspension in this web build.
p=target/'source_files/edge/i_ctrl.cc';s=p.read_text();a=s.index('void HandleFocusGain(void)');b=s.index('void HandleKeyEvent(SDL_Event *ev)',a)
s=s[:a]+'void HandleFocusGain(void) {}\n\nvoid HandleFocusLost(void) {}\n\n'+s[b:];p.write_text(s)
# Stop logical time across blur, visibility changes and app switches.
replace('source_files/edge/i_ctrl.cc','int GetTime(void)\n{\n    Uint32 t = SDL_GetTicks();', '''static Uint32 web_clock_offset, web_clock_frozen;
static bool web_clock_stopped;
void web_clock_pause(int value) {
 if(value && !web_clock_stopped) web_clock_frozen=SDL_GetTicks();
 if(!value && web_clock_stopped) web_clock_offset += SDL_GetTicks()-web_clock_frozen;
 web_clock_stopped=!!value;
}
static Uint32 web_now() {return (web_clock_stopped ? web_clock_frozen : SDL_GetTicks())-web_clock_offset;}
int GetTime(void)
{
    Uint32 t = web_now();''')
replace('source_files/edge/i_ctrl.cc','int GetMilliseconds(void)\n{\n    return SDL_GetTicks();','int GetMilliseconds(void)\n{\n    return web_now();')
replace('source_files/edge/i_system.cc','    SDL_Delay(millisecs);','    emscripten_sleep(millisecs);')
replace('source_files/edge/i_system.cc','#include "i_system.h"','#include "i_system.h"\n#include <emscripten.h>')
# DOM gestures resume this particular runtime's AudioContext.
replace('libraries/miniaudio/miniaudio.h','            device.webaudio.suspend();  /* The AudioContext must be created in a suspended state. */','            Module["modernAudioContext"] = device.webaudio;\n            device.webaudio.suspend();  /* The AudioContext must be created in a suspended state. */')
replace('libraries/miniaudio/miniaudio.h','            device.scriptNode = device.webaudio.createScriptProcessor(bufferSize, channelCountIn, channelCountOut);','            device.scriptNode = device.webaudio.createScriptProcessor(bufferSize, channelCountIn, channelCountOut);\n            Module["modernAudioNode"] = device.scriptNode;')
# The host serializes IDBFS writes after completed slot copies; native syncs
# would race the same mount and report success before the full save exists.
p=target/'source_files/epi/epi_filesystem.cc';s=p.read_text();a=s.index('#ifdef EDGE_WEB\nvoid SyncFilesystem(bool populate)');b=s.index('#else\nvoid SyncFilesystem(bool populate)',a)
s=s[:a]+'#ifdef EDGE_WEB\nvoid SyncFilesystem(bool populate) { EPI_UNUSED(populate); }\n'+s[b:];p.write_text(s)
# Existing turn controller runs in the authoritative 35Hz command builder.
p=target/'source_files/edge/e_input.cc';s=p.read_text().replace('#include "e_input.h"','#include "e_input.h"\nstatic void web_apply(EventTicCommand*);')
s=s.replace('    cmd->chat_character = 0;', '    web_apply(cmd);\n    cmd->chat_character = 0;')
s+='\n#include "modern-bridge.cc"\n';p.write_text(s)
for name in ['modern-bridge.cc','turn.h','turn.c']:shutil.copyfile(root/'engine'/name,target/'source_files/edge'/name)
# Expose read-only native save-name entry state and complete-save notification.
p=target/'source_files/edge/m_menu.cc';s=p.read_text();s+='\n#include <emscripten.h>\nextern "C" EMSCRIPTEN_KEEPALIVE int web_text() {return entering_save_string;}\n'
s=s.replace('        if (current_menu->previous_menu)\n        {', '        if (!current_menu->previous_menu) { MenuClear(); return true; }\n        if (current_menu->previous_menu)\n        {')
# One page avoids unbounded save navigation while retaining native eight slots.
s=s.replace('static constexpr uint8_t kTotalSavePages = 100;','static constexpr uint8_t kTotalSavePages = 1;')
p.write_text(s)
replace('source_files/edge/g_game.cc','        SaveCopySlot("current", dir_name);','        SaveCopySlot("current", dir_name);\n        EM_ASM({ Module["onSaveWritten"]?.(); });')
replace('source_files/edge/g_game.cc','#include "g_game.h"','#include "g_game.h"\n#include <emscripten.h>')
# SDL's Emscripten swap yields via emscripten_sleep(0). Capture/present
# after Sokol end-pass/commit but before that yield clears non-preserved GL buffers.
replace('source_files/edge/i_video.cc','    SwapBuffers();','    EM_ASM({ Module["onFrame"]?.(); });\n    SwapBuffers();')
replace('source_files/edge/i_video.cc','#include "i_video.h"','#include "i_video.h"\n#include <emscripten.h>')
replace('source_files/edge/i_video.cc','    int resizeable = SDL_WINDOW_RESIZABLE;', '    int resizeable = 0; // Host selects resolution; CSS resize must not replace the drawing buffer.')
# A web drawing buffer can exceed CSS/desktop dimensions: never clamp Retina quality to CSS pixels.
replace('source_files/edge/i_video.cc','    if (current_screen_width > desktop_resolution_width.d_)\n        current_screen_width = desktop_resolution_width.d_;\n    if (current_screen_height > desktop_resolution_height.d_)\n        current_screen_height = desktop_resolution_height.d_;','    // Host selects the GPU drawing buffer independently from CSS viewport size.')
# Highest detail follows the GPU texture limits, not a project pixel budget.
replace('source_files/edge/r_image.cc', '        return (1 << 22);', '        return 0x7fffffff; // GPU GetMaxTextureSize still clamps each axis.')
# Read-only diagnostics count successful replacements and actual first uploads.
replace('source_files/edge/r_image.cc', '#include "r_image.h"', '#include "r_image.h"\nint web_hd_registered=0, web_hd_uploaded=0, web_hd_maxwidth=0;')
replace('source_files/edge/r_image.cc', '    rim->source_graphic_.packfile_name = (char *)calloc(pn_len + 1, 1);', '    rim->source_graphic_.packfile_name = (char *)calloc(pn_len + 1, 1);\n    if (type == kImageSourceTXHI && replaces) web_hd_registered++;')
replace('source_files/edge/r_image.cc', '    GLuint tex_id =\n        UploadTexture(tmp_img,', '    if (rim->source_type_ == kImageSourceTXHI && rim->source_graphic_.packfile_name) {\n        web_hd_uploaded++;\n        if (tmp_img->width_ > web_hd_maxwidth) web_hd_maxwidth=tmp_img->width_;\n    }\n    GLuint tex_id =\n        UploadTexture(tmp_img,')
# Minimal support trees: no bundled unrelated game packs or downloaded IWADs.
support=target/'browser-support';support.mkdir()
shutil.copytree(source/'edge_defs',support/'edge_defs')
for base in ['freedoom1','doom','doom1']:
 d=support/'edge_base'/base
 if base=='freedoom1': shutil.copytree(source/'edge_base'/base,d)
 else:
  # Definitions only; original-game graphics stay in the user's local IWAD.
  shutil.copytree(source/'edge_base'/base/'scripts',d/'scripts')
# Include all soundfont licenses (BSD/MIT, CC0, CC-BY-SA) and code/asset attributions.
shutil.copytree(source/'soundfont',support/'soundfont')
shutil.copytree(source/'docs/licenses',support/'licenses')
shutil.copyfile(source/'LICENSE',support/'EDGE-COPYING.txt')
print('Prepared EDGE browser renderer, DOM keyboard bridge, and isolated support assets')
