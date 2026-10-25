// SPDX-License-Identifier: GPL-2.0-or-later
// Optional presentation of the real SDL framebuffer. No geometry or game rules change.
export const presentationModes = ['sharp', 'smooth', 'crt'] as const;
export type PresentationMode = typeof presentationModes[number];
export type PresentationSettings = { presentation: PresentationMode; brightness: number };
export function sanitizePresentation(raw: unknown): PresentationSettings {
  const value = raw && typeof raw === 'object' ? raw as Partial<PresentationSettings> : {};
  return {
    presentation: presentationModes.includes(value.presentation as PresentationMode) ? value.presentation! : 'sharp',
    brightness: typeof value.brightness === 'number' && Number.isFinite(value.brightness) ? Math.min(1.35, Math.max(.75, value.brightness)) : 1
  };
}
export type PresentationDiagnostics = {
  requested: PresentationMode; active: PresentationMode; frames: number;
  renderMs: { mean: number; p95: number }; message: string;
};
const vertex = `attribute vec2 position;
varying vec2 uv;
void main() { uv = (position + 1.0) * 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;
// Original, static low-strength effect. No flicker, warp, bloom or loss of HUD geometry.
const fragment = `precision mediump float;
varying vec2 uv;
uniform sampler2D frame;
void main() {
  vec3 color = texture2D(frame, uv).rgb;
  float scan = 0.97 + 0.03 * cos(uv.y * 200.0 * 6.2831853);
  vec2 centered = (uv - 0.5) * 2.0;
  float vignette = 1.0 - 0.045 * dot(centered, centered);
  gl_FragColor = vec4(color * scan * vignette, 1.0);
}`;
function summarize(samples: number[]) {
  if (!samples.length) return { mean: 0, p95: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  return { mean: samples.reduce((a,b) => a+b,0) / samples.length, p95: sorted[Math.min(sorted.length-1, Math.ceil(sorted.length*.95)-1)] };
}
export class Presentation {
  private mode: PresentationMode = 'sharp';
  private actual: PresentationMode = 'sharp';
  private brightness = 1;
  private active = false;
  private layer?: HTMLCanvasElement;
  private gl?: WebGLRenderingContext;
  private program?: WebGLProgram;
  private texture?: WebGLTexture;
  private buffer?: WebGLBuffer;
  private frameCount = 0;
  private samples: number[] = [];
  private message = '';
  private previous = { opacity: '', filter: '', imageRendering: '' };
  private lost = (event: Event) => { event.preventDefault(); this.fallback('Efeito CRT indisponível: contexto gráfico perdido. Modo nítido ativo.'); };
  constructor(private source: HTMLCanvasElement, private container: HTMLElement) {
    this.previous = { opacity: source.style.opacity, filter: source.style.filter, imageRendering: source.style.imageRendering };
  }
  apply(raw: unknown) {
    const settings = sanitizePresentation(raw);
    const modeChanged = settings.presentation !== this.mode;
    this.brightness = settings.brightness;
    if (modeChanged || !this.layer) {
      this.cleanup(); this.mode = settings.presentation; this.actual = this.mode;
      this.message = ''; this.frameCount = 0; this.samples = [];
      if (this.mode === 'crt') this.create();
    }
    this.source.style.imageRendering = this.actual === 'smooth' ? 'auto' : 'pixelated';
    this.source.style.filter = this.brightness === 1 ? '' : `brightness(${this.brightness})`;
    if (this.layer) this.layer.style.filter = this.source.style.filter;
    this.updateVisibility();
  }
  setActive(active: boolean) { this.active = active; this.updateVisibility(); }
  private updateVisibility() {
    // Keep the source visible until the first successful upload; never flash an empty layer.
    const shown = this.active && this.actual === 'crt' && this.frameCount > 0;
    this.source.style.opacity = shown ? '0' : this.previous.opacity;
    if (this.layer) this.layer.hidden = !shown;
  }
  private create() {
    let layer: HTMLCanvasElement | undefined;
    try {
      layer = document.createElement('canvas');
      layer.id = 'presentation'; layer.setAttribute('aria-hidden','true'); layer.tabIndex = -1;
      Object.assign(layer.style, { position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none', imageRendering:'auto', zIndex:'1' });
      layer.hidden = true;
      const gl = layer.getContext('webgl', { alpha:false, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:false });
      if (!gl) throw new Error('WebGL indisponível');
      // Register partial resources immediately so every failure path releases them.
      this.layer = layer; this.gl = gl;
      const compile = (kind: number, code: string) => {
        const shader = gl.createShader(kind); if (!shader) throw new Error('Shader indisponível');
        gl.shaderSource(shader,code); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Compilação do shader indisponível'); }
        return shader;
      };
      const v = compile(gl.VERTEX_SHADER, vertex);
      let f: WebGLShader | undefined;
      try {
        f = compile(gl.FRAGMENT_SHADER, fragment);
        const program = gl.createProgram(); if (!program) throw new Error('Programa gráfico indisponível');
        this.program = program; gl.attachShader(program,v); gl.attachShader(program,f); gl.linkProgram(program);
        if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Link do shader indisponível');
      } finally { gl.deleteShader(v); if (f) gl.deleteShader(f); }
      const program = this.program!;
      const texture = gl.createTexture(), buffer = gl.createBuffer();
      this.texture = texture ?? undefined; this.buffer = buffer ?? undefined;
      if (!texture || !buffer) throw new Error('Memória gráfica indisponível');
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program,'position');
      if (position < 0) throw new Error('Atributo de posição indisponível');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);
      gl.uniform1i(gl.getUniformLocation(program,'frame'),0);
      layer.addEventListener('webglcontextlost',this.lost);
      this.container.append(layer);
    } catch {
      this.fallback('Efeito CRT indisponível neste browser. Modo nítido ativo.');
    }
  }
  // Must run synchronously after SDL_RenderPresent, before the browser clears a
  // non-preserved WebGL drawing buffer. An unrelated rAF cannot safely capture it.
  frame() {
    if (!this.active || this.actual !== 'crt' || !this.gl || !this.layer || !this.texture || !this.source.width || !this.source.height) return;
    const gl = this.gl, layer = this.layer, start = performance.now();
    try {
      if (gl.isContextLost()) { this.fallback('Efeito CRT indisponível: contexto gráfico perdido. Modo nítido ativo.'); return; }
      if (layer.width !== this.source.width || layer.height !== this.source.height) {
        layer.width = this.source.width; layer.height = this.source.height;
      }
      gl.viewport(0,0,layer.width,layer.height);
      gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.source);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Upload gráfico indisponível');
      this.frameCount++; this.samples.push(performance.now()-start);
      if (this.samples.length > 180) this.samples.shift();
      this.updateVisibility();
    } catch { this.fallback('Efeito CRT indisponível ao apresentar o jogo. Modo nítido ativo.'); }
  }
  diagnostics(): PresentationDiagnostics {
    return { requested:this.mode, active:this.actual, frames:this.frameCount, renderMs:summarize(this.samples), message:this.message };
  }
  private fallback(message: string) {
    this.cleanup(); this.actual = 'sharp'; this.message = message;
    this.source.style.imageRendering = 'pixelated'; this.updateVisibility();
  }
  private cleanup() {
    this.source.style.opacity = this.previous.opacity;
    this.layer?.removeEventListener('webglcontextlost',this.lost);
    if (this.gl) {
      if (this.texture) this.gl.deleteTexture(this.texture);
      if (this.buffer) this.gl.deleteBuffer(this.buffer);
      if (this.program) this.gl.deleteProgram(this.program);
      this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.layer?.remove(); this.layer = undefined; this.gl = undefined;
    this.texture = undefined; this.buffer = undefined; this.program = undefined;
  }
  dispose() {
    this.cleanup(); this.active = false; this.mode = this.actual = 'sharp';
    Object.assign(this.source.style,this.previous);
  }
}
