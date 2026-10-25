/* SPDX-License-Identifier: GPL-2.0-or-later */
#include "turn.h"
#include <math.h>
void web_turn_reset(web_turn_t *t) {
    t->velocity = t->carry = 0;
    t->direction = 0;
}
int web_turn_tick(web_turn_t *t, int left, int right) {
    int direction = !!left - !!right;
    double units;
    int result;
    if (left && right) { web_turn_reset(t); return 0; }
    if (direction) {
        if (direction != t->direction) {
            t->velocity = t->initial;
            t->carry = 0;
        } else t->velocity += t->acceleration / 35.0;
        if (t->velocity > t->maximum) t->velocity = t->maximum;
        t->direction = direction;
    } else if (t->deceleration > 0) {
        t->velocity -= t->deceleration / 35.0;
        if (t->velocity <= 0) { web_turn_reset(t); return 0; }
    } else { web_turn_reset(t); return 0; }
    units = t->direction * t->velocity * t->sensitivity * 65536.0 / (360.0 * 35.0) + t->carry;
    result = (int) units;
    t->carry = units - result;
    return result;
}
