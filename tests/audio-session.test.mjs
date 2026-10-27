import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source = ts.transpileModule(await readFile('web/audio.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {requestGameAudio} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('game audio requests playback before a synchronous native resume, once per session policy', () => {
  const calls = [];
  let type = 'auto';
  const browser = {audioSession: {get type() { return type; }, set type(value) { type=value; calls.push(value); }}};
  const engine = {_web_audio() { assert.equal(this.webAudioGesture, true); calls.push('resume'); return 1; }};
  assert.equal(requestGameAudio(engine, browser), 1);
  assert.deepEqual(calls, ['playback', 'resume']);
  requestGameAudio(engine, browser);
  assert.deepEqual(calls, ['playback', 'resume', 'resume']);
  assert.equal(engine.webAudioGesture, undefined);
});

test('the gesture flag cannot leak after native failure', () => {
  const engine = {_web_audio() {throw new Error('native');}};
  assert.throws(() => requestGameAudio(engine, {}), /native/);
  assert.equal(engine.webAudioGesture, undefined);
});

test('unsupported or denied session policy still invokes native resume inside the call', () => {
  for (const browser of [{}, {audioSession: {get type() {return 'auto';}, set type(_) {throw new Error('denied');}}}]) {
    let calls = 0;
    assert.equal(requestGameAudio({_web_audio() {calls++; return 0;}}, browser), 0);
    assert.equal(calls, 1);
  }
});
