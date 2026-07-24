import { createApp } from 'vue'
import App from './App.vue'
import Vditor from 'vditor'
// UnoCSS全局样式
import 'virtual:uno.css'
// Vditor编辑器样式
import 'vditor/dist/index.css'
// 代码高亮样式 - 亮色主题（默认）
import 'highlight.js/styles/github.css'
// 代码高亮样式 - 暗色主题
import 'highlight.js/styles/github-dark.css'
// Vditor 暗色主题自定义样式
import './assets/vditor-dark.css'

createApp(App).mount('#app')
