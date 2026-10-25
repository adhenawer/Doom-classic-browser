/* SPDX-License-Identifier: GPL-2.0-or-later
 * Link this test with the actual prepared engine's src/d_event.c and headers.
 * It checks observable FIFO behavior, not a copied queue implementation.
 */
#include "d_event.h"
#include <stdio.h>
#include <stdlib.h>

static const char *backend;
static unsigned char held[256];

static int equal_event(const char *scenario, int index,
                       const event_t *actual, const event_t *expected)
{
    if (actual == NULL)
    {
        fprintf(stderr, "FAIL %s / %s: queue empty at FIFO event %d "
                        "(expected %s key %d)\n", backend, scenario, index,
                expected->type == ev_keydown ? "keydown" : "keyup", expected->data1);
        return 0;
    }
    if (actual->type != expected->type || actual->data1 != expected->data1 ||
        actual->data2 != expected->data2 || actual->data3 != expected->data3 ||
        actual->data4 != expected->data4 || actual->data5 != expected->data5 ||
        actual->data6 != expected->data6)
    {
        fprintf(stderr, "FAIL %s / %s: event %d changed or arrived out of order\n",
                backend, scenario, index);
        return 0;
    }
    if (actual->data1 < 0 || actual->data1 >= (int)sizeof(held))
    {
        fprintf(stderr, "FAIL test fixture: key outside held-state model\n");
        return 0;
    }
    held[actual->data1] = actual->type == ev_keydown;
    return 1;
}

static int empty_queue(const char *scenario)
{
    if (D_PopEvent() != NULL || D_PopEvent() != NULL)
    {
        fprintf(stderr, "FAIL %s / %s: unexpected trailing FIFO events\n", backend, scenario);
        return 0;
    }
    return 1;
}

static int released_keys(const char *scenario)
{
    for (int key = 0; key < (int)sizeof(held); ++key)
    {
        if (held[key])
        {
            fprintf(stderr, "FAIL %s / %s: key %d remains held after complete tap pairs\n",
                    backend, scenario, key);
            return 0;
        }
    }
    return 1;
}

static void post_tap(event_t *expected, int *length, int key, int character)
{
    event_t event = {0};
    event.data1 = key;
    event.data2 = character;
    event.data3 = character;
    event.type = ev_keydown;
    expected[(*length)++] = event;
    D_PostEvent(&event);
    event.type = ev_keyup;
    expected[(*length)++] = event;
    D_PostEvent(&event);
    /* The queue must own a value, never a pointer into the sender's temporary. */
    event.type = ev_quit;
    event.data1 = -1;
}

static int save_name_burst(void)
{
    const char name[] = "CLASSIC";
    event_t expected[64];
    int length = 0;
    for (int i = 0; i < 24; ++i)
        post_tap(expected, &length, 127, 127);
    for (int i = 0; name[i] != '\0'; ++i)
        post_tap(expected, &length, name[i] - 'A' + 'a', name[i]);
    post_tap(expected, &length, 13, 13);
    if (length != 64)
    {
        fprintf(stderr, "FAIL test fixture: save-name burst must contain exactly 64 events\n");
        return 0;
    }
    /* No engine tic/consumer runs between the producer calls above. */
    for (int i = 0; i < length; ++i)
        if (!equal_event("64-event save-name burst", i, D_PopEvent(), &expected[i]))
            return 0;
    return empty_queue("save-name burst") && released_keys("save-name burst");
}

static event_t serial_event(int serial)
{
    event_t event = {0};
    event.type = (serial & 1) ? ev_keyup : ev_keydown;
    event.data1 = 'a' + (serial / 2) % 26;
    event.data2 = 'A' + (serial / 2) % 26;
    event.data3 = event.data2;
    event.data4 = serial;
    event.data5 = serial ^ 0x5a5a;
    event.data6 = -serial;
    return event;
}

static void post_serial_events(int *serial, int count)
{
    for (int i = 0; i < count; ++i)
    {
        event_t event = serial_event((*serial)++);
        D_PostEvent(&event);
    }
}

static int drain_serial_events(const char *scenario, int *serial, int count)
{
    for (int i = 0; i < count; ++i)
    {
        event_t expected = serial_event(*serial);
        if (!equal_event(scenario, *serial, D_PopEvent(), &expected))
            return 0;
        ++*serial;
    }
    return 1;
}

static int large_keyboard_burst(void)
{
    int sent = 0, received = 0;
    /* 511 complete tap pairs, below the ring's full/empty sentinel boundary. */
    post_serial_events(&sent, 1022);
    return drain_serial_events("1022-event burst", &received, sent) &&
           empty_queue("1022-event burst") && released_keys("1022-event burst");
}

static int interleaved_wraps(void)
{
    int sent = 0, received = 0;
    for (int round = 0; round < 1000; ++round)
    {
        post_serial_events(&sent, 64);
        if (!drain_serial_events("partial drain / wrap", &received, 31))
            return 0;
        post_serial_events(&sent, 94);
        if (!drain_serial_events("append after partial drain", &received, 25))
            return 0;
        post_serial_events(&sent, 128);
        if (!drain_serial_events("remaining FIFO across wraps", &received, sent - received))
            return 0;
        if (!empty_queue("round empty") || !released_keys("round releases"))
            return 0;
    }
    return 1;
}

int main(int argc, char **argv)
{
    backend = argc > 1 ? argv[1] : "prepared engine";
    if (!empty_queue("initial") || !save_name_burst() ||
        !large_keyboard_burst() || !interleaved_wraps())
        return EXIT_FAILURE;
    printf("PASS %s: exact 64-event save-name burst, FIFO payloads, key releases, "
           "1022-event burst and 286000 events with partial drains/repeated wrap\n", backend);
    return EXIT_SUCCESS;
}
