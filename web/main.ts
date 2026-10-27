// SPDX-License-Identifier: GPL-2.0-or-later
/// <reference types="vite/client" />
import './style.css';
import {requestGameAudio} from './audio';
import {LoadingScreen} from './loading';
import {MapContent, loadContentIndex, type ContentFS} from './map-content';
import modernHud from '../engine/modern-hud.lua?raw';
import { InputState, engineKeys } from './input';
import { TouchControls, detectTouch, type ControlMode } from './touch';
import { baseSettings as gameplayDefaults, sanitizeSettings as sanitizeGameplay, turnPresets, applyTurnPreset, selectedTurnPreset, gameplayProfile, type GameplaySettings, type TurnPreset } from './preferences';
import { Presentation, sanitizePresentation, type PresentationSettings } from './presentation';
import { validateWad, wadHash, MAX_WAD } from './wad';
import { read, write, remove } from './storage';
import { engineProfiles, backupProfiles, modernBackupProfiles, modernContent, modernSizes, sanitizeModernSize, highConfig, sanitizeResolution, saveDirectory, validateSavePath, validateBackupProfiles, type Resolution, type ModernSize } from './engine-profile';

type Wad = { id: string; name: string; bytes: number };
type Settings = GameplaySettings & PresentationSettings & { resolution: Resolution; modernSize: ModernSize; modernHD: boolean; modernHUD: 'overlay'|'classic' };
type FS = ContentFS & {
  mkdirTree(p: string): void; mount(type: unknown, options: object, p: string): void;
  filesystems: { IDBFS: unknown }; syncfs(populate: boolean, cb: (e?: Error) => void): void;
  writeFile(p: string, data: Uint8Array | string, options?: {canOwn?: boolean}): void; readFile(p: string): Uint8Array;
  readdir(p: string): string[]; stat(p: string): { mode: number }; isDir(mode: number): boolean; unlink(p: string): void;
};
type Engine = { retryMapPreparation?: () => void; FS: FS; callMain(args: string[]): void; _web_key(k: number, d: number, c: number): void;
  _web_rotate(l: number, r: number): void; _web_reset(): void; _web_suspend(v: number): void;
  _web_comfort(v: number): void; _web_mix(sfx: number, music: number): void;
  _web_menu(): number; _web_text(): number; _web_audio(): number; _web_state(n: number): number;
  _web_config(a: number,b: number,c: number,d: number,e: number): void;
};
declare global { interface Window {
  createDoom?: (options: object) => Promise<Engine>;
  createDoomHigh?: (options: object) => Promise<Engine>;
  createDoomModern?: (options: object) => Promise<Engine>;
  doom?: Engine; doomPresentation?: Presentation; doomTraceModern?: boolean;
} }
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const shell = el('shell'), game = el('game'), panel = el('panel'), home = el('home');
const canvas = el<HTMLCanvasElement>('canvas'), status = el('status');
const loading = new LoadingScreen(el('loadingScreen'));
el('loadingBack').onclick = () => {
  if (mapPreparing) { loading.begin(); engine?.retryMapPreparation?.(); return; }
  loading.finish(); showShell();
};
const baseSettings: Settings = { ...gameplayDefaults, ...sanitizePresentation(undefined), resolution: 'classic', modernSize: '1920', modernHD: true, modernHUD: 'overlay' };
const presentation = new Presentation(canvas, game);
window.doomPresentation = presentation;
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
let originalMap: { name: string; sha256: string; bytes: number } | undefined;
let localDoomAvailable = false;
const localDoomHash = '6fdf361847b46228cfebd9f3af09cd844282ac75f3edbb61ca4cb27103ce2e7f';
let queuedLoad = false, graphicsLost = false;
let mapPreparing = false, preparedMap = '', selectingSlot = false;
let mapContent: MapContent | undefined;
let activeResolution: Resolution | undefined;
let activeModernSize: ModernSize | undefined, activeModernHD: boolean | undefined, activeModernHUD: Settings['modernHUD'] | undefined;
const profileName = (r: Resolution) => r === 'modern' ? 'Moderno HD · EDGE-Classic' : r === 'high' ? 'Alta · Crispy Doom' : 'Clássica · Chocolate Doom';
const needsRestart = () => running && (settings.resolution !== activeResolution || (activeResolution === 'modern' && (settings.modernSize !== activeModernSize || settings.modernHD !== activeModernHD || settings.modernHUD !== activeModernHUD)));
function dimensions(r: Resolution): readonly number[] { return r === 'modern' ? modernSizes[settings.modernSize] : [engineProfiles[r].width,engineProfiles[r].height]; }
let remapping: string | undefined, previousMenu = false;
let sent = new Set<number>(), activeSavePath = '', syncQueue = Promise.resolve();
let settingsSaveGeneration = 0;
let swRegistration: ServiceWorkerRegistration | undefined;
let offlineFailure='';
function offlineFailed(name='') {
  offlineFailure=`Preparação offline falhou${name ? ' ('+name.slice(0,40)+')' : ''}. Use uma janela normal, confira conexão e espaço disponível e reabra para preparar novamente.`;
  el('offline').textContent=offlineFailure;
}
let initialized = false;
const say = (message: string) => {
  status.textContent = message;
  if (starting || mapPreparing) { el('launchStatus').hidden = false; el('launchStatus').textContent = message; loading.stage(message); }
};
let controlMode: ControlMode = 'auto';
let controlExperienceState = '', saveGeneration = 0;
try { const saved = localStorage.getItem('doom-control-mode'); if (saved === 'mobile' || saved === 'desktop') controlMode = saved; } catch { /* Storage can be unavailable. */ }
const coarsePointer = matchMedia('(pointer: coarse)');
const mobileControls = () => controlMode === 'mobile' || (controlMode === 'auto' && detectTouch(coarsePointer.matches, navigator.maxTouchPoints, 'ontouchstart' in window));
const touch = new TouchControls(game, (source, actions) => {
  if (mapPreparing || !running || suspended || game.hidden || engine?._web_menu()) return;
  input.setActions(source, actions); updateInput();
}, key => {
  if (mapPreparing || !running || suspended || game.hidden) return;
  if (engine) requestGameAudio(engine);
  if (key === 'shell') showShell();
  else { reset(); tap(key); }
}, name => {
  if (mapPreparing || !engine?._web_text() || suspended) return;
  reset(); const generation = saveGeneration;
  const keys: [number, number][] = Array.from({length:24}, () => [127, 127]);
  for (const character of name) keys.push([character.toLowerCase().charCodeAt(0), character.charCodeAt(0)]);
  keys.push([13, 13]);
  const send = async () => {
    for (let offset = 0; offset < keys.length; offset += 8) {
      if (generation !== saveGeneration || suspended || !engine?._web_text()) return;
      const tic = engine._web_state(0);
      for (const [key, character] of keys.slice(offset, offset + 8)) tap(key, character);
      // Keep touch name entry responsive by yielding between bounded event batches.
      do { await new Promise(resolve => setTimeout(resolve, 35)); }
      while (generation === saveGeneration && !suspended && engine._web_state(0) === tic);
    }
    canvas.focus();
  };
  send().catch(error);
}, reconcileMenuState, () => {
  if (!mapPreparing && running && !suspended && !game.hidden && !document.hidden && engine) requestGameAudio(engine);
});
function updateControlExperience() {
  if (mapPreparing) return;
  const mobile = mobileControls();
  const state = `${mobile}/${game.hidden}/${running}/${suspended}/${matchMedia('(orientation: portrait)').matches}/${engine?._web_menu()}/${engine?._web_text()}`;
  if (state === controlExperienceState) return;
  controlExperienceState = state;
  el('rotatePrompt').hidden = !(mobile && !game.hidden && matchMedia('(orientation: portrait)').matches);
  document.documentElement.dataset.controls = mobile ? 'mobile' : 'desktop';
  el('deviceExperience').textContent = mobile ? 'Touch + teclado · paisagem' : 'Teclado · sem controles na tela';
  el('resumeInstruction').textContent = mobile ? 'Toque em Retomar para entrar e ativar o áudio.' : 'Pressione Enter para entrar e ativar o áudio.';
  el('resumeButton').textContent = mobile ? 'Retomar partida' : 'Enter para retomar ↵';
  el('resumeGuide').textContent = mobile ? 'Jogue na horizontal. Esquerda: mover e atirar. Direita: mantenha deslocado para girar e use os demais botões para interagir. Teclado também funciona.' : 'WASD mover · ← → girar · J atirar · E interagir · P menu · H interface. Seus remapeamentos continuam ativos.';
  touch.update(mobile && running && !suspended && !game.hidden, !!engine?._web_menu(), !!engine?._web_text());
}
coarsePointer.addEventListener('change', () => { reset(); updateControlExperience(); });
window.addEventListener('resize', () => {
  touch.clear();
  if (mobileControls() && matchMedia('(orientation: portrait)').matches && running && !game.hidden) suspend();
});
updateControlExperience();

const error = (e: unknown) => { say(`Erro: ${e instanceof Error ? e.message : String(e)}`); console.error(e); };
function sanitizeSettings(raw: unknown): Settings {
  const resolution = raw && typeof raw === 'object' ? sanitizeResolution((raw as Record<string, unknown>).resolution) : 'classic';
  const value = raw && typeof raw === 'object' ? raw as Record<string,unknown> : {};
  return { ...sanitizeGameplay(raw), ...sanitizePresentation(raw), resolution, modernSize: sanitizeModernSize(value.modernSize), modernHD: value.modernHD !== false, modernHUD: value.modernHUD === 'classic' ? 'classic' : 'overlay' };
}
function updateSummary() {
  const name = selected === 'freedoom' ? 'Freedoom Phase 1' : selected === originalMap?.sha256 ? originalMap.name : wads.find(w => w.id === selected)?.name ?? 'Conteúdo indisponível';
  shell.dataset.gameplayProfile = gameplayProfile(settings);
  if (el('selectedContent')) el('selectedContent').textContent = name;
  const runKeys = input.bindings.run.every(key => key.startsWith('Shift')) ? 'Shift' : input.bindings.run.map(keyLabel).join(' / ');
  const resolution = running ? activeResolution! : settings.resolution;
  const size = running ? [engine!._web_state(17),engine!._web_state(18)] : dimensions(resolution);
  shell.dataset.resolution = resolution;
  const response = settings.alwaysRun ? `Conforto · ${runKeys} para caminhar` : `Clássico · ${runKeys} para correr`;
  const pending = needsRestart() ? ' · mudança agendada' : '';
  if (el('profileSummary')) el('profileSummary').textContent = `${resolution === 'modern' ? 'Moderno HD · ' : ''}${response} · ${size[0]}×${size[1]} · ${resolution === 'modern' ? 'GPU' : 'Software'}${pending}`;
}
function applyConfig(mix = false) {
  engine?._web_config(settings.initial, settings.acceleration, settings.maximum, settings.sensitivity, settings.deceleration);
  engine?._web_comfort(+settings.alwaysRun);
  if (mix) engine?._web_mix(settings.sfxVolume, settings.musicVolume);
  presentation.apply(settings); updateSummary();
}
async function saveSettings() {
  const generation = ++settingsSaveGeneration;
  settings.bindings = structuredClone(input.bindings);
  say('Armazenando configurações…');
  await write('settings', structuredClone(settings)); applyConfig(true);
  if (generation === settingsSaveGeneration) say('Configurações armazenadas neste navegador.');
}
function reset() {
  if (mapPreparing) { input.clear(); sent.clear(); return; }
  saveGeneration++; touch.clear();
  // Preserve complete down/up pairs if a DOM event was queued before a menu
  // transition but has not reached the next engine tic yet.
  for (const key of sent) engine?._web_key(key,0,key);
  input.clear(); sent.clear(); engine?._web_reset();
}
function traceModern(event: string) {
  if (mapPreparing || !window.doomTraceModern || activeResolution !== 'modern') return;
  console.info('[modern-host]', event, JSON.stringify({at:performance.now(),suspended,starting,queuedLoad,gameHidden:game.hidden,state:engine?[0,1,26,27,28,29,30,31,32,33].map(n=>engine!._web_state(n)):null}));
}
function suspend(focusResume = true) {
  if (mapPreparing || !engine || !running) return;
  reset(); engine._web_suspend(1); suspended = true; presentation.setActive(false);
  el('resume').hidden = false; updateControlExperience(); traceModern('suspended');
  if (focusResume && !document.hidden && !game.hidden) { traceModern('suspend-before-focus'); el('resumeButton').focus(); traceModern('suspend-after-focus'); }
}
function resume() {
  if (mapPreparing || !engine || !running || (mobileControls() && matchMedia('(orientation: portrait)').matches)) return;
  if (mobileControls()) {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
    orientation?.lock?.('landscape').catch(() => { /* Browser may require installed PWA/fullscreen. */ });
  }
  if (graphicsLost) { game.hidden=true; shell.hidden=false; restartResolution(); return; }
  traceModern('resume-before');
  reset(); applyConfig(); requestGameAudio(engine); engine._web_suspend(0);
  suspended = false; el('resume').hidden = true;
  shell.hidden = true; game.hidden = false; presentation.setActive(true); canvas.focus(); updateControlExperience();
  if (queuedLoad) { queuedLoad = false; console.info('[doom-host] queued load resumed', activeResolution, engine._web_state(0)); traceModern('load-key-before'); tap(189); traceModern('load-key-posted'); }
  traceModern('resume-return');
}
function showShell() {
  traceModern('shell-before');
  // This transition focuses the launcher, not the intermediate resume overlay.
  suspend(false); traceModern('shell-after-suspend');
  game.hidden = true; shell.hidden = false; traceModern('shell-visible');
  if (engine && running) {
    settings.sfxVolume = engine._web_state(15); settings.musicVolume = engine._web_state(16);
    write('settings', settings).catch(error);
  }
  traceModern('shell-volumes-read'); showHome(); traceModern('shell-home-focused');
  if (presentation.diagnostics().message) say(presentation.diagnostics().message);
}
function showHome() {
  panel.hidden = true; panel.replaceChildren(); home.hidden = false; remapping = undefined;
  el('play').textContent = running ? 'Retomar partida' : 'Jogar'; updateSummary(); el('play').focus();
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
  if (originalMap) paragraph('Estação Aurora tem uma fase original, criada com recursos livres. Após a saída, a campanha continua com mapas de Freedoom.');
  const select = async (id: string, name: string) => {
    selected = id; await write('selected', selected); updateSummary(); say(`Selecionado: ${name}`); content();
  };
  button(`${selected === 'freedoom' ? '✓ ' : ''}Freedoom Phase 1 · conteúdo livre`, () => select('freedoom', 'Freedoom Phase 1'));
  if (originalMap) {
    button(`${selected === originalMap.sha256 ? '✓ ' : ''}${originalMap.name} · mapa original`, async () => {
      await select(originalMap!.sha256, originalMap!.name);
    });
  }
  if (localDoomAvailable && !wads.some(w => w.id === localDoomHash)) {
    button('The Ultimate Doom · 4 episódios · arquivo local', async () => {
      const response = await fetch('./__local-doom.wad');
      if (!response.ok) throw new Error('DOOM.WAD local indisponível.');
      const data = await response.arrayBuffer();
      if (await wadHash(data) !== localDoomHash) throw new Error('DOOM.WAD local com SHA-256 inesperado.');
      await importWad(new File([data], 'The Ultimate Doom.wad'));
    });
  }
  for (const item of wads.filter(w => w.id !== originalMap?.sha256)) {
    button(`${selected === item.id ? '✓ ' : ''}${item.name}`, async () => { selected = item.id; await write('selected', selected); updateSummary(); say(`Selecionado: ${item.name}`); content(); });
  }
  for (const item of wads.filter(w => w.id !== originalMap?.sha256)) button(`Remover conteúdo: ${item.name}`, () => {
    showPanel('Remover IWAD'); paragraph(`Remover ${item.name} deste navegador? Preserve sua cópia em um arquivo local. Saves e a partida ativa serão mantidos.`);
    button('Confirmar remoção', async () => {
      wads = wads.filter(w => w.id !== item.id); await write('wads', wads); await remove('wad:' + item.id);
      if (selected === item.id) { selected = 'freedoom'; await write('selected', selected); }
      updateSummary(); say('IWAD removido do armazenamento local.'); content();
    }); button('Cancelar', content); panel.querySelector<HTMLElement>('button')?.focus();
  });
  back();
}
function controls() {
  showPanel('Controles');
  paragraph('Partida: WASD + setas. Enter confirma. P abre o menu, M abre o mapa, K salva, L carrega e H volta à interface. Nos menus do motor: Y confirma perguntas e N cancela. Para nomear saves, digite e confirme com Enter.');
  paragraph('Touch: joystick esquerdo move e desloca lateralmente; mantenha o controle direito deslocado para girar. Tiro, usar e correr podem ser segurados junto do movimento. O giro tem zona morta e usa a resposta configurada do teclado. Sem mira vertical, pulo ou recarga manual.');
  const label = document.createElement('label'); label.textContent = 'Experiência de controles';
  const mode = document.createElement('select'); mode.id = 'controlMode';
  for (const [value, text] of [['auto', 'Automática · detectar dispositivo'], ['mobile', 'Mobile · touch e teclado'], ['desktop', 'Teclado · sem controles na tela']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; mode.append(option);
  }
  mode.value = controlMode; mode.onchange = () => {
    reset(); controlMode = mode.value as ControlMode;
    try { localStorage.setItem('doom-control-mode', controlMode); } catch { /* Keep in-memory selection. */ }
    updateControlExperience();
  };
  label.append(mode); panel.append(label);
  paragraph('Escolha uma ação para remapear. Escape cancela a captura. Teclas reservadas pelo sistema podem não chegar ao aplicativo.');
  for (const [action, keys] of Object.entries(input.bindings)) {
    const b = button(`${actionLabels[action]}: ${keys.map(keyLabel).join(' / ')}`, () => { reset(); remapping = action; b.textContent = `${actionLabels[action]}: pressione uma tecla…`; });
    b.dataset.action = action;
  }
  button('Restaurar controles padrão', async () => { input = new InputState(); await saveSettings(); controls(); }); back();
}
function restartResolution() {
  showPanel('Aplicar resolução');
  const size = dimensions(settings.resolution);
  paragraph(`A próxima partida usará ${size[0]}×${size[1]} internos (${profileName(settings.resolution)}). O aplicativo será reiniciado. Progresso que você não salvou no menu do DOOM será perdido.`);
  paragraph('Os saves são separados por motor. Alta copia os slots clássicos no primeiro perfil vazio. Moderno usa outro formato e inicia saves próprios, preservando os anteriores.');
  const apply = button('Aplicar resolução e reiniciar', async () => {
    if (apply.disabled) return;
    apply.disabled = true;
    try {
      if (running) { suspend(); await sync(); }
      await write('settings', settings); location.reload();
    } catch (e) { apply.disabled = false; throw e; }
  });
  if (running && !graphicsLost) button('Retomar resolução atual', resume);
  button('Voltar às configurações', configure); panel.querySelector<HTMLElement>('button')?.focus();
}
function configure() {
  traceModern('configure-before');
  showPanel('Configurações');
  paragraph('Ajuste giro, imagem e som. A resolução escolhe o motor da próxima partida, com saves separados e preservação dos originais.');
  const presets = document.createElement('div'); presets.className = 'preset-grid'; panel.append(presets);
  for (const [name, preset] of Object.entries(turnPresets)) {
    const b = button(preset.label, async () => {
      settings = applyTurnPreset(settings, name as TurnPreset); await saveSettings(); configure();
    });
    b.dataset.preset = name; b.title = preset.description;
    b.setAttribute('aria-pressed', String(selectedTurnPreset(settings) === name)); presets.append(b);
  }
  const heading = (text: string) => { const h = document.createElement('h3'); h.textContent = text; panel.append(h); };
  heading('Resposta do giro');
  const fields: [keyof Pick<Settings,'initial'|'acceleration'|'maximum'|'sensitivity'|'deceleration'>, string, number, number, number][] = [
    ['initial', 'Velocidade inicial (°/s)', 1, 360, 1], ['acceleration', 'Aceleração (°/s²)', 0, 2000, 10],
    ['maximum', 'Velocidade máxima (°/s)', 1, 720, 1], ['sensitivity', 'Sensibilidade', .1, 3, .1],
    ['deceleration', 'Desaceleração (°/s²; zero = parada imediata)', 0, 4000, 10]
  ];
  for (const [key, title, min, max, step] of fields) {
    const label = document.createElement('label'); label.textContent = title;
    const field = document.createElement('input'); field.type = 'number'; field.min = `${min}`; field.max = `${max}`; field.step = `${step}`; field.value = `${settings[key]}`; field.dataset.setting = key;
    label.append(field); panel.append(label);
  }
  heading('Movimento');
  const runLabel = document.createElement('label');
  const run = document.createElement('input'); run.type = 'checkbox'; run.checked = settings.alwaysRun; run.dataset.setting = 'alwaysRun';
  const runKeys = input.bindings.run.every(key => key.startsWith('Shift')) ? 'Shift' : input.bindings.run.map(keyLabel).join(' / ');
  runLabel.append(run, ` Correr continuamente · ${runKeys} para caminhar`); panel.append(runLabel);
  paragraph('WASD move, setas giram, J atira e E abre portas. Auto-aim vertical e física clássica preservados.');
  heading('Resolução interna');
  const resolutionLabel = document.createElement('label'); resolutionLabel.textContent = 'Resolução do motor';
  const resolution = document.createElement('select'); resolution.dataset.setting = 'resolution';
  for (const [value,text] of [['classic','Clássica · 320×200 · Chocolate Doom'],['high','Alta · 640×400 · Crispy Doom · 4× pixels'],['modern','Moderno HD · WebGL2 · EDGE-Classic']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; resolution.append(option);
  }
  resolution.value = settings.resolution; resolutionLabel.append(resolution); panel.append(resolutionLabel);
  paragraph('Moderno renderiza a geometria na GPU em resolução ajustável e usa o pacote Freedoom HD 4× quando compatível. A exibição mantém 4:3; trocar motor, resolução moderna ou texturas exige reiniciar.');
  const modernLabel = document.createElement('label'); modernLabel.textContent = 'Resolução moderna · pixels quadrados em 4:3';
  const modernSize = document.createElement('select'); modernSize.dataset.setting = 'modernSize';
  for (const [key,size] of Object.entries(modernSizes)) { const option=document.createElement('option'); option.value=key; option.textContent=`${size[0]}×${size[1]}`; modernSize.append(option); }
  modernSize.value=settings.modernSize; modernLabel.append(modernSize); panel.append(modernLabel);
  const hdLabel=document.createElement('label'), hd=document.createElement('input'); hd.type='checkbox'; hd.checked=settings.modernHD; hd.dataset.setting='modernHD'; hdLabel.append(hd,' Texturas Freedoom HD · 4× e materiais 4K · perfil Moderno'); panel.append(hdLabel);
  const hudLabel=document.createElement('label'); hudLabel.textContent='HUD moderno';
  const hud=document.createElement('select'); hud.dataset.setting='modernHUD';
  for(const [value,text] of [['overlay','Contemporâneo · integrado à cena'],['classic','Barra clássica do DOOM']]){const option=document.createElement('option'); option.value=value; option.textContent=text; hud.append(option);}
  hud.value=settings.modernHUD; hudLabel.append(hud); panel.append(hudLabel);
  paragraph('Selecione a nitidez e o tamanho de imagem desejados. As opções mais altas exigem mais memória e processamento. As texturas HD são aplicadas ao Freedoom compatível.');
  if (running) {
    const active = [engine!._web_state(17),engine!._web_state(18)];
    paragraph(`Partida atual: ${active[0]}×${active[1]}. ${needsRestart() ? 'Há uma mudança de resolução agendada.' : 'Resolução selecionada em uso.'}`);
  }
  if (needsRestart()) button('Aplicar nova resolução', restartResolution);
  heading('Apresentação');
  const displayLabel = document.createElement('label'); displayLabel.textContent = 'Estilo da imagem';
  const display = document.createElement('select'); display.dataset.setting = 'presentation';
  for (const [value,text] of [['sharp',settings.resolution === 'modern' ? 'Nítido · imagem nativa da GPU' : 'Nítido · pixels clássicos'],['smooth','Suave · escala suavizada'],['crt','CRT · linhas e vinheta leves']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; display.append(option);
  }
  display.value = settings.presentation; displayLabel.append(display); panel.append(displayLabel);
  const numberField = (key: 'brightness'|'sfxVolume'|'musicVolume', text: string, min: number, max: number, step: number) => {
    const label = document.createElement('label'); label.textContent = text;
    const field = document.createElement('input'); field.type = 'number'; field.min = `${min}`; field.max = `${max}`; field.step = `${step}`;
    field.value = `${settings[key]}`; field.dataset.setting = key; label.append(field); panel.append(label);
  };
  numberField('brightness','Brilho da apresentação', .75, 1.35, .05);
  paragraph('Nítido e Suave apresentam a resolução escolhida. CRT é opcional e usa o modo nítido se o efeito estiver indisponível.');
  heading('Áudio');
  numberField('sfxVolume','Efeitos sonoros · 0 silencia',0,15,1);
  numberField('musicVolume','Música · 0 silencia',0,15,1);
  paragraph('Enter ao retomar tenta liberar o áudio. Som confirmado no browser não substitui o teste de escuta no seu dispositivo.');
  button('Salvar configurações', async () => {
    const next = { ...settings };
    panel.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-setting]').forEach(f => {
      const key = f.dataset.setting!;
      if (f instanceof HTMLSelectElement) {
        if (key === 'resolution') next.resolution = sanitizeResolution(f.value);
        else if (key === 'modernSize') next.modernSize = sanitizeModernSize(f.value);
        else if (key === 'modernHUD') next.modernHUD = f.value === 'classic' ? 'classic' : 'overlay';
        else next.presentation = f.value as Settings['presentation'];
      }
      else if (key === 'alwaysRun') next.alwaysRun = f.checked;
      else if (key === 'modernHD') next.modernHD = f.checked;
      else (next as unknown as Record<string, unknown>)[key] = f.valueAsNumber;
    });
    settings = sanitizeSettings(next); await saveSettings(); configure();
  });
  button('Restaurar experiência clássica', async () => {
    settings = { ...structuredClone(baseSettings), bindings: structuredClone(input.bindings) };
    await saveSettings(); configure();
  }); traceModern('configure-built'); back(); traceModern('configure-focused');
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
  paragraph('K salva e L carrega durante o jogo. Saves são separados por motor e SHA-256 do IWAD. Exporte backups: o navegador pode remover dados locais.');
  if (engine) {
    const saveFiles=listFiles().filter(p => validateSavePath(p,3));
    const shown=new Set<string>();
    for (const path of saveFiles) {
      const modern=path.includes('/saves-modern/'), group=modern ? path.slice(0,path.lastIndexOf('/')) : path;
      if(shown.has(group)) continue; shown.add(group);
      const members=modern ? saveFiles.filter(p=>p.startsWith(group+'/')) : [path];
      const engineLabel = modern ? 'Moderno HD' : path.includes('/saves-hires/') ? 'Alta' : 'Clássica';
      paragraph(`${engineLabel} · ${path.includes(activeSavePath + '/') ? 'Atual' : 'Outro perfil/IWAD'} · ${(modern ? group : path).split('/').slice(-2).join('/')}`);
      button(`Excluir ${engineLabel} · ${(modern ? group : path).split('/').slice(-2).join('/')}`, () => {
        showPanel('Excluir save'); paragraph(`Excluir o save ${engineLabel} · ${(modern ? group : path).split('/').slice(-2).join('/')}? Exporte um backup antes, se precisar preservá-lo.`);
        button('Confirmar exclusão', async () => { for (const member of members) engine!.FS.unlink(member); await sync(); say('Save excluído e remoção persistida.'); saves(); });
        button('Cancelar', saves); panel.querySelector<HTMLElement>('button')?.focus();
      });
    }
    button('Exportar backup de saves e configurações', async () => {
      await sync();
      const files = listFiles().filter(p => validateSavePath(p,3)).map(path => ({ path, data: btoa(Array.from(engine!.FS.readFile(path), b => String.fromCharCode(b)).join('')) }));
      const version=activeResolution === 'modern' || files.some(f=>f.path.includes('/saves-modern/')) ? 3 : 2;
      download('doom-backup.json', new Blob([JSON.stringify({ version, profiles: version === 3 ? modernBackupProfiles : backupProfiles, settings, files })], { type: 'application/json' }));
    });
  } else paragraph('Inicie o motor para acessar e exportar saves.');
  button('Importar backup', () => { if (!engine) throw new Error('Inicie uma partida primeiro e volte com H.'); el<HTMLInputElement>('backupFile').click(); });
  back();
}
async function importBackup(file: File) {
  if (!engine || file.size > 256 * 1024 * 1024) throw new Error('Backup indisponível ou maior que 256 MiB.');
  const raw = JSON.parse(await file.text());
  if (![1,2,3].includes(raw.version) || (raw.version !== 1 && !validateBackupProfiles(raw.profiles,raw.version)) || !Array.isArray(raw.files) || raw.files.length > (raw.version === 3 ? 3000 : 120)) throw new Error('Formato de backup inválido.');
  const checked = raw.files.map((f: {path: string; data: string}) => {
    if (!f || typeof f.path !== 'string' || !validateSavePath(f.path, raw.version) || typeof f.data !== 'string' || f.data.length > (raw.version === 3 ? 16 : 2) * 1024 * 1024) throw new Error('Caminho ou tamanho de save inválido.');
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
  updateSummary(); say(`IWAD validado e armazenado: ${item.name}`); content();
}
async function loadScript(resolution: Resolution) {
  const profile = engineProfiles[resolution];
  if (window[profile.factory]) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script'); script.src = new URL(profile.loader, location.href).href;
    script.onload = () => resolve(); script.onerror = () => { script.remove(); reject(new Error('Loader WASM ausente. Verifique a preparação offline ou selecione Clássica.')); }; document.head.append(script);
  });
}
// Runtime and catalog requests must use the document's active worker. A
// navigation can miss activate-time clients.claim(), even after ready resolves.
async function ensureRuntimeController() {
  if (import.meta.env.DEV) return;
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker necessário para preparar o jogo offline.');
  const serviceWorker = navigator.serviceWorker;
  const registration = await serviceWorker.register('./sw.js', { scope: './' });
  const scriptURL = new URL('./sw.js', location.href).href;
  const controlled = () => serviceWorker.controller?.scriptURL === scriptURL;
  if (controlled()) return;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const observed = new Set<ServiceWorker>();
    const cleanup = () => {
      clearTimeout(timer); clearInterval(retry);
      serviceWorker.removeEventListener('controllerchange', changed);
      serviceWorker.removeEventListener('message', failed);
      registration.removeEventListener('updatefound', observeInstall);
      for (const worker of observed) worker.removeEventListener('statechange', stateChanged);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; cleanup(); error ? reject(error) : resolve();
    };
    const changed = () => { if (controlled()) finish(); };
    const requestClaim = () => {
      if (settled) return;
      changed(); if (settled) return;
      // Never message waiting/installing workers or activate an update early.
      // The active worker serves both the catalog and all subsequent runtime requests.
      const active = registration.active;
      if (active?.state === 'activated') {
        try { active.postMessage({ type: 'doom-runtime-claim', entry: import.meta.url }); }
        catch { /* Activation can replace the worker between the state read and postMessage; retry the current active. */ }
      }
    };
    const stateChanged = () => {
      if (!registration.active && !registration.waiting && (!registration.installing || registration.installing.state === 'redundant'))
        finish(new Error('A instalação da interface offline falhou. Confira a conexão e o espaço disponível e tente novamente.'));
      else requestClaim();
    };
    const observeInstall = () => {
      const worker = registration.installing;
      if (worker && !observed.has(worker)) { observed.add(worker); worker.addEventListener('statechange', stateChanged); }
      stateChanged();
    };
    const failed = (event: MessageEvent) => {
      const source = event.source as ServiceWorker | null;
      if (source?.scriptURL === scriptURL && event.data?.type === 'doom-runtime-version-mismatch')
        finish(new Error('A página e a versão offline são diferentes. Feche as abas do jogo e reabra para concluir a atualização.'));
      if (source?.scriptURL === scriptURL && event.data?.type === 'doom-offline-error' && !registration.active)
        finish(new Error('A instalação da interface offline falhou. Confira a conexão e o espaço disponível e tente novamente.'));
    };
    const timer = setTimeout(() => {
      console.warn('[offline-controller] timeout', {
        active: registration.active?.state ?? 'none',
        installing: registration.installing?.state ?? 'none',
        waiting: registration.waiting?.state ?? 'none'
      });
      finish(new Error('Não foi possível preparar esta página. Confira a conexão, feche as abas do jogo e reabra para tentar novamente.'));
    }, 60000);
    const retry = setInterval(requestClaim, 1000);
    serviceWorker.addEventListener('controllerchange', changed);
    serviceWorker.addEventListener('message', failed);
    registration.addEventListener('updatefound', observeInstall);
    observeInstall();
    // ready alone does not establish control of a document that navigated during activation.
    void serviceWorker.ready.then(requestClaim, () => { /* State/error observers provide the failure diagnosis. */ });
  });
}

function mapProgress(progress: {completedBytes: number; totalBytes: number}) {
  loading.progress(progress.completedBytes, progress.totalBytes);
}
async function prepareRequestedMap(name: string) {
  if (!mapContent) return;
  mapPreparing = true;
  input.clear(); sent.clear(); touch.clear(); presentation.setActive(false);
  el('loadingBack').textContent = 'Tentar novamente';
  loading.begin(); say(`Preparando ${name} · qualidade integral…`);
  await mapContent.prepareMap(name, mapProgress);
  loading.indeterminate(); say(`${name} preparado. Abrindo a fase…`);
  // Keep inputs blocked until the native frame has finished, not just download.
}
function mapReady(name: string) {
  if (!mapPreparing) return;
  mapPreparing = false; preparedMap = name;
  el('loadingBack').textContent = 'Voltar à interface';
  el('offline').textContent = `${name} disponível offline neste contexto · outros mapas serão preparados ao entrar.`;
  if (running) {
    suspend(); loading.finish(); say(`${name} pronto. Retome a partida para ativar o áudio.`);
  }
}
async function migrateClassicSaves(hash: string) {
  if (!engine || activeResolution !== 'high') return;
  const fs = engine.FS, target = saveDirectory('high',hash), marker = `${target}/.classic-migration-v1`;
  if (fs.readdir(target).includes('.classic-migration-v1')) return;
  const existing = new Set(fs.readdir(target));
  const source = saveDirectory('classic',hash);
  let names: string[] = [];
  try { names = fs.readdir(source); } catch { /* No legacy profile for this IWAD. */ }
  if (!names.length || ![...existing].some(name => /^doomsav[0-5]\.dsg$/.test(name))) {
    for (const name of names.filter(name => /^doomsav[0-5]\.dsg$/.test(name))) {
      if (!existing.has(name)) fs.writeFile(`${target}/${name}`, fs.readFile(`${source}/${name}`));
    }
  }
  fs.writeFile(marker, engineProfiles.high.id); await sync();
}
async function chooseSavedSlot(): Promise<number | undefined> {
  // Select before callMain: -loadgame lets the native save header choose the
  // requested map without booting/downloading E1M1 just to open the load menu.
  const fs = engine!.FS, modern = activeResolution === 'modern';
  const slots: number[] = [];
  for (let slot = 0; slot < (modern ? 8 : 6); slot++) {
    const path = modern ? `${activeSavePath}/savegame/slot${String(slot).padStart(3, '0')}/head.esg` : `${activeSavePath}/doomsav${slot}.dsg`;
    try { if (fs.readFile(path).byteLength) slots.push(slot); } catch { /* Empty slot. */ }
  }
  loading.finish(); shell.hidden = false; game.hidden = true;
  selectingSlot = true; showPanel('Carregar partida');
  paragraph(slots.length ? 'Escolha um save deste conteúdo e perfil. Somente o mapa salvo será preparado.' : 'Nenhum save encontrado neste conteúdo e perfil.');
  return new Promise(resolve => {
    const select = (slot?: number) => { selectingSlot = false; showHome(); loading.begin(); resolve(slot); };
    for (const slot of slots) button(`Carregar slot ${slot + 1}`, () => select(slot));
    button('Iniciar nova partida', () => select());
    button('Voltar à interface', () => location.reload());
    panel.querySelector<HTMLButtonElement>('button')?.focus();
  });
}
async function start(load = false) {
  if (!initialized) { say('Aguarde a leitura do armazenamento local.'); return; }
  if (running) {
    if (needsRestart()) { restartResolution(); return; }
    resume(); if (load) tap(189); return;
  }
  if (starting) return;
  // A failed runtime must be replaced in a fresh document, never mounted twice.
  if (engine) { restartResolution(); return; }
  let completedModernTicks = 0, preparedModernPause = false;
  const playButton = el<HTMLButtonElement>('play'), playLabel = playButton.innerHTML;
  starting = true; playButton.disabled = true; playButton.textContent = 'Carregando…'; playButton.setAttribute('aria-busy','true');
  loading.begin(); say('Carregando o motor real…');
  el('launchStatus').scrollIntoView({block:'nearest'});
  try {
    await ensureRuntimeController();
    const catalog = await loadContentIndex();
    const builtinHash = selected === 'freedoom' ? modernContent.iwad : selected;
    const builtin = catalog.iwads[builtinHash];
    const custom = wads.find(w => w.id === selected);
    let data: ArrayBuffer | undefined, hash: string;
    if (builtin) {
      hash = builtinHash;
      mapContent = new MapContent(catalog, hash, settings.resolution === 'modern' && settings.modernHD && hash === modernContent.iwad);
    } else {
      if (!custom) throw new Error('IWAD selecionado não está armazenado.');
      data = await read<ArrayBuffer>('wad:' + custom.id);
      if (!data) throw new Error('Arquivo IWAD ausente. Importe-o novamente pelo seletor de arquivos.');
      validateWad(data); hash = await wadHash(data);
      if (hash !== custom.id) throw new Error('IWAD corrompido: SHA-256 divergente. Importe novamente.');
      mapContent = undefined;
    }
    activeResolution = settings.resolution; game.dataset.renderer=activeResolution; activeModernSize=settings.modernSize; activeModernHD=settings.modernHD; activeModernHUD=settings.modernHUD;
    await loadScript(activeResolution);
    let tracedFrames=0;
    engine = await window[engineProfiles[activeResolution].factory]!({ canvas, noInitialRun: true,
      traceModern:!!window.doomTraceModern,
      prepareMap: mapContent ? prepareRequestedMap : undefined,
      lazyImages: mapContent?.lazyImages,
      onMapReady: mapReady,
      onMapPreparationError: (reason: unknown, name: string) => {
        error(reason); loading.fail(`Não foi possível preparar ${name}. As partes concluídas estão preservadas. Confira a conexão e tente novamente.`);
      },
      onFrame: () => { presentation.frame(); if (++tracedFrames<=8) traceModern('frame-before-swap'); },
      onTickComplete: () => {
        if (activeResolution !== 'modern' || running || preparedModernPause || !engine) return;
        if (engine._web_state(0) <= 2 || engine._web_state(1) !== 0 || engine._web_state(33) !== 1 || engine._web_state(26) !== 0) { completedModernTicks = 0; return; }
        if (++completedModernTicks < 2) return;
        // Pause inside the completed-tick callback; polling must not freeze a later tick.
        engine._web_suspend(1); preparedModernPause = true;
        console.info('[doom-host] Modern ready at completed tick', engine._web_state(0));
        traceModern('prepared-tick-complete');
      },
      locateFile: (path: string) => new URL(path, location.href).href,
      print: (line: string) => console.info('[doom]', line), printErr: (line: string) => console.warn('[doom]', line),
      onAbort: (reason: string) => { showShell(); error(new Error(`Motor abortado: ${reason}. Recarregue para tentar novamente.`)); },
      onSaveWritten: () => { say('Persistindo save…'); sync().then(() => say('Save persistido em IndexedDB.')).catch(error); }
    });
    window.doom = engine;
    if(window.doomTraceModern&&activeResolution==='modern'){let samples=0;const probe=setInterval(()=>{traceModern('heartbeat');if(++samples>=180)clearInterval(probe);},1000);}
    engine.FS.mkdirTree('/persist'); engine.FS.mount(engine.FS.filesystems.IDBFS, {}, '/persist');
    await sync(true);
    activeSavePath = saveDirectory(activeResolution, hash); engine.FS.mkdirTree(activeSavePath);
    await migrateClassicSaves(hash);
    const loadSlot = load ? await chooseSavedSlot() : undefined;
    if (mapContent) await mapContent.initialize(engine.FS, mapProgress);
    else engine.FS.writeFile('/game.wad', new Uint8Array(data!), {canOwn:true});
    engine.FS.writeFile('/default.cfg', `mouse_sensitivity 0\nsfx_volume ${settings.sfxVolume}\nmusic_volume ${settings.musicVolume}\nshow_messages 1\nscreenblocks 10\ndetaillevel 0\n`);
    engine.FS.writeFile('/chocolate.cfg', 'fullscreen 0\nwindow_width 640\nwindow_height 480\naspect_ratio_correct 1\ninteger_scaling 0\nforce_software_renderer 0\nsnd_musicdevice 3\nsnd_sfxdevice 3\nsnd_samplerate 22050\nuse_mouse 0\ngrabmouse 0\nshow_endoom 0\nvanilla_savegame_limit 0\n' + (activeResolution === 'high' ? highConfig : ''));
    const displayGame = () => { shell.hidden=true; game.hidden=false; presentation.apply(settings); presentation.setActive(true); canvas.focus(); };
    const classicArgs = ['-iwad', '/game.wad', '-config', '/default.cfg', '-extraconfig', '/chocolate.cfg', '-savedir', activeSavePath + '/', '-nomouse', '-nojoystick', '-noautoload', ...(loadSlot === undefined ? ['-warp', '1', '1'] : ['-loadgame', String(loadSlot)]), '-skill', '3'];
    if (activeResolution === 'modern') {
      const hudPath='/edge_defs/scripts/lua/edge_hud.lua';
      const upstreamHud=new TextDecoder().decode(engine.FS.readFile(hudPath));
      // Preloaded support may be backed by read-only LZ4 nodes. Replace this
      // runtime's support node with the corresponding, locally bundled script.
      engine.FS.unlink(hudPath); engine.FS.writeFile(hudPath,upstreamHud+'\n'+modernHud);
      engine.FS.writeFile('/edge.cfg', `#VERSION 6\nsmoothing 1\ndetail_level 2\nmipmapping 2\nhq2x_scaling 2\nscreen_hud ${settings.modernHUD === 'overlay' ? 2 : 0}\n`);
      const modernArgs=['-game','/','-config','/edge.cfg','-home',activeSavePath,'-iwad','/game.wad','-width',modernSizes[settings.modernSize][0].toString(),'-height',modernSizes[settings.modernSize][1].toString(),'-windowed',...(loadSlot === undefined ? ['-warp','1'] : ['-loadgame', String(loadSlot)]),'-skill','3'];
      if (mapContent?.hd) modernArgs.push('-file', '/lazy-hd');
      loading.indeterminate(); say('Preparando o motor para carregar a fase solicitada…');
      displayGame(); engine.callMain(modernArgs);
    } else { displayGame(); engine.callMain(classicArgs); }
    await new Promise<void>((resolve, reject) => {
      const timeout=activeResolution === 'modern' ? 90000 : 45000;
      let until = performance.now() + timeout;
      const timer = setInterval(() => {
        if (mapPreparing) { until = performance.now() + timeout; return; }
        const levelReady = engine!._web_state(0) > 2 && engine!._web_state(1) === 0;
        const frameReady = activeResolution !== 'modern' || (preparedModernPause && engine!._web_state(33) === 1 && engine!._web_state(26) === 0);
        if (levelReady && frameReady) { clearInterval(timer); resolve(); }
        else if (performance.now() > until) { clearInterval(timer); reject(new Error('O motor não concluiu a abertura da fase. Reabra o aplicativo para tentar novamente; os arquivos já preparados foram preservados.')); }
      }, 50);
    });
    traceModern('ready-before-suspend');
    running = true; queuedLoad = false; applyConfig(true); suspend();
    loading.finish(); say('Motor pronto. Toque em Retomar ou pressione Enter.');
  } catch (e) { shell.hidden = false; game.hidden = true; error(e); loading.fail(status.textContent ?? 'Falha ao carregar.'); }
  finally { starting = false; playButton.disabled = false; playButton.innerHTML = playLabel; playButton.removeAttribute('aria-busy'); }
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
  if (selectingSlot && ['Escape', 'Backspace', 'KeyV'].includes(code)) {
    event.preventDefault(); event.stopImmediatePropagation(); location.reload(); return;
  }
  if (mapPreparing) {
    event.stopImmediatePropagation();
    if (event.cancelable) event.preventDefault();
    if (code === 'Enter' && !event.repeat && !el('loadingBack').parentElement!.hidden) el('loadingBack').click();
    return;
  }
  // Observe a native menu transition before accepting fresh physical input.
  // A later rAF reset must not erase a key pressed just after the menu closed.
  reconcileMenuState();
  if ((event.target as HTMLElement).closest?.('.touch-name')) {
    if (engine) event.stopImmediatePropagation();
    if (code === 'Escape') { event.preventDefault(); tap(27); canvas.focus(); }
    return;
  }
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
    requestGameAudio(engine!);
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
  if (!panel.hidden && (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === 'checkbox')) && ['Escape','Backspace','KeyV'].includes(code)) { event.preventDefault(); showHome(); return; }
  if (target instanceof HTMLInputElement && target.type === 'checkbox' && code === 'Enter') { event.preventDefault(); target.checked = !target.checked; return; }
  if (code === 'Enter' && (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement)) {
    // SDL's window handlers require capture interception. Activate HTML controls
    // explicitly rather than depending on WebKit's interrupted default key path.
    event.preventDefault();
    if (!event.repeat && !(target instanceof HTMLButtonElement && target.disabled)) {
      traceModern(`shell-enter:${target.id || target.tagName}`); target.click(); traceModern('shell-enter-dispatched');
    }
    return;
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
  if (mapPreparing) { event.stopImmediatePropagation(); input.release(event.code); return; }
  reconcileMenuState();
  input.release(event.code);
  if (engine) event.stopImmediatePropagation();
  if (running && !game.hidden) { if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation(); updateInput(); }
}, true);
window.addEventListener('keypress', event => { if (engine) event.stopImmediatePropagation(); }, true);
canvas.addEventListener('webglcontextlost', event => {
  if (activeResolution !== 'modern') return;
  event.preventDefault(); graphicsLost=true; suspend();
  say('Contexto WebGL2 perdido. O jogo foi suspenso; reabra o aplicativo para restaurar o renderer. Saves persistidos foram preservados.');
});
window.addEventListener('blur', () => suspend());
window.addEventListener('pagehide', () => { suspend(false); sync().catch(error); });
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
function reconcileMenuState() {
  if (mapPreparing) return;
  if (engine && running) {
    const now = !!engine._web_menu();
    if (now !== previousMenu) { previousMenu = now; reset(); }
  }
}
function watchMenu() {
  reconcileMenuState();
  updateControlExperience();
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
el('rotateHome').onclick = showShell;
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
    const name=`doom-shell-v1-${encodeURIComponent(new URL('./', location.href).pathname)}-${version}`;
    // The installing worker owns creation and population. A readiness query must
    // not create an empty same-name cache concurrently in another process.
    if (!navigator.serviceWorker.controller || !(await caches.keys()).includes(name)) {
      el('offline').textContent=offlineFailure || 'Preparando recursos para offline. Mantenha esta página aberta com conexão.';
      return;
    }
    const cache = await caches.open(name);
    // Read only request metadata. cache.match() may materialize a large body
    // in WebKit even when the caller only tests the Response's presence.
    const stored=new Set((await cache.keys()).map(request=>request.url));
    const all=(resources as string[]).every(path=>stored.has(new URL(path,location.href).href));
    el('offline').textContent = all && navigator.serviceWorker.controller ? (preparedMap ? `${preparedMap} disponível offline neste contexto.` : 'Interface disponível offline. Cada mapa será preparado ao entrar.') + (offlineFailure ? ' A atualização falhou; a versão atual está preservada.' : '') : offlineFailure || 'Preparação offline incompleta. Mantenha esta página aberta com conexão.';
  } catch { el('offline').textContent = 'Preparação offline não confirmada. Reabra com conexão para preparar.'; }
}
async function init() {
  try {
    const stored=await read('settings'); settings = sanitizeSettings(stored);
    if (!stored) settings.resolution='modern';
    input = new InputState(settings.bindings);
    wads = await read<Wad[]>('wads') ?? []; selected = await read<string>('selected') ?? 'freedoom';
    if (selected !== 'freedoom' && !wads.some(w => w.id === selected)) await ensureRuntimeController();
    if (selected !== 'freedoom' && !wads.some(w => w.id === selected) && !(await loadContentIndex()).iwads[selected]) { selected = 'freedoom'; say('IWAD anterior ausente; Freedoom selecionado.'); }
    else say('Pronto. Enter em Jogar inicia Freedoom ou o IWAD selecionado.');
    const mapDiscovery = new AbortController();
    const mapDiscoveryTimer = setTimeout(() => mapDiscovery.abort(), 3000);
    try {
      const response = await fetch('./aurora.json', { signal: mapDiscovery.signal });
      if (response.ok) {
        const value = await response.json();
        if (value.name === 'Estação Aurora' && /^[a-f0-9]{64}$/.test(value.sha256) && Number.isSafeInteger(value.bytes) && value.bytes > 12 && value.bytes <= MAX_WAD) originalMap = value;
      }
    } catch { /* Optional map metadata must not block existing content. */ }
    finally { clearTimeout(mapDiscoveryTimer); }
    if (import.meta.env.DEV) {
      try { localDoomAvailable = (await fetch('./__local-doom.wad', { method: 'HEAD' })).ok; }
      catch { localDoomAvailable = false; }
    }
    presentation.apply(settings); updateSummary();
    initialized = true;
    home.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; });
    if (document.activeElement === document.body) el('play').focus();
    if (navigator.storage?.persist) navigator.storage.persist().catch(()=>false);
  } catch (e) { error(e); }
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      const watchWorker = (worker: ServiceWorker | null) => {
        if (!worker) return;
        let activated=worker.state === 'activated';
        worker.addEventListener('statechange',()=>{
          if (worker.state === 'redundant' && !activated && !offlineFailure) offlineFailed();
          if (worker.state === 'activated') { activated=true; offlineFailure=''; checkOffline().catch(error); }
        });
      };
      watchWorker(swRegistration.installing);
      swRegistration.addEventListener('updatefound',()=>watchWorker(swRegistration!.installing));
      navigator.serviceWorker.addEventListener('controllerchange', () => { offlineFailure=''; checkOffline().catch(error); });
      // ready never rejects when the first worker fails installation. Observe it
      // without leaving initialization or the error indication pending forever.
      navigator.serviceWorker.ready.then(()=>checkOffline()).catch(()=>offlineFailed());
      if (swRegistration.waiting) say('Atualização pronta. Feche todas as abas do jogo para ativá-la.');
      await checkOffline();
    } catch { el('offline').textContent = 'Service Worker não disponível; offline não confirmado.'; }
  }
  if (!starting && !running && (document.activeElement === document.body || document.activeElement === el('play'))) el('play').focus();
}
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message',event=>{
  const worker=event.source as ServiceWorker | null;
  if (worker?.scriptURL !== new URL('./sw.js',location.href).href || event.data?.type !== 'doom-offline-error') return;
  offlineFailed(typeof event.data.name === 'string' ? event.data.name : '');
  checkOffline().catch(error);
});
init().catch(error);
