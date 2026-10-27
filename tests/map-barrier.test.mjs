// SPDX-License-Identifier: GPL-2.0-or-later
// Exercise the actual async native bridge body; browser tests separately prove
// that its call sites run at map boundaries and preserve the game state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../engine/map-delivery.h', import.meta.url), 'utf8');
const match = source.match(/EM_ASYNC_JS\(void, web_prepare_map_request, \(const char \*map\), \{\n([\s\S]*?)\n\}\);/);
assert.ok(match, 'test the real native bridge');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const prepare = new AsyncFunction('Module', 'UTF8ToString', 'map', match[1]);
const flush = async () => { for (let i = 0; i < 8; ++i) await Promise.resolve(); };

test('native map barrier waits for the selected map and requests no following map', async () => {
  let complete;
  const requests = [];
  const module = { prepareMap(name) {
    requests.push(name);
    return new Promise(resolve => { complete = resolve; });
  } };
  let finished = false;
  const pending = prepare(module, value => value, 'E1M1').then(() => { finished = true; });
  await flush();
  assert.deepEqual(requests, ['E1M1']);
  assert.equal(module.mapPreparationActive, true);
  assert.equal(finished, false);
  complete(); await pending;
  assert.equal(module.mapPreparationActive, false);
  assert.deepEqual(requests, ['E1M1']);
});

test('native map barrier holds corrupted or unavailable content until explicit retry succeeds', async () => {
  let attempts = 0, finished = false;
  const failure = new Error('SHA-256 mismatch');
  const errors = [];
  const module = {
    async prepareMap(name) {
      assert.equal(name, 'E1M9');
      if (++attempts === 1) throw failure;
    },
    onMapPreparationError(error, name) { errors.push([error, name]); }
  };
  const pending = prepare(module, value => value, 'E1M9').then(() => { finished = true; });
  await flush();
  assert.equal(attempts, 1);
  assert.equal(finished, false);
  assert.equal(module.mapPreparationActive, true);
  assert.deepEqual(errors, [[failure, 'E1M9']]);
  module.retryMapPreparation(); await pending;
  assert.equal(attempts, 2);
  assert.equal(module.retryMapPreparation, undefined);
  assert.equal(module.mapPreparationActive, false);
});
