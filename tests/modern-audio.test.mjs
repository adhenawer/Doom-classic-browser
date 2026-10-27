// SPDX-License-Identifier: GPL-3.0-or-later
// Node unit coverage of the actual EM_JS controller. Fake contexts exercise
// ordering and failure policy; this does not validate browser audio or hardware.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../engine/modern-bridge.cc', import.meta.url), 'utf8');
const bodies = [...source.matchAll(/EM_JS\(int, web_audio_request, \(int running\), \{\n([\s\S]*?)\n\}\);/g)];
assert.equal(bodies.length, 1, 'exactly one native audio controller must be tested');
const request = new Function('Module', 'running', bodies[0][1]);
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
function gesture(module, wanted = 1) {
  const previous = module.webAudioGesture;
  module.webAudioGesture = true;
  try { return request(module, wanted); }
  finally { module.webAudioGesture = previous; }
}

function context(state = 'suspended') {
  const audio = { state, calls: [], resume() { return operation('running'); }, suspend() { return operation('suspended'); } };
  function operation(target) {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    audio.calls.push({ target, resolve: () => { audio.state = target; resolve(); }, reject });
    return promise;
  }
  return audio;
}

test('Modern audio: requests already at their target do not call browser APIs', () => {
  for (const [state, wanted, result] of [['running', 1, 1], ['suspended', 0, 0]]) {
    const audio = context(state), module = { modernAudioContext: audio };
    assert.equal(request(module, wanted), result);
    assert.equal(module.webAudioWanted, !!wanted);
    assert.equal(audio.calls.length, 0);
  }
  const closed = { modernAudioContext: context('closed') };
  assert.equal(request(closed, 1), -1);
  assert.equal(closed.webAudioWanted, true);
});

test('Modern audio: 64 same-intent requests share each pending transition', async () => {
  const audio = context(), module = { modernAudioContext: audio };
  for (let i = 0; i < 64; i++) request(module, 1);
  assert.equal(audio.calls.length, 1);
  audio.calls[0].resolve(); await flush();
  assert.equal(module.webAudioPendingOp, undefined);
  for (let i = 0; i < 64; i++) request(module, 0);
  assert.equal(audio.calls.length, 2);
  audio.calls[1].resolve(); await flush();
  assert.equal(module.webAudioPendingOp, undefined);
});

test('Modern audio: an opposite gesture starts synchronously despite a pending operation', async () => {
  const audio = context('running'), module = { modernAudioContext: audio };
  request(module, 0);
  request(module, 1);
  // No promise has settled: the resume still belongs to this gesture.
  assert.deepEqual(audio.calls.map(call => call.target), ['suspended', 'running']);
  audio.calls[0].resolve(); audio.calls[1].resolve(); await flush();
  assert.equal(audio.state, 'running');
});

test('Modern audio: stale operation and context completions cannot clear the latest ticket', async () => {
  const audio = context(), module = { modernAudioContext: audio };
  request(module, 1); request(module, 0);
  const latest = module.webAudioPendingOp;
  audio.calls[0].resolve(); await flush();
  assert.equal(module.webAudioPendingOp, latest);
  const replacement = context('running');
  module.modernAudioContext = replacement;
  assert.equal(request(module, 1), 1);
  assert.equal(replacement.calls.length, 0);
  audio.calls[1].resolve(); await flush();
  assert.equal(module.webAudioPendingOp, undefined);
  assert.equal(replacement.calls.length, 0);

  const older = context(), newer = context(), switched = { modernAudioContext: older };
  request(switched, 1);
  switched.modernAudioContext = newer; request(switched, 1);
  const replacementTicket = switched.webAudioPendingOp;
  older.calls[0].resolve(); await flush();
  assert.equal(switched.webAudioPendingOp, replacementTicket);
  newer.calls[0].resolve(); await flush();
  assert.equal(switched.webAudioPendingOp, undefined);
});

test('Modern audio: rejected autoplay or interrupted requests wait for another gesture', async t => {
  for (const state of ['suspended', 'interrupted']) {
    await t.test(state, async () => {
      const audio = context(state), module = { modernAudioContext: audio };
      request(module, 1);
      audio.calls[0].reject(new Error(state === 'suspended' ? 'autoplay denied' : 'audio interrupted'));
      await flush();
      assert.equal(module.webAudioPendingOp, undefined);
      assert.equal(audio.calls.length, 1, 'same intent must not retry itself');
      request(module, 1);
      assert.equal(audio.calls.length, 2, 'a new gesture may retry');
      audio.calls[1].resolve(); await flush();
    });
  }
});

test('Modern audio: synchronous API errors clear their operation without retrying', () => {
  const audio = context(); let calls = 0;
  audio.resume = () => { calls++; throw new Error('synchronous API failure'); };
  const module = { modernAudioContext: audio };
  assert.equal(request(module, 1), 0);
  assert.equal(module.webAudioPendingOp, undefined);
  assert.equal(calls, 1);
});

test('Modern audio: only a changed latest intent reconciles after completion', async () => {
  const audio = context(), module = { modernAudioContext: audio };
  request(module, 1);
  module.webAudioWanted = false;
  audio.calls[0].resolve(); await flush();
  assert.equal(audio.calls.length, 2);
  assert.equal(audio.calls[1].target, 'suspended');
  audio.calls[1].resolve(); await flush();
  assert.equal(module.webAudioPendingOp, undefined);
});

test('Modern audio: an older opposite completion reconciles after the latest ticket already finished', async () => {
  const audio = context(), module = { modernAudioContext: audio };
  request(module, 1); request(module, 0);
  audio.calls[1].resolve(); await flush();
  assert.equal(audio.state, 'suspended');
  assert.equal(module.webAudioPendingOp, undefined);
  audio.calls[0].resolve(); await flush();
  assert.equal(module.webAudioWanted, false);
  assert.equal(audio.calls.length, 3, 'late resume must request a correcting suspend');
  assert.equal(audio.calls[2].target, 'suspended');
  audio.calls[2].resolve(); await flush();
  assert.equal(audio.state, 'suspended');
  assert.equal(module.webAudioPendingOp, undefined);
});

test('Modern audio: an activated gesture retries an unresolved resume synchronously', async t => {
  for (const state of ['suspended', 'interrupted']) {
    await t.test(state, async () => {
      const audio = context(state), module = { modernAudioContext: audio };
      request(module, 1);
      const blocked = module.webAudioPendingOp;
      request(module, 1);
      assert.equal(audio.calls.length, 1, 'unactivated repeat must remain deduplicated');
      gesture(module);
      assert.equal(audio.calls.length, 2, 'resume must run inside the gesture without awaiting the blocked call');
      assert.notEqual(module.webAudioPendingOp, blocked);
      assert.equal(module.webAudioGesture, undefined);
      request(module, 1);
      assert.equal(audio.calls.length, 2, 'a gesture must not authorize later unactivated retries');
      audio.calls[1].resolve(); await flush();
      assert.equal(audio.state, 'running');
      assert.equal(module.webAudioPendingOp, undefined);
      gesture(module);
      assert.equal(audio.calls.length, 2, 'already-running gesture must not restart audio');
      audio.calls[0].resolve(); await flush();
      assert.equal(audio.calls.length, 2, 'late same-intent completion must not create another transition');
    });
  }
});

test('Modern audio: suspend wins over both pending resumes after an activated retry', async () => {
  const audio = context(), module = { modernAudioContext: audio };
  request(module, 1);
  gesture(module);
  gesture(module, 0);
  const suspension = module.webAudioPendingOp;
  assert.deepEqual(audio.calls.map(call => call.target), ['running', 'running', 'suspended']);
  audio.calls[0].resolve(); await flush();
  assert.equal(module.webAudioPendingOp, suspension, 'old blocked resume must not clear the newer suspend');
  audio.calls[2].resolve(); await flush();
  assert.equal(audio.state, 'suspended');
  audio.calls[1].resolve(); await flush();
  assert.equal(module.webAudioWanted, false);
  assert.equal(audio.calls[3].target, 'suspended', 'late activated resume must reconcile back to paused');
  audio.calls[3].resolve(); await flush();
  assert.equal(audio.state, 'suspended');
  assert.equal(module.webAudioPendingOp, undefined);
});
