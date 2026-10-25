// SPDX-License-Identifier: GPL-2.0-or-later
import './style.css';
import { InputState, defaults, engineKeys, validateBindings } from './input';
import { validateWad, wadHash, MAX_WAD } from './wad';
import { read, write, remove } from './storage';

type Wad = { id: string; name: string; bytes: number };
type Settings = { initial: number; acceleration: number; maximum: number; sensitivity: number; deceleration: number; bindings: Record<string, string[]> };
type FS = {
  mkdirTree(p: string): void; mount(type: unknown, options: object, p: string): void;
  filesystems: { IDBFS: unknown }; syncfs(populate: boolean, cb: (e?: Error) => void): void;
  writeFile(p: string, data: Uint8Array | string): void; readFile(p: string): Uint8Array;
  readdir(p: string): string[]; stat(p: string): { mode: number }; isDir(mode: number): boolean; unlink(p: string): void;
};
type Engine = { FS: FS; callMain(args: string[]): void; _web_key(k: number, d: number, c: number): void;
  _web_rotate(l: number, r: number): void; _web_reset(): void; _web_suspend(v: number): void;
  _web_menu(): number; _web_text(): number; _web_audio(): number; _web_state(n: number): number;
  _web_config(a: number,b: number,c: number,d: number,e: number): void;
};
declare global { interface Window {
  createDoom?: (options: object) => Promise<Engine>;
  doom?: Engine;
} }
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const shell = el('shell'), game = el('game'), panel = el('panel'), home = el('home');
const canvas = el<HTMLCanvasElement>('canvas'), status = el('status');
const baseSettings: Settings = { initial: 60, acceleration: 360, maximum: 180, sensitivity: 1, deceleration: 0, bindings: structuredClone(defaults) };
const actionLabels: Record<string, string> = {
  forward: 'Avançar', backward: 'Recuar', strafeLeft: 'Deslocar para a esquerda', strafeRight: 'Deslocar para a direita',
  turnLeft: 'Girar para a esquerda', turnRight: 'Girar para a direita', fire: 'Atirar', run: 'Correr',
  use: 'Interagir / abrir portas', next: 'Próxima arma', previous: 'Arma anterior', map: 'Mapa',
  menu: 'Menu / pausa', back: 'Voltar', save: 'Salvar jogo', load: 'Carregar jogo', shell: 'Interface e configurações'
};
const keyLabels: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Espaço', ControlLeft: 'Ctrl esquerdo', ShiftLeft: 'Shift esquerdo', ShiftRight: 'Shift direito', Escape: 'Esc' };
const keyLabel = (key: string) => keyLabels[key] ?? key.replace(/^Key/, '');
let settings = structuredClone(baseSettings), input = new InputState(), engine: Engine | undefined;
let wads: Wad[] = [], selected = 'freedoom', running = false, suspended = false, starting = false;
let queuedLoad = false;
let remapping: string | undefined, previousMenu = false;
let sent = new Set<number>(), activeSavePath = '', syncQueue = Promise.resolve();
let swRegistration: ServiceWorkerRegistration | undefined;
let initialized = false;
const say = (message: string) => { status.textContent = message; };
const error = (e: unknown) => { say(`Erro: ${e instanceof Error ? e.message : String(e)}`); console.error(e); };
function sanitizeSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return structuredClone(baseSettings);
  const s = raw as Settings;
  const number = (v: number, low: number, high: number, fallback: number) => Number.isFinite(v) ? Math.max(low, Math.min(high, v)) : fallback;
  const initial = number(s.initial, 1, 360, 60);
  return { initial, acceleration: number(s.acceleration, 0, 2000, 360), maximum: number(s.maximum, initial, 720, 180),
    sensitivity: number(s.sensitivity, .1, 3, 1), deceleration: number(s.deceleration, 0, 4000, 0), bindings: validateBindings(s.bindings) };
}
function applyConfig() {
  engine?._web_config(settings.initial, settings.acceleration, settings.maximum, settings.sensitivity, settings.deceleration);
}
async function saveSettings() { settings.bindings = structuredClone(input.bindings); await write('settings', settings); applyConfig(); say('Configurações armazenadas neste navegador.'); }
function reset() { input.clear(); sent.clear(); engine?._web_reset(); }
function suspend() {
  if (!engine || !running) return;
  reset(); engine._web_suspend(1); suspended = true;
  el('resume').hidden = false;
  if (!document.hidden && !game.hidden) el('resumeButton').focus();
}
function resume() {
  if (!engine || !running) return;
  reset(); applyConfig(); engine._web_audio(); engine._web_suspend(0);
  suspended = false; el('resume').hidden = true;
  shell.hidden = true; game.hidden = false; canvas.focus();
  if (queuedLoad) { queuedLoad = false; tap(189); }
}
function showShell() {
  suspend(); game.hidden = true; shell.hidden = false; showHome();
}
function showHome() {
  panel.hidden = true; panel.replaceChildren(); home.hidden = false; remapping = undefined;
  el('play').textContent = running ? 'Retomar partida' : 'Jogar'; el('play').focus();
}
function showPanel(title: string) {
  home.hidden = true; panel.hidden = false; panel.replaceChildren();
  const h = document.createElement('h2'); h.textContent = title; panel.append(h);
}
function paragraph(text: string) { const p = document.createElement('p'); p.textContent = text; p.className = 'hint'; panel.append(p); }
function button(text: string, fn: () => unknown) {
  const b = document.createElement('button'); b.textContent = text; b.addEventListener('click', () => Promise.resolve().then(fn).catch(error)); panel.append(b); return b;
}
function back() { button('Voltar', showHome); panel.querySelector<HTMLElement>('button,input,select')?.focus(); }
async function content() {
  showPanel('Selecionar conteúdo');
  paragraph(running ? 'Para trocar de IWAD, volte à interface e recarregue a página após selecionar.' : 'Freedoom tem mapas e arte livres. Para DOOM original, importe seu próprio IWAD autorizado.');
  for (const item of [{ id: 'freedoom', name: 'Freedoom Phase 1 · conteúdo livre' }, ...wads]) {
    button(`${selected === item.id ? '✓ ' : ''}${item.name}`, async () => { selected = item.id; await write('selected', selected); say(`Selecionado: ${item.name}`); content(); });
  }
  for (const item of wads) button(`Remover conteúdo: ${item.name}`, () => {
    showPanel('Remover IWAD'); paragraph(`Remover ${item.name} deste navegador? Preserve sua cópia no app Arquivos. Saves e a partida ativa serão mantidos.`);
    button('Confirmar remoção', async () => {
      wads = wads.filter(w => w.id !== item.id); await write('wads', wads); await remove('wad:' + item.id);
      if (selected === item.id) { selected = 'freedoom'; await write('selected', selected); }
      say('IWAD removido do armazenamento local.'); content();
    }); button('Cancelar', content); panel.querySelector<HTMLElement>('button')?.focus();
  });
  back();
}
function controls() {
  showPanel('Controles');
  paragraph('Partida: WASD + setas. Enter confirma. P abre o menu, M abre o mapa, K salva, L carrega e H volta à interface. Nos menus do motor: Y confirma perguntas e N cancela. Para nomear saves, digite e confirme com Enter.');
  paragraph('Escolha uma ação para remapear. Escape cancela a captura. Teclas reservadas pelo sistema podem não chegar ao aplicativo.');
  for (const [action, keys] of Object.entries(input.bindings)) {
    const b = button(`${actionLabels[action]}: ${keys.map(keyLabel).join(' / ')}`, () => { reset(); remapping = action; b.textContent = `${actionLabels[action]}: pressione uma tecla…`; });
    b.dataset.action = action;
  }
  button('Restaurar controles padrão', async () => { input = new InputState(); await saveSettings(); controls(); }); back();
}
function configure() {
  showPanel('Rotação e desempenho');
  const fields: [keyof Omit<Settings,'bindings'>, string, number, number, number][] = [
    ['initial', 'Velocidade inicial (°/s)', 1, 360, 1], ['acceleration', 'Aceleração (°/s²)', 0, 2000, 10],
    ['maximum', 'Velocidade máxima (°/s)', 1, 720, 1], ['sensitivity', 'Sensibilidade', .1, 3, .1],
    ['deceleration', 'Desaceleração (°/s²; zero = parada imediata)', 0, 4000, 10]
  ];
  for (const [key, title, min, max, step] of fields) {
    const label = document.createElement('label'); label.textContent = title;
    const field = document.createElement('input'); field.type = 'number'; field.min = `${min}`; field.max = `${max}`; field.step = `${step}`; field.value = `${settings[key]}`; field.dataset.setting = key;
    label.append(field); panel.append(label);
  }
  paragraph('Renderização clássica 320×200, aspecto 4:3 e escala por pixels. Simulação de 35 tics/s. Sem mira vertical, Pointer Lock ou controles de toque.');
  button('Salvar configurações', async () => {
    const next = { ...settings };
    panel.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(f => { next[f.dataset.setting as keyof Omit<Settings,'bindings'>] = f.valueAsNumber; });
    settings = sanitizeSettings(next); await saveSettings(); configure();
  }); back();
}
function sync(populate = false) {
  const operation = () => new Promise<void>((resolve, reject) => {
    if (!engine) { resolve(); return; }
    engine.FS.syncfs(populate, e => e ? reject(e) : resolve());
  });
  const result = syncQueue.then(operation); syncQueue = result.catch(() => {}); return result;
}
function listFiles(path = '/persist'): string[] {
  if (!engine) return [];
  const fs = engine.FS;
  return fs.readdir(path).filter(n => n !== '.' && n !== '..').flatMap(n => {
    const p = `${path}/${n}`; return fs.isDir(fs.stat(p).mode) ? listFiles(p) : [p];
  });
}
function download(name: string, data: Blob) {
  const url = URL.createObjectURL(data), a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function saves() {
  showPanel('Saves e backups');
  paragraph('Saves originais: K salva e L carrega durante o jogo. Cópias persistidas ficam associadas ao SHA-256 do IWAD. Exporte backups: o iPadOS pode remover dados locais.');
  if (engine) {
    for (const path of listFiles().filter(p => /\/doomsav[0-5]\.dsg$/.test(p))) {
      paragraph(`${path.includes(activeSavePath + '/') ? 'Atual' : 'Outro IWAD'} · ${path.split('/').slice(-2).join('/')}`);
      button(`Excluir ${path.split('/').slice(-2).join('/')}`, () => {
        showPanel('Excluir save'); paragraph('Esta ação remove o save local. Exporte um backup antes, se precisar preservá-lo.');
        button('Confirmar exclusão', async () => { engine!.FS.unlink(path); await sync(); say('Save excluído e remoção persistida.'); saves(); });
        button('Cancelar', saves); panel.querySelector<HTMLElement>('button')?.focus();
      });
    }
    button('Exportar backup de saves e configurações', async () => {
      await sync();
      const files = listFiles().filter(p => /\/doomsav[0-5]\.dsg$/.test(p)).map(path => ({ path, data: btoa(Array.from(engine!.FS.readFile(path), b => String.fromCharCode(b)).join('')) }));
      download('doom-backup.json', new Blob([JSON.stringify({ version: 1, settings, files })], { type: 'application/json' }));
    });
  } else paragraph('Inicie o motor para acessar e exportar saves.');
  button('Importar backup', () => { if (!engine) throw new Error('Inicie uma partida primeiro e volte com H.'); el<HTMLInputElement>('backupFile').click(); });
  back();
}
async function importBackup(file: File) {
  if (!engine || file.size > 16 * 1024 * 1024) throw new Error('Backup indisponível ou maior que 16 MiB.');
  const raw = JSON.parse(await file.text());
  if (raw.version !== 1 || !Array.isArray(raw.files) || raw.files.length > 60) throw new Error('Formato de backup inválido.');
  const checked = raw.files.map((f: {path: string; data: string}) => {
    if (!f || typeof f.path !== 'string' || !/^\/persist\/saves\/[a-f0-9]{64}\/doomsav[0-5]\.dsg$/.test(f.path) || typeof f.data !== 'string' || f.data.length > 2 * 1024 * 1024) throw new Error('Caminho ou tamanho de save inválido.');
    const bytes = Uint8Array.from(atob(f.data), c => c.charCodeAt(0));
    if (bytes.length < 50) throw new Error('Save incompleto.');
    return { path: f.path, bytes };
  });
  if (new Set(checked.map((f: {path: string}) => f.path)).size !== checked.length) throw new Error('Saves duplicados.');
  for (const f of checked) { engine.FS.mkdirTree(f.path.slice(0, f.path.lastIndexOf('/'))); engine.FS.writeFile(f.path, f.bytes); }
  await sync(); settings = sanitizeSettings(raw.settings); input = new InputState(settings.bindings); await saveSettings();
  say('Backup importado e persistido.'); saves();
}
async function importWad(file: File) {
  if (file.size > MAX_WAD) throw new Error('IWAD maior que 64 MiB.');
  const data = await file.arrayBuffer(); validateWad(data);
  const id = await wadHash(data), item = { id, name: file.name.slice(0, 100), bytes: data.byteLength };
  const next = [...wads.filter(w => w.id !== id), item];
  if (next.length > 8) throw new Error('Limite de 8 IWADs.');
  await write('wad:' + id, data); await write('wads', next); wads = next; selected = id; await write('selected', selected);
  say(`IWAD validado e armazenado: ${item.name}`); content();
}
async function loadScript() {
  if (window.createDoom) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script'); script.src = new URL('doom.js', location.href).href;
    script.onload = () => resolve(); script.onerror = () => { script.remove(); reject(new Error('Loader WASM ausente. Verifique a preparação offline.')); }; document.head.append(script);
  });
}
async function start(load = false) {
  if (!initialized) { say('Aguarde a leitura do armazenamento local.'); return; }
  if (running) { resume(); if (load) tap(189); return; }
  if (starting) return;
  starting = true; el<HTMLButtonElement>('play').disabled = true; say('Carregando o motor real…');
  try {
    const custom = wads.find(w => w.id === selected);
    if (selected !== 'freedoom' && !custom) throw new Error('IWAD selecionado não está armazenado.');
    let data = custom ? await read<ArrayBuffer>('wad:' + custom.id) : undefined;
    if (custom && !data) throw new Error('Arquivo IWAD ausente. Importe-o novamente pelo Arquivos.');
    if (!data) { const response = await fetch('./freedoom1.wad', { cache: 'no-store' }); if (!response.ok) throw new Error('Freedoom indisponível.'); data = await response.arrayBuffer(); }
    validateWad(data); const hash = await wadHash(data);
    if (hash !== (custom?.id ?? '7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d')) throw new Error('IWAD corrompido: SHA-256 divergente. Importe novamente.');
    await loadScript();
    engine = await window.createDoom!({ canvas, noInitialRun: true,
      locateFile: (path: string) => new URL(path, location.href).href,
      print: (line: string) => console.info('[doom]', line), printErr: (line: string) => console.warn('[doom]', line),
      onAbort: (reason: string) => { showShell(); error(new Error(`Motor abortado: ${reason}. Recarregue para tentar novamente.`)); },
      onSaveWritten: () => { say('Persistindo save…'); sync().then(() => say('Save persistido em IndexedDB.')).catch(error); }
    });
    window.doom = engine;
    engine.FS.mkdirTree('/persist'); engine.FS.mount(engine.FS.filesystems.IDBFS, {}, '/persist');
    await sync(true);
    activeSavePath = `/persist/saves/${hash}`; engine.FS.mkdirTree(activeSavePath);
    engine.FS.writeFile('/game.wad', new Uint8Array(data));
    engine.FS.writeFile('/default.cfg', 'mouse_sensitivity 0\nsfx_volume 8\nmusic_volume 6\nshow_messages 1\nscreenblocks 10\n');
    engine.FS.writeFile('/chocolate.cfg', 'fullscreen 0\nwindow_width 640\nwindow_height 480\naspect_ratio_correct 1\ninteger_scaling 0\nforce_software_renderer 0\nsnd_musicdevice 3\nsnd_sfxdevice 3\nsnd_samplerate 22050\nuse_mouse 0\ngrabmouse 0\nshow_endoom 0\nvanilla_savegame_limit 0\n');
    shell.hidden = true; game.hidden = false; canvas.focus();
    engine.callMain(['-iwad', '/game.wad', '-config', '/default.cfg', '-extraconfig', '/chocolate.cfg', '-savedir', activeSavePath + '/', '-nomouse', '-nojoystick', '-noautoload', '-warp', '1', '1', '-skill', '3']);
    await new Promise<void>((resolve, reject) => {
      const until = performance.now() + 45000;
      const timer = setInterval(() => {
        if (engine!._web_state(0) > 2 && engine!._web_state(1) === 0) { clearInterval(timer); resolve(); }
        else if (performance.now() > until) { clearInterval(timer); reject(new Error('Motor não chegou à fase em 45 segundos.')); }
      }, 50);
    });
    running = true; queuedLoad = load; applyConfig(); suspend();
    say('Motor pronto. Enter retoma a partida e tenta desbloquear o áudio.');
  } catch (e) { shell.hidden = false; game.hidden = true; error(e); }
  finally { starting = false; el<HTMLButtonElement>('play').disabled = false; }
}
function tap(key: number, character = key) {
  engine?._web_key(key, 1, character); engine?._web_key(key, 0, character);
}
function updateInput() {
  if (!engine || suspended || game.hidden || engine._web_menu()) return;
  const next = new Set<number>();
  for (const [action, code] of Object.entries(engineKeys)) if (input.active(action)) next.add(code);
  for (let n = 1; n <= 7; n++) if (input.held.has(`Digit${n}`)) next.add(48 + n);
  for (const key of sent) if (!next.has(key)) engine._web_key(key, 0, key);
  for (const key of next) if (!sent.has(key)) engine._web_key(key, 1, key);
  sent = next; engine._web_rotate(+input.active('turnLeft'), +input.active('turnRight'));
}
const menuCodes: Record<string, number> = { ArrowUp: 173, ArrowDown: 175, ArrowLeft: 172, ArrowRight: 174, Enter: 13, NumpadEnter: 13, Escape: 27, Backspace: 127 };
window.addEventListener('keydown', event => {
  const code = event.code;
  if (event.metaKey || event.altKey || (event.ctrlKey && code !== 'ControlLeft' && code !== 'ControlRight')) { if (running) suspend(); return; }
  // SDL installs window handlers that prevent browser defaults even while its
  // canvas is hidden. Keep shell Enter, form fields and remapping usable.
  if (engine) event.stopImmediatePropagation();
  if (remapping) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (code === 'Escape') { remapping = undefined; controls(); return; }
    try { input.remap(remapping, code); remapping = undefined; saveSettings().then(controls).catch(error); } catch (e) { error(e); }
    return;
  }
  if (running && !game.hidden) {
    if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation();
    if (input.action(code) === 'shell' && !engine!._web_menu()) { showShell(); return; }
    if (suspended) { if (code === 'Enter' && !event.repeat) resume(); return; }
    engine!._web_audio();
    if (engine!._web_menu()) {
      if (event.repeat) return;
      const action = engine!._web_text() ? undefined : input.action(code);
      const key = menuCodes[code] ?? (action === 'menu' ? 27 : action === 'back' ? 127 : event.key.length === 1 ? event.key.toLowerCase().charCodeAt(0) : undefined);
      if (key !== undefined && key < 256) tap(key, event.key.length === 1 ? event.key.charCodeAt(0) : key);
      return;
    }
    if (event.repeat) return;
    input.press(code); updateInput();
    return;
  }
  const target = event.target as HTMLElement;
  if (target instanceof HTMLInputElement && target.type === 'number' && !panel.hidden) {
    if (code === 'Enter') {
      event.preventDefault();
      const fields = [...panel.querySelectorAll<HTMLElement>('input,button,select')];
      fields[(fields.indexOf(target) + 1) % fields.length]?.focus();
      return;
    }
    if (code === 'Escape' || code === 'KeyV') { event.preventDefault(); showHome(); return; }
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
  if (code === 'ArrowDown' || code === 'ArrowUp') {
    event.preventDefault();
    const container = panel.hidden ? home : panel;
    const items = [...container.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')];
    const idx = items.indexOf(document.activeElement as HTMLElement), delta = code === 'ArrowDown' ? 1 : -1;
    items[(idx + delta + items.length) % items.length]?.focus();
  } else if (!panel.hidden && ['Escape', 'Backspace', 'KeyV'].includes(code)) { event.preventDefault(); showHome(); }
}, true);
window.addEventListener('keyup', event => {
  input.release(event.code);
  if (engine) event.stopImmediatePropagation();
  if (running && !game.hidden) { if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation(); updateInput(); }
}, true);
window.addEventListener('keypress', event => { if (engine) event.stopImmediatePropagation(); }, true);
window.addEventListener('blur', suspend);
window.addEventListener('pagehide', () => { suspend(); sync().catch(error); });
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
function watchMenu() {
  if (engine && running) {
    const now = !!engine._web_menu();
    if (now !== previousMenu) { reset(); previousMenu = now; }
  }
  requestAnimationFrame(watchMenu);
}
requestAnimationFrame(watchMenu);
el('play').onclick = () => { start().catch(error); };
el('load').onclick = () => { start(true).catch(error); };
el('content').onclick = () => { content().catch(error); };
el('import').onclick = () => el<HTMLInputElement>('wadFile').click();
el('settings').onclick = configure; el('controls').onclick = controls;
el('saves').onclick = () => { saves().catch(error); };
el('resumeButton').onclick = resume;
el<HTMLInputElement>('wadFile').onchange = async event => {
  const target = event.target as HTMLInputElement;
  try { if (target.files?.[0]) await importWad(target.files[0]); } catch (e) { error(e); } finally { target.value = ''; }
};
el<HTMLInputElement>('backupFile').onchange = async event => {
  const target = event.target as HTMLInputElement;
  try { if (target.files?.[0]) await importBackup(target.files[0]); } catch (e) { error(e); } finally { target.value = ''; }
};
async function checkOffline() {
  try {
    const response = await fetch('./offline-index.json');
    if (!response.ok) throw new Error('Build offline indisponível');
    const { version, resources } = await response.json();
    const cache = await caches.open(`doom-${encodeURIComponent(new URL('./', location.href).pathname)}-${version}`);
    const all = (await Promise.all((resources as string[]).map(path => cache.match(new URL(path, location.href).href)))).every(Boolean);
    el('offline').textContent = all && navigator.serviceWorker.controller ? 'Preparado para offline neste contexto · confirme reabrindo sem rede.' : 'Preparação offline incompleta. Mantenha esta página aberta com conexão.';
  } catch { el('offline').textContent = 'Preparação offline não confirmada. Reabra com conexão para preparar.'; }
}
async function init() {
  try {
    settings = sanitizeSettings(await read('settings')); input = new InputState(settings.bindings);
    wads = await read<Wad[]>('wads') ?? []; selected = await read<string>('selected') ?? 'freedoom';
    if (selected !== 'freedoom' && !wads.some(w => w.id === selected)) { selected = 'freedoom'; say('IWAD anterior ausente; Freedoom selecionado.'); }
    else say('Pronto. Enter em Jogar inicia Freedoom ou o IWAD selecionado.');
    initialized = true;
    home.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; });
    if (document.activeElement === document.body) el('play').focus();
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch (e) { error(e); }
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      await navigator.serviceWorker.ready;
      navigator.serviceWorker.addEventListener('controllerchange', () => { checkOffline().catch(error); });
      if (swRegistration.waiting) say('Atualização pronta. Feche todas as abas do jogo para ativá-la.');
      await checkOffline();
    } catch { el('offline').textContent = 'Service Worker não disponível; offline não confirmado.'; }
  }
  if (!starting && !running && (document.activeElement === document.body || document.activeElement === el('play'))) el('play').focus();
}
init().catch(error);
