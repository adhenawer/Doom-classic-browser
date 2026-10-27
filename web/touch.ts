// SPDX-License-Identifier: GPL-2.0-or-later
export type ControlMode = 'auto' | 'mobile' | 'desktop';
export function detectTouch(coarse: boolean, touchPoints: number, touchEvents = false) {
  return coarse && (touchPoints > 0 || touchEvents);
}
export class TouchControls {
  readonly root = document.createElement('div');
  private pointers = new Map<number, { node: HTMLElement; source: string; x: number; y: number }>();
  private state = '';
  constructor(host: HTMLElement, private actions: (source: string, actions: string[]) => void,
    private command: (key: number | 'shell') => void, private saveName: (name: string) => void, private beforeInput: () => void = () => {}, private audioGesture: () => void = () => {}) {
    this.root.id = 'touchControls'; this.root.hidden = true;
    this.root.innerHTML = `
      <div class="touch-toolbar"><button data-command="shell">Interface</button><button data-command="27">Menu</button></div>
      <div class="touch-play">
        <div class="touch-stick move-stick" data-stick="move" role="group" aria-label="Mover e deslocar lateralmente"><span>MOVER</span><i></i></div>
        <div class="touch-stick look-stick" data-stick="look" role="group" aria-label="Girar horizontalmente"><span>GIRAR ↔</span><i></i></div>
        <button data-hold="fire" class="touch-fire">ATIRAR</button>
        <div class="touch-actions"><button data-hold="use">Usar</button><button data-hold="run">Correr</button><button data-hold="previous">Arma −</button><button data-hold="next">Arma +</button><button data-hold="map">Mapa</button><button data-key="188">Salvar</button><button data-key="189">Carregar</button></div>
      </div>
      <div class="touch-menu" hidden><div class="touch-directions"><button data-command="173">↑</button><button data-command="172">←</button><button data-command="175">↓</button><button data-command="174">→</button></div><div><button data-command="13">Confirmar</button><button data-command="127">Voltar</button><button data-command="121">Sim</button><button data-command="110">Não</button></div></div>
      <form class="touch-name" hidden><label>Nome do save<input aria-label="Nome do save" maxlength="20" autocomplete="off" autocapitalize="characters"></label><button type="submit">Salvar nome</button><button type="button" data-command="27">Cancelar</button></form>
      <p class="touch-orientation">Para mais espaço, gire o aparelho para paisagem.</p>`;
    host.append(this.root);
    // Touch activation belongs to the end of the gesture, not pointerdown or
    // pointermove. Use touchend for Safari even when pointer capture is active.
    this.root.addEventListener('touchend', e => { if (e.isTrusted) this.audioGesture(); }, {passive: true});
    this.root.addEventListener('pointerup', e => { if (e.isTrusted && e.pointerType !== 'touch') this.audioGesture(); });
    this.root.addEventListener('contextmenu', e => e.preventDefault());
    this.root.addEventListener('pointerdown', e => {
      this.beforeInput();
      const node = (e.target as HTMLElement).closest<HTMLElement>('[data-stick],[data-hold]');
      if (!node || this.pointersHas(node)) return;
      e.preventDefault(); node.setPointerCapture(e.pointerId);
      const box = node.getBoundingClientRect();
      const source = `touch:${e.pointerId}`;
      this.pointers.set(e.pointerId, { node, source, x: box.left + box.width / 2, y: box.top + box.height / 2 });
      node.classList.add('pressed'); this.move(e);
    });
    this.root.addEventListener('pointermove', e => this.move(e));
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.root.addEventListener(name, e => this.release((e as PointerEvent).pointerId));
    }
    this.root.addEventListener('click', e => {
      const node = (e.target as HTMLElement).closest<HTMLElement>('[data-command],[data-key]');
      if (node) this.command(node.dataset.command === 'shell' ? 'shell' : Number(node.dataset.command ?? node.dataset.key));
      // Keyboard activation is supported alongside pointer holds.
      const hold = (e.target as HTMLElement).closest<HTMLElement>('[data-hold]');
      if (hold && e.detail === 0) {
        const key: Record<string, number> = { fire: 106, use: 32, run: 182, previous: 114, next: 113, map: 9 };
        this.command(key[hold.dataset.hold!]);
      }
    });
    this.root.querySelector('form')!.addEventListener('submit', e => {
      e.preventDefault(); const field = this.root.querySelector('input')!;
      const name = field.value.trim().toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, 20);
      if (name) this.saveName(name);
    });
  }
  private pointersHas(node: HTMLElement) { return [...this.pointers.values()].some(p => p.node === node); }
  private move(e: PointerEvent) {
    this.beforeInput();
    const p = this.pointers.get(e.pointerId); if (!p) return;
    e.preventDefault();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    const actions: string[] = [];
    if (p.node.dataset.hold) actions.push(p.node.dataset.hold);
    else {
      const dead = p.node.clientWidth * .12;
      if (p.node.dataset.stick === 'move') {
        if (Math.abs(dx) > dead) actions.push(dx < 0 ? 'strafeLeft' : 'strafeRight');
        if (Math.abs(dy) > dead) actions.push(dy < 0 ? 'forward' : 'backward');
      } else if (Math.abs(dx) > dead) actions.push(dx < 0 ? 'turnLeft' : 'turnRight');
      const knob = p.node.querySelector<HTMLElement>('i')!;
      const limit = p.node.clientWidth * .3, length = Math.max(1, Math.hypot(dx, dy) / limit);
      knob.style.transform = `translate(${dx / length}px, ${dy / length}px)`;
    }
    this.actions(p.source, actions);
  }
  private release(id: number) {
    const p = this.pointers.get(id); if (!p) return;
    this.pointers.delete(id); this.actions(p.source, []); p.node.classList.remove('pressed');
    const knob = p.node.querySelector<HTMLElement>('i'); if (knob) knob.style.transform = '';
    if (p.node.hasPointerCapture(id)) p.node.releasePointerCapture(id);
  }
  clear() { for (const id of [...this.pointers.keys()]) this.release(id); }
  update(enabled: boolean, menu: boolean, text: boolean) {
    const state = `${enabled}/${menu}/${text}`;
    if (state === this.state) return;
    this.state = state; this.clear(); this.root.hidden = !enabled;
    this.root.querySelector<HTMLElement>('.touch-play')!.hidden = menu;
    this.root.querySelector<HTMLElement>('.touch-menu')!.hidden = !menu || text;
    this.root.querySelector<HTMLElement>('.touch-name')!.hidden = !text;
    if (text) this.root.querySelector('input')!.value = '';
  }
}
