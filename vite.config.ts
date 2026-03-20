import { resolve } from 'path'
import { defineConfig } from 'vite'
import { readdirSync } from 'fs'

const lessonDirs = readdirSync(resolve(__dirname, 'lessons'), { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)

const input: Record<string, string> = {
  main: resolve(__dirname, 'index.html'),
}
for (const dir of lessonDirs) {
  input[dir] = resolve(__dirname, `lessons/${dir}/index.html`)
}

export default defineConfig({
  build: { rollupOptions: { input } },
  optimizeDeps: {
    exclude: ['@world-editor/loader'],
  },
  resolve: {
    alias: {
      '@world-editor/loader': resolve(__dirname, '../packages/loader'),
    },
    dedupe: ['three'],
  },
})
