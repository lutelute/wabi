import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isWeb = process.env.VITE_WEB_MODE === 'true'

export default defineConfig(async () => {
  const plugins: any[] = [react(), tailwindcss()]

  if (!isWeb) {
    const electron = (await import('vite-plugin-electron')).default
    const renderer = (await import('vite-plugin-electron-renderer')).default
    plugins.push(
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
    )
  }

  return {
    plugins,
    base: isWeb ? '/wabi/' : './',
    build: {
      outDir: 'dist',
    },
  }
})
