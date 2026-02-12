import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
      },
    ]),
    renderer(),
    // file:// プロトコルでcrossoriginが動かない問題の対策
    {
      name: 'remove-crossorigin',
      enforce: 'post' as const,
      transformIndexHtml(html: string) {
        return html.replace(/ crossorigin/g, '')
      },
    },
  ],
  base: './',
  build: {
    outDir: 'dist',
  },
})
