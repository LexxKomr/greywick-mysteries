import { defineConfig } from 'vite';

// base './' — игра работает из любой подпапки (GitHub Pages, Яндекс Игры).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5173, strictPort: true },
});
