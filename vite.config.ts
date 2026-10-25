import { defineConfig } from 'vite';
export default defineConfig({
  root: 'web', base: './', publicDir: 'generated',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' }
});
