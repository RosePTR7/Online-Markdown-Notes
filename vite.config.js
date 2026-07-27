import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  base: '/Online-Markdown-Notes/',
  plugins: [
    vue(), UnoCSS()
  ],
})
