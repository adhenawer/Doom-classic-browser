// SPDX-License-Identifier: GPL-2.0-or-later
export const defaults: Record<string, string[]> = {
  forward: ['KeyW', 'ArrowUp'], backward: ['KeyS', 'ArrowDown'],
  strafeLeft: ['KeyA'], strafeRight: ['KeyD'],
  turnLeft: ['ArrowLeft'], turnRight: ['ArrowRight'],
  fire: ['ControlLeft', 'KeyJ'], run: ['ShiftLeft', 'ShiftRight'],
  use: ['Space', 'KeyE'], next: ['KeyQ'], previous: ['KeyR'],
  map: ['Tab', 'KeyM'], menu: ['Escape', 'KeyP'], back: ['Backspace', 'KeyV'],
  save: ['F2', 'KeyK'], load: ['F3', 'KeyL'], shell: ['F10', 'KeyH']
};
export const engineKeys: Record<string, number> = {
  forward: 119, backward: 115, strafeLeft: 97, strafeRight: 100,
  fire: 106, run: 182, use: 32, next: 113, previous: 114,
  map: 9, menu: 27, back: 127, save: 188, load: 189
};
export class InputState {
  held = new Set<string>();
  private virtual = new Map<string, Set<string>>();
  setActions(source: string, actions: string[]) {
    if (actions.length) this.virtual.set(source, new Set(actions));
    else this.virtual.delete(source);
  }
  constructor(public bindings: Record<string, string[]> = structuredClone(defaults)) {}
  press(code: string) { this.held.add(code); }
  release(code: string) { this.held.delete(code); }
  clear() { this.held.clear(); this.virtual.clear(); }
  active(action: string) { return (this.bindings[action]?.some(k => this.held.has(k)) ?? false) || [...this.virtual.values()].some(actions => actions.has(action)); }
  action(code: string) { return Object.keys(this.bindings).find(a => this.bindings[a].includes(code)); }
  remap(action: string, code: string) {
    if (!Object.hasOwn(defaults, action)) throw new Error('Ação desconhecida');
    if (!/^(Key[A-Z]|Digit[1-7]|Arrow(Up|Down|Left|Right)|Space|Tab|Escape|Backspace|ControlLeft|ShiftLeft|ShiftRight|F([1-9]|1[0-2]))$/.test(code)) throw new Error('Tecla não suportada');
    if (/^(Digit[1-7])$/.test(code)) throw new Error('1–7 são reservados para armas');
    const conflict = Object.entries(this.bindings).find(([a, keys]) => a !== action && keys.includes(code));
    if (conflict) throw new Error(`Tecla já usada: ${conflict[0]}`);
    this.bindings[action] = [code];
    this.clear();
  }
}
export function validateBindings(raw: unknown) {
  const result = structuredClone(defaults);
  if (!raw || typeof raw !== 'object') return result;
  const candidate = raw as Record<string, unknown>;
  const used = new Set<string>();
  for (const action of Object.keys(defaults)) {
    const keys = candidate[action];
    if (!Array.isArray(keys) || keys.length < 1 || keys.length > 3 || keys.some(k => typeof k !== 'string')) return structuredClone(defaults);
    for (const key of keys) {
      if (used.has(key) || !/^(Key[A-Z]|Arrow(Up|Down|Left|Right)|Space|Tab|Escape|Backspace|ControlLeft|ShiftLeft|ShiftRight|F([1-9]|1[0-2]))$/.test(key)) return structuredClone(defaults);
      used.add(key);
    }
    result[action] = keys;
  }
  return result;
}
