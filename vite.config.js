import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// USE ONE of these two lines ↓↓↓
// const base = '/CalPointsTool/'  // when using the GitHub Pages URL
const base = '/'                   // when using a custom domain

export default defineConfig({
  base,
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
