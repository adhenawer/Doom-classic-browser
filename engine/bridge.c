/* SPDX-License-Identifier: GPL-2.0-or-later
 * Included by the build copy of g_game.c to reset its private input state.
 */
#include <emscripten.h>
#include <math.h>
#include "m_menu.h"
#include "m_controls.h"
#include "turn.h"
extern boolean menuactive;
extern void web_clock_pause(int paused);
int web_suspended = 0;
static int web_left = 0, web_right = 0;
static web_turn_t web_turn = {60, 360, 180, 1, 0, 0, 0, 0};
static int web_last_forward, web_last_side, web_last_angle, web_last_buttons;
EMSCRIPTEN_KEEPALIVE void web_key(int key, int down, int character) {
    event_t event = {0};
    if (key < 0 || key >= NUMKEYS) return;
    event.type = down ? ev_keydown : ev_keyup;
    event.data1 = key;
    event.data2 = character;
    event.data3 = character;
    D_PostEvent(&event);
}
EMSCRIPTEN_KEEPALIVE void web_rotate(int left, int right) {
    web_left = !!left; web_right = !!right;
}
EMSCRIPTEN_KEEPALIVE void web_reset(void) {
    while (D_PopEvent() != NULL) {}
    memset(gamekeydown, 0, sizeof(gamekeydown));
    memset(mousearray, 0, sizeof(mousearray));
    memset(joyarray, 0, sizeof(joyarray));
    mousex = mousey = joyxmove = joyymove = joystrafemove = 0;
    next_weapon = 0;
    web_left = web_right = 0;
    web_turn_reset(&web_turn);
}
EMSCRIPTEN_KEEPALIVE void web_suspend(int value) {
    web_reset();
    web_suspended = !!value;
    web_clock_pause(web_suspended);
}
EMSCRIPTEN_KEEPALIVE int web_menu(void) { return menuactive; }
EMSCRIPTEN_KEEPALIVE int web_audio(void) {
    return EM_ASM_INT({
        if (typeof SDL2 === 'undefined' || !SDL2.audioContext) return -1;
        if (SDL2.audioContext.state !== 'running') SDL2.audioContext.resume().catch(() => {});
        return SDL2.audioContext.state === 'running' ? 1 : 0;
    });
}
static double bounded(double v, double low, double high, double fallback) {
    if (!isfinite(v)) return fallback;
    return v < low ? low : (v > high ? high : v);
}
EMSCRIPTEN_KEEPALIVE void web_config(double initial, double acceleration, double maximum,
                                   double sensitivity, double deceleration) {
    web_turn.initial = bounded(initial, 1, 360, 60);
    web_turn.acceleration = bounded(acceleration, 0, 2000, 360);
    web_turn.maximum = bounded(maximum, web_turn.initial, 720, 180);
    web_turn.sensitivity = bounded(sensitivity, 0.1, 3, 1);
    web_turn.deceleration = bounded(deceleration, 0, 4000, 0);
    web_turn_reset(&web_turn);
    key_up = 'w'; key_down = 's';
    key_strafeleft = 'a'; key_straferight = 'd';
    key_fire = 'j'; key_use = ' '; key_speed = KEY_RSHIFT;
    key_prevweapon = 'r'; key_nextweapon = 'q';
}
/* Read-only instrumentation: used by actual-engine integration tests. */
EMSCRIPTEN_KEEPALIVE double web_state(int selector) {
    player_t *p = &players[consoleplayer];
    switch (selector) {
        case 0: return gametic;
        case 1: return gamestate;
        case 2: return p->mo ? p->mo->x : 0;
        case 3: return p->mo ? p->mo->y : 0;
        case 4: return p->mo ? p->mo->angle : 0;
        case 5: return p->health;
        case 6: return web_last_forward;
        case 7: return web_last_side;
        case 8: return web_last_angle;
        case 9: return web_last_buttons;
        case 10: return web_turn.velocity;
        case 11: return p->ammo[am_clip];
        case 12: return p->readyweapon;
        case 13: return paused;
        default: return -1;
    }
}
