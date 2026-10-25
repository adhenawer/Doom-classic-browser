/* SPDX-License-Identifier: GPL-2.0-or-later */
#ifndef WEB_TURN_H
#define WEB_TURN_H
typedef struct {
    double initial, acceleration, maximum, sensitivity, deceleration;
    double velocity, carry;
    int direction;
} web_turn_t;
void web_turn_reset(web_turn_t *t);
int web_turn_tick(web_turn_t *t, int left, int right);
#endif
