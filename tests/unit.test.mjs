import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const load = async p => import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(await readFile(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const { InputState, defaults, validateBindings } = await load('web/input.ts');
const { validateWad } = await load('web/wad.ts');
test('WASD individual, diagonal and independent turn; release and reset', () => {
  const s = new InputState();
  for (const [key, action] of [['KeyW','forward'],['KeyS','backward'],['KeyA','strafeLeft'],['KeyD','strafeRight']]) {
    s.press(key); assert(s.active(action)); s.release(key); assert(!s.active(action));
  }
  ['KeyW','KeyD','ArrowLeft','KeyJ'].forEach(k=>s.press(k));
  for (const a of ['forward','strafeRight','turnLeft','fire']) assert(s.active(a));
  s.release('KeyW'); assert(!s.active('forward')); assert(s.active('turnLeft'));
  s.press('ArrowRight'); assert(s.active('turnLeft')&&s.active('turnRight'));
  s.clear(); assert.equal(s.held.size,0);
});
test('aliases retain action until all physical keys released; repeats idempotent', () => {
  const s=new InputState();s.press('KeyW');s.press('KeyW');s.press('ArrowUp');s.release('KeyW');assert(s.active('forward'));s.release('ArrowUp');assert(!s.active('forward'));
});
test('remapping handles conflicts and protects weapon keys', () => {
  const s=new InputState();s.remap('forward','KeyZ');s.press('KeyZ');assert(s.active('forward'));
  assert.throws(()=>s.remap('fire','KeyZ'));assert.throws(()=>s.remap('fire','Digit1'));assert.throws(()=>s.remap('fire','MetaLeft'));
  assert.deepEqual(validateBindings({}),defaults);assert.deepEqual(validateBindings(s.bindings),s.bindings);
});
test('WAD rejects truncated headers, signed offsets, incomplete directories and PWAD', () => {
  assert.throws(()=>validateWad(new ArrayBuffer(4)));
  const b = new ArrayBuffer(28), v=new DataView(b), u=new Uint8Array(b);u.set(new TextEncoder().encode('IWAD'));v.setInt32(4,1,true);v.setInt32(8,12,true);v.setInt32(12,-1,true);
  assert.throws(()=>validateWad(b));u.set(new TextEncoder().encode('PWAD'));assert.throws(()=>validateWad(b));
});
