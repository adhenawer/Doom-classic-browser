import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const compiled = ts.transpileModule(await readFile('web/presentation.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const { Presentation, sanitizePresentation } = await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
test('presentation validates restored preferences and bounds exposure without accepting non-finite values', () => {
  assert.deepEqual(sanitizePresentation(null),{presentation:'sharp',brightness:1});
  assert.deepEqual(sanitizePresentation({presentation:'unknown',brightness:NaN}),{presentation:'sharp',brightness:1});
  assert.deepEqual(sanitizePresentation({presentation:'smooth',brightness:Infinity}),{presentation:'smooth',brightness:1});
  assert.deepEqual(sanitizePresentation({presentation:'crt',brightness:20}),{presentation:'crt',brightness:1.35});
  assert.equal(sanitizePresentation({brightness:-5}).brightness,.75);
});
test('ordinary presentation has no extra canvas or animation loop and restores original source styles', () => {
  const source = {style:{opacity:'.8',filter:'contrast(1)',imageRendering:'auto'}};
  const p = new Presentation(source,{append(){throw new Error('No layer expected');}});
  p.apply({presentation:'smooth',brightness:1.1}); p.setActive(true); p.frame();
  assert.equal(source.style.imageRendering,'auto');
  assert.equal(source.style.filter,'brightness(1.1)');
  p.apply({presentation:'sharp',brightness:1});
  assert.equal(source.style.imageRendering,'pixelated');
  assert.equal(p.diagnostics().frames,0);
  p.dispose();
  assert.deepEqual(source.style,{opacity:'.8',filter:'contrast(1)',imageRendering:'auto'});
});
test('unavailable WebGL falls back visibly without hiding or stealing focus from the real game canvas', () => {
  const previous = globalThis.document;
  let focusChanges=0;
  globalThis.document = {createElement:()=>({style:{},setAttribute(){},getContext:()=>null,remove(){},removeEventListener(){}})};
  try {
    const source={style:{opacity:'',filter:'',imageRendering:''},focus(){focusChanges++}};
    const p=new Presentation(source,{append(){throw new Error('No failed layer expected');}});
    p.setActive(true); p.apply({presentation:'crt',brightness:1.2}); p.frame();
    assert.equal(p.diagnostics().requested,'crt'); assert.equal(p.diagnostics().active,'sharp');
    assert.match(p.diagnostics().message,/indisponível/);
    assert.equal(source.style.opacity,''); assert.equal(source.style.filter,'brightness(1.2)');
    assert.equal(focusChanges,0); p.dispose();
  } finally { globalThis.document=previous; }
});
test('partial shader allocation failure releases its WebGL context and never propagates into the engine callback', () => {
  const previous=globalThis.document;
  let released=0,removed=0;
  globalThis.document={createElement:()=>({style:{},setAttribute(){},getContext:()=>({createShader:()=>null,getExtension:()=>({loseContext(){released++}})}),removeEventListener(){},remove(){removed++}})};
  try {
    const source={style:{opacity:'',filter:'',imageRendering:''}};
    const p=new Presentation(source,{append(){throw new Error('No failed layer expected');}});
    assert.doesNotThrow(()=>{p.apply({presentation:'crt',brightness:1});p.setActive(true);p.frame();});
    assert.equal(released,1); assert.equal(removed,1);
    assert.equal(p.diagnostics().active,'sharp'); assert.equal(source.style.opacity,'');
  } finally {globalThis.document=previous;}
});
