/* SPDX-License-Identifier: GPL-2.0-or-later
 * Included once in each backend. Network work only happens at a requested-map
 * barrier, never from the renderer or in anticipation of the following map.
 */
#ifndef WEB_MAP_DELIVERY_H
#define WEB_MAP_DELIVERY_H
#include <emscripten.h>
EM_JS(int, web_has_map_delivery, (), { return typeof Module['prepareMap'] === 'function'; });
EM_ASYNC_JS(void, web_prepare_map_request, (const char *map), {
    const name = UTF8ToString(map);
    Module['mapPreparationActive'] = true;
    try {
        for (;;) {
            try {
                await Module['prepareMap'](name);
                return;
            } catch (error) {
                // Failed/corrupt/offline content must never fall through to
                // native loading or silently substitute lower-quality images.
                await new Promise(resolve => {
                    Module['retryMapPreparation'] = resolve;
                    Module['onMapPreparationError']?.(error, name);
                });
                delete Module['retryMapPreparation'];
            }
        }
    } finally {
        Module['mapPreparationActive'] = false;
    }
});
/* web_suspend is native here: the host must not reenter WASM while Asyncify
 * owns the stack. Preserve the previous pause state and exclude network time
 * from simulation time. Audio remains paused until a host/user resume. */
static void web_prepare_map_named(const char *map)
{
    int was_suspended;
    if (!web_has_map_delivery()) return;
    was_suspended = web_suspended;
    web_suspend(1);
    web_prepare_map_request(map);
    web_suspend(was_suspended);
    // Notify only after the surrounding native frame has completed. The host
    // can safely pause/resume through its existing frame-boundary contract.
    EM_ASM({ Module['mapReadyName'] = UTF8ToString($0); }, map);
}
#endif
