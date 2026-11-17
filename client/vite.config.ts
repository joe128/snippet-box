import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:5000' }
  },
  build: {
    outDir: 'build',
    sourcemap: false,
    // highlight.js is lazy-loaded in its own chunk
    chunkSizeWarningLimit: 1000
  }
});
