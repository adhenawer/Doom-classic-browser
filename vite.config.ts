import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export default defineConfig({
  plugins: [{
    name: 'local-doom-wad',
    apply: 'serve',
    configureServer(server) {
      // Fixed local file only: never copied to dist or exposed by the preview server.
      const wadPath = resolve('work/DOOM.WAD');
      server.middlewares.use('/__local-doom.wad', async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.end(); return; }
        try {
          const data = await readFile(wadPath);
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Length', data.length);
          res.end(req.method === 'HEAD' ? undefined : data);
        } catch { res.statusCode = 404; res.end(); }
      });
    }
  }],
  root: 'web', base: './', publicDir: 'generated',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' }
});
