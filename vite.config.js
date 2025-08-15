import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const isGH = process.env.GITHUB_ACTIONS === 'true'  // true in GitHub Actions
export default defineConfig({
  base: isGH ? '/CalPointsTool/' : '/',             // Pages uses /<repo>/, local uses /
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
