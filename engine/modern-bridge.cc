/* SPDX-License-Identifier: GPL-3.0-or-later
 * Browser input and observation contract. Included only by the prepared
 * e_input.cc so reset can clear its authoritative private key/event state.
 */
#include <emscripten.h>
#include <cmath>
#include "dm_state.h"
#include "i_system.h"
#include "i_video.h"
#include "i_sound.h"
#include "s_music.h"
#include "s_sound.h"
#include "r_misc.h"
#include "r_modes.h"
extern "C" {
#include "turn.h"
}
extern ConsoleVariable sound_effect_volume;
extern int key_save_game, key_load_game;
extern int web_hd_registered, web_hd_uploaded, web_hd_maxwidth;
extern void web_clock_pause(int);
static web_turn_t web_turn = {60,360,180,1,0,0,0,0};
static int web_left, web_right, web_always_run;
static int web_last_forward, web_last_side, web_last_angle, web_last_buttons;
int web_suspended = 0;
// Observation only: phases never gate input, clocks, rendering or suspension.
// 0 idle, 1 WebTick, 2 game actions, 3 display, 4 display returned,
// 5 TryRunTicCommands, 6 commands returned, 7 GPU finish, 8 backend swap,
// 9 swap returned, 10 SDL_GL_SwapWindow (including its Asyncify yield).
static int web_diag_phase, web_diag_ticks, web_diag_world_frames, web_diag_swaps, web_diag_started;
static int web_diag_f3_posted, web_diag_f3_dequeued, web_diag_f3_tick;
static int web_diag_preview_phase, web_diag_first_world_tick;
static bool web_diag_pending_world, web_diag_tick_world_swap;
EM_JS(void, web_diag_log, (int phase, int ticks, int frames, int posted, int dequeued, int tic, int menu), {
 if (!Module['traceModern']) return;
 const count = Module['modernTraceCount'] || 0;
 if (count >= 96) return;
 Module['modernTraceCount'] = count + 1;
 console.info('MODERN_NATIVE', performance.now(), phase, ticks, frames, posted, dequeued, tic, menu);
});
static void web_diag_milestone(int phase) {
 // Only initial ticks and three completed ticks following F3 can emit logs.
 if (web_diag_started && (web_diag_ticks < 2 || (web_diag_f3_posted && web_diag_ticks < web_diag_f3_tick + 3)))
  web_diag_log(phase,web_diag_ticks,web_diag_world_frames,web_diag_f3_posted,web_diag_f3_dequeued,make_tic,menu_active);
}
void web_diag_set_phase(int phase) {
 if (phase == 1) { web_diag_started=1; web_diag_tick_world_swap=false; }
 web_diag_phase=phase; web_diag_milestone(phase);
}
void web_diag_frame_started() { web_diag_pending_world=false; }
void web_diag_world_drawn() { web_diag_pending_world=true; }
void web_diag_swap_finished() {
 ++web_diag_swaps;
 if (web_diag_pending_world && game_state == kGameStateLevel) {
  ++web_diag_world_frames; web_diag_tick_world_swap=true;
 }
 web_diag_pending_world=false;
 web_diag_set_phase(9);
}
void web_diag_tick_finished() {
 ++web_diag_ticks;
 if (game_state == kGameStateLevel && make_tic > 2 && web_diag_tick_world_swap) web_diag_first_world_tick=1;
 web_diag_set_phase(0);
}
void web_diag_preview(int phase) { web_diag_preview_phase=phase; web_diag_milestone(100+phase); }
void web_diag_f3_dequeue() { ++web_diag_f3_dequeued; web_diag_milestone(202); }
EM_JS(int, web_audio_request, (int running), {
 const context = Module['modernAudioContext'];
 if (!context || context.state === 'closed') return -1;
 Module['webAudioWanted'] = !!running;
 const reconcile = () => {
   const wanted = Module['webAudioWanted'];
   (wanted ? context.resume() : context.suspend()).then(() => {
     if (wanted !== Module['webAudioWanted']) reconcile();
   }).catch(() => {});
 };
 reconcile(); return context.state === 'running' ? 1 : 0;
});
extern "C" {
EMSCRIPTEN_KEEPALIVE void web_key(int key, int down, int character) {
 if (key < 0 || key >= kTotalKeys) return;
 // EDGE and Chocolate share Doom scancodes except Delete/Backspace: host uses 127.
 if (key == 127) key = kBackspace;
 if (key == 32 && character != 32 && character > 0) key = character;
 InputEvent event{}; event.type = down ? kInputEventKeyDown : kInputEventKeyUp;
 event.value.key.sym = key;
 PostEvent(&event);
 if (key == kFunction3 && down) {
  ++web_diag_f3_posted; web_diag_f3_tick=web_diag_ticks; web_diag_milestone(201);
 }
}
EMSCRIPTEN_KEEPALIVE void web_rotate(int left, int right) { web_left = !!left; web_right = !!right; }
EMSCRIPTEN_KEEPALIVE void web_reset() {
 ClearEventInput();
 for (int i=0;i<6;i++) { ball_deltas[i]=0; joy_forces[i]=0; }
 web_left = web_right = 0; web_last_forward = web_last_side = web_last_angle = web_last_buttons = 0;
 web_turn_reset(&web_turn);
}
EMSCRIPTEN_KEEPALIVE void web_suspend(int value) {
 web_reset(); event_head = event_tail = 0;
 web_suspended=!!value; web_clock_pause(web_suspended);
 if (web_suspended) web_audio_request(0);
}
EMSCRIPTEN_KEEPALIVE int web_menu() { return menu_active; }
EMSCRIPTEN_KEEPALIVE int web_audio() { return web_audio_request(1); }
EMSCRIPTEN_KEEPALIVE void web_comfort(int value) { web_always_run=!!value; in_running=web_always_run; }
EMSCRIPTEN_KEEPALIVE void web_mix(int sfx, int music) {
 sfx = sfx < 0 ? 0 : sfx > 15 ? 15 : sfx;
 music = music < 0 ? 0 : music > 15 ? 15 : music;
 sound_effect_volume = sfx/15.0f; music_volume=music/15.0f;
 if (!no_sound && sound_engine.pDevice) {
   ma_sound_group_set_volume(&sfx_node, sound_effect_volume.f_*0.5f);
   ma_sound_group_set_volume(&music_node, music_volume.f_);
 }
}
static double bounded(double n,double lo,double hi,double fallback) {
 return !std::isfinite(n) ? fallback : n<lo?lo:n>hi?hi:n;
}
EMSCRIPTEN_KEEPALIVE void web_config(double initial,double acceleration,double maximum,double sensitivity,double deceleration) {
 web_turn.initial=bounded(initial,1,360,60);
 web_turn.acceleration=bounded(acceleration,0,2000,360);
 web_turn.maximum=bounded(maximum,web_turn.initial,720,180);
 web_turn.sensitivity=bounded(sensitivity,.1,3,1);
 web_turn.deceleration=bounded(deceleration,0,4000,0);
 web_turn_reset(&web_turn);
 key_up='w'; key_down='s'; key_strafe_left='a'; key_strafe_right='d';
 key_left=key_right=0; key_fire='j';key_use=' ';key_speed=kRightShift;
 key_previous_weapon='r';key_next_weapon='q';key_map=kTab;
 key_save_game=kFunction2;key_load_game=kFunction3;
 key_fly_up=key_fly_down=key_look_up=key_look_down=key_mouselook=0;
 in_running=web_always_run;
}
EMSCRIPTEN_KEEPALIVE double web_state(int selector) {
 auto p = players[console_player]; auto mo=p ? p->map_object_ : nullptr;
 switch(selector) {
 case 0:return make_tic;
 case 1:return game_state == kGameStateLevel ? 0 : (int)game_state+1;
 case 2:return mo?mo->x*65536.0:0;
 case 3:return mo?mo->y*65536.0:0;
 case 4:return mo?mo->angle_:0;
 case 5:return p?p->health_:0;
 case 6:return web_last_forward;
 case 7:return web_last_side;
 case 8:return web_last_angle;
 case 9:return web_last_buttons;
 case 10:return web_turn.velocity;
 case 11:return p?p->ammo_[0].count:0;
 case 12:return p?p->ready_weapon_:0;
 case 13:return paused;
 case 14:return web_always_run;
 case 15:return std::round(sound_effect_volume.f_*15);
 case 16:return std::round(music_volume.f_*15);
 case 17:return current_screen_width;
 case 18:return current_screen_height;
 case 19:return 2;
 case 20:return view_window_width;
 case 21:return view_window_height;
 case 22:return level_flags.mouselook|level_flags.jump|level_flags.crouch|level_flags.true_3d_gameplay;
 case 23:return web_hd_registered;
 case 24:return web_hd_uploaded;
 case 25:return web_hd_maxwidth;
 case 26:return web_diag_phase;
 case 27:return web_diag_ticks;
 case 28:return web_diag_world_frames;
 case 29:return web_diag_f3_posted;
 case 30:return web_diag_f3_dequeued;
 case 31:return web_diag_preview_phase;
 case 32:return web_diag_swaps;
 case 33:return web_diag_first_world_tick;
 default:return -1;
 }
}
}
static void web_apply(EventTicCommand* cmd) {
 global_flags.mouselook=global_flags.jump=global_flags.crouch=global_flags.true_3d_gameplay=false;
 level_flags.mouselook=level_flags.jump=level_flags.crouch=level_flags.true_3d_gameplay=false;
 global_flags.autoaim=level_flags.autoaim=kAutoAimVertical;
 if (menu_active || paused || web_suspended) {web_turn_reset(&web_turn);return;}
 cmd->mouselook_turn=0;cmd->upward_move=0;
 cmd->angle_turn=web_turn_tick(&web_turn,web_left,web_right);
 web_last_forward=cmd->forward_move;web_last_side=cmd->side_move;
 web_last_angle=cmd->angle_turn;web_last_buttons=cmd->buttons;
}
