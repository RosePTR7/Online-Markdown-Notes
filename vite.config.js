import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  // 后续部署GitHub Pages要改成 /你的仓库名/，先留空
  base: './',
  plugins: [
    vue(), UnoCSS()],
})