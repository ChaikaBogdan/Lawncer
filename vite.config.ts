import { defineConfig } from 'vite'

export default defineConfig({
  base: '/Lawncer/',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
