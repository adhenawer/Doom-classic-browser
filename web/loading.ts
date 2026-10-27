// SPDX-License-Identifier: GPL-2.0-or-later
export async function readPart(response: Response, target: Uint8Array<ArrayBuffer>, hash: string, progress: (bytes: number) => void, verifying: () => void = () => {}) {
  if (!response.ok) throw new Error('Download indisponível. Confira sua conexão e tente novamente.');
  let offset = 0;
  const reader = response.body?.getReader();
  try {
    if (reader) {
      while (true) {
        const {done,value} = await reader.read();
        if (done) break;
        if (offset + value.length > target.length) throw new Error('Parte HD maior que o tamanho esperado.');
        target.set(value,offset); offset += value.length; progress(offset);
      }
    } else {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== target.length) throw new Error('Parte HD incompleta.');
      target.set(bytes); offset = bytes.length; progress(offset);
    }
    if (offset !== target.length) throw new Error('Parte HD incompleta. Confira a conexão e tente novamente.');
    verifying();
    const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',target)), n => n.toString(16).padStart(2,'0')).join('');
    if (actual !== hash) throw new Error('Parte HD corrompida: SHA-256 divergente. Prepare novamente com conexão.');
  } catch (e) { await reader?.cancel().catch(()=>{}); throw e; }
  finally { reader?.releaseLock(); }
}

export class LoadingScreen {
  private started = 0;
  private timer?: ReturnType<typeof setInterval>;
  private lastUpdate = 0;
  private bytes = 0;
  private total = 0;
  private networkStart = 0;
  private networkBytes = 0;
  private source = '';
  private rendered = 0;
  constructor(private root: HTMLElement) {}
  private element<T extends HTMLElement>(name: string) { return this.root.querySelector<T>(`[data-loading="${name}"]`)!; }
  begin() {
    this.started = performance.now(); this.bytes = this.total = this.networkBytes = this.networkStart = 0;
    this.lastUpdate = this.started; this.source = '';
    this.root.hidden = false; this.element('progress').hidden = false;
    document.getElementById('shell')!.inert = true; document.getElementById('game')!.inert = true; this.root.focus({preventScroll:true});
    this.element('error').hidden = true;
    this.element('hint').textContent = 'Somente os recursos necessários ao mapa solicitado serão preparados, com qualidade integral. A próxima fase não será baixada antecipadamente.';
    this.stage('Preparando o jogo…');
    clearInterval(this.timer); this.timer = setInterval(()=>this.render(),1000); this.render();
  }
  stage(text: string) { this.element('stage').textContent = text; this.render(); }
  part(source: 'cache'|'network', completed: number, total: number) {
    this.source = source; this.bytes = completed; this.total = total;
    this.lastUpdate = performance.now();
    if (source === 'network' && !this.networkStart) this.networkStart = performance.now();
    let previous = 0;
    return (received: number) => {
      if (source === 'network') this.networkBytes += received - previous;
      previous = received; this.bytes = completed + received; this.lastUpdate = performance.now(); if (this.lastUpdate-this.rendered > 100) this.render();
    };
  }
  progress(completed: number, total: number) {
    this.bytes = completed; this.total = total; this.source = ''; this.lastUpdate = performance.now(); this.render();
  }
  indeterminate() { this.total = 0; this.source = ''; this.render(); }
  finish() {
    clearInterval(this.timer); this.root.hidden = true; document.getElementById('shell')!.inert = false;
    const game = document.getElementById('game')!; game.inert = false;
    if (!game.hidden) document.getElementById('resumeButton')!.focus();
  }
  fail(message: string) {
    clearInterval(this.timer); this.stage(message);
    this.element('error').hidden = false; this.root.querySelector<HTMLButtonElement>('button')!.focus();
    this.element('activity').textContent = 'O carregamento foi interrompido.';
    this.element('progress').hidden = true; this.element('amount').textContent = 'Preparação não concluída';
    this.element('hint').textContent = 'Não foi possível concluir. Confira a conexão e tente novamente. As partes verificadas já recebidas foram preservadas.';
  }
  private render() {
    const now = performance.now(); this.rendered = now;
    const elapsed = Math.floor((now-this.started)/1000);
    const progress = this.element<HTMLProgressElement>('progress');
    progress.max = 100;
    if (this.total) progress.value = this.bytes/this.total*100; else progress.removeAttribute('value');
    this.element('amount').textContent = this.total ? `${Math.floor(this.bytes/this.total*100)}% · ${(this.bytes/1e6).toFixed(1)} / ${(this.total/1e6).toFixed(1)} MB` : 'Aguarde a conclusão desta etapa';
    const rate = this.source === 'network' && this.networkStart && now-this.networkStart >= 2000 ? ` · ${(this.networkBytes/1e6/((now-this.networkStart)/1000)).toFixed(1)} MB/s de leitura em média` : '';
    this.element('detail').textContent = `${Math.floor(elapsed/60)}min ${elapsed%60}s decorridos${this.source === 'cache' ? ' · Lendo conteúdo neste aparelho' : rate}`;
    this.element('activity').textContent = this.total && now-this.lastUpdate > 12000 ? 'Aguardando progresso nesta etapa. O tempo depende da conexão e do processamento no aparelho.' : 'O jogo abrirá quando todas as etapas terminarem.';
  }
}
