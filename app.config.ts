import { defineConfig } from '@tanstack/react-start/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  tsr: { appDirectory: 'src' },
  server: { preset: 'vercel' },
  vite: {
    plugins: [tsconfigPaths(), tailwindcss()],
    server: { host: '0.0.0.0', port: 3000 },
  },
})
