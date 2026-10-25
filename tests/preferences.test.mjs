import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const input = url(transpile(await readFile('web/input.ts', 'utf8')));
const source = transpile(await readFile('web/preferences.ts', 'utf8')).replace("from './input'", `from '${input}'`);
const { baseSettings, sanitizeSettings, applyTurnPreset, selectedTurnPreset, gameplayProfile, turnPresets } = await import(url(source));

test('legacy settings retain custom input and rotation, add conservative audio/comfort defaults', () => {
  const legacy = structuredClone(baseSettings);
  delete legacy.alwaysRun; delete legacy.sfxVolume; delete legacy.musicVolume;
  legacy.initial = 75; legacy.bindings.fire = ['KeyZ'];
  const migrated = sanitizeSettings(legacy);
  assert.equal(migrated.initial, 75);
  assert.deepEqual(migrated.bindings.fire, ['KeyZ']);
  assert.equal(migrated.alwaysRun, false);
  assert.equal(migrated.sfxVolume, 8); assert.equal(migrated.musicVolume, 6);
  assert.equal(gameplayProfile(migrated), 'classic-v1');
  migrated.bindings.fire.push('KeyX');
  assert.deepEqual(baseSettings.bindings.fire, ['ControlLeft', 'KeyJ']);
});

test('untrusted backup settings reject nonfinite values and clamp coherent limits', () => {
  const invalid = sanitizeSettings({ initial: 350, maximum: NaN, acceleration: Infinity,
    sensitivity: '2', deceleration: -20, alwaysRun: 'true', sfxVolume: 1000, musicVolume: -2 });
  assert.equal(invalid.maximum, 350);
  assert.equal(invalid.acceleration, 360); assert.equal(invalid.sensitivity, 1);
  assert.equal(invalid.deceleration, 0); assert.equal(invalid.alwaysRun, false);
  assert.equal(invalid.sfxVolume, 15); assert.equal(invalid.musicVolume, 0);
  assert.equal(sanitizeSettings({ sfxVolume: 7.7 }).sfxVolume, 8);
  assert.equal(sanitizeSettings({ alwaysRun: true }).alwaysRun, true);
  assert.deepEqual(sanitizeSettings(null), baseSettings);
});

test('turn presets are reversible without replacing audio, bindings or caller display settings', () => {
  const initial = { ...structuredClone(baseSettings), alwaysRun: true, musicVolume: 2, presentation: 'smooth' };
  initial.bindings.fire = ['KeyZ'];
  for (const preset of Object.keys(turnPresets)) {
    const next = applyTurnPreset(initial, preset);
    assert.equal(selectedTurnPreset(next), preset);
    assert.equal(next.alwaysRun, true); assert.equal(next.musicVolume, 2);
    assert.equal(next.presentation, 'smooth'); assert.deepEqual(next.bindings.fire, ['KeyZ']);
    assert.equal(gameplayProfile(next), 'comfort-v1');
  }
  assert.equal(selectedTurnPreset({ ...baseSettings, initial: 76 }), 'custom');
  assert.equal(initial.initial, 60);
});
