import { createApp } from 'vue'
import App from './App.vue'
// UnoCSS全局样式
import 'virtual:uno.css'
// Vditor编辑器样式
import 'vditor/dist/index.css'
// 代码高亮样式
import 'highlight.js/styles/github.css'

createApp(App).mount('#app')