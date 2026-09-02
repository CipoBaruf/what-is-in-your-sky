import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// PLAN §11: Vite + plugin-react, ES2022 output. Our own worker and code-splitting
// arrive with R5 and R15. Worker chunks are ES modules: satellite.js 7 ships an
// optional WASM/pthreads build whose worker entry uses top-level await, which the
// default IIFE worker format rejects (the build is never loaded; we do not call
// `createWasmModule`).
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022' },
  worker: { format: 'es' },
});
