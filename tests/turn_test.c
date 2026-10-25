#include "../engine/turn.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
int main(void) {
    web_turn_t t = {60,360,180,1,0,0,0,0};
    int first = web_turn_tick(&t, 1, 0), second = web_turn_tick(&t, 1, 0);
    assert(first > 0 && second > first);
    for (int i=0;i<200;i++) web_turn_tick(&t,1,0);
    assert(t.velocity == 180);
    assert(web_turn_tick(&t,0,0) == 0 && t.velocity == 0);
    assert(web_turn_tick(&t,0,1) < 0);
    assert(web_turn_tick(&t,1,1) == 0 && t.velocity == 0);
    web_turn_tick(&t,1,0); int inverse=web_turn_tick(&t,0,1); assert(inverse == -first);
    t.deceleration=35; web_turn_tick(&t,1,0); assert(web_turn_tick(&t,0,0)>0 && t.velocity==59);
    web_turn_reset(&t); assert(t.velocity==0 && t.carry==0 && t.direction==0);
    t.deceleration=0; t.sensitivity=2; assert(web_turn_tick(&t,1,0) >= first*2);
    puts("PASS: native turn ramp, clamp, release, opposition, reversal, smoothing, reset, sensitivity");
}
