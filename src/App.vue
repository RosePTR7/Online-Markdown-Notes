<template>
  <div v-if="loading" class="w-full h-screen flex items-center justify-center text-lg" :class="isDark ? 'text-slate-400 bg-slate-900' : 'text-gray-500 bg-white'">
    笔记加载中...
  </div>
  <div v-else class="h-screen flex overflow-hidden transition-colors duration-300" :class="isDark ? 'bg-slate-900' : 'bg-slate-50'">
    <!-- 左侧：标题 + 侧边栏 -->
    <div class="flex flex-col shrink-0 overflow-hidden transition-colors duration-300" :class="isDark ? 'bg-slate-800' : 'bg-white'" :style="{ width: sidebarWidth + 'px' }">
      <!-- 标题 -->
      <div class="px-4 py-3 border-b transition-colors duration-300" :class="isDark ? 'border-slate-700' : 'border-slate-200'">
        <span class="font-bold text-xl transition-colors duration-300" :class="isDark ? 'text-slate-100' : 'text-slate-800'">在线Markdown笔记</span>
      </div>
      <!-- 分隔线 -->
      <div class="h-px transition-colors duration-300" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'"></div>
      <!-- 侧边栏 -->
      <Sidebar />
    </div>

    <!-- 分界线（可拖拽） -->
    <div
      class="w-0.5 shrink-0 cursor-col-resize hover:bg-indigo-500 active:bg-indigo-600 transition-colors"
      :class="isDark ? 'bg-slate-600' : 'bg-slate-400'"
      @mousedown="startResize"
    ></div>

    <!-- 右侧：编辑器区域 -->
    <div class="flex-1 flex flex-col overflow-hidden pl-2">
      <!-- 编辑器区域（包含顶部工具栏） -->
      <EditorArea
        ref="editorAreaRef"
        v-model="editorContent"
        :isUnsaved="isUnsaved"
        @undo="handleUndo"
        @redo="handleRedo"
        @set-theme="handleSetTheme"
      />
    </div>

  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, provide } from 'vue'
import { useNoteStore } from './stores/useNoteStore'
import Sidebar from './components/Sidebar.vue'
import EditorArea from './components/EditorArea.vue'

const noteStore = useNoteStore()
const {
  aiConfig, currentNote,
  loadNotes, loadAiConfig, updateNote
} = noteStore

let loading = ref(true)
const editorAreaRef = ref(null)

// ==========侧边栏宽度拖拽==========
const sidebarWidth = ref(240) // 默认宽度 240px (w-60)
const MIN_SIDEBAR_WIDTH = 240 // 最小宽度限制，防止分界线侵入侧边栏内容
const MAX_SIDEBAR_WIDTH = 500
let isResizing = false

const startResize = (e) => {
  isResizing = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const handleResize = (e) => {
  if (!isResizing) return
  const newWidth = e.clientX
  if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
    sidebarWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

let saveTimer = null
const DEBOUNCE_DELAY = 2000
let originContent = ''
const isUnsaved = ref(false)

// ==========撤销/恢复历史管理==========
const MAX_HISTORY = 50
// 每个笔记的保存历史: { noteId: { history: [content1, content2, ...], currentIndex: number } }
const saveHistoryMap = ref({})

// 初始化笔记历史
const initNoteHistory = (noteId, initialContent) => {
  if (!saveHistoryMap.value[noteId]) {
    saveHistoryMap.value[noteId] = {
      history: [initialContent],
      currentIndex: 0
    }
  }
}

// 记录保存点
const pushSavePoint = (noteId, content) => {
  if (!noteId) return
  const noteHistory = saveHistoryMap.value[noteId]
  if (!noteHistory) {
    saveHistoryMap.value[noteId] = { history: [content], currentIndex: 0 }
    return
  }
  // 如果当前不在末尾，截断后面的历史
  noteHistory.history = noteHistory.history.slice(0, noteHistory.currentIndex + 1)
  // 添加新的保存点
  noteHistory.history.push(content)
  // 限制历史长度
  if (noteHistory.history.length > MAX_HISTORY) {
    noteHistory.history.shift()
  } else {
    noteHistory.currentIndex++
  }
}

// 撤销
const handleUndo = () => {
  if (!currentNote.value) return
  const noteId = currentNote.value.id
  const noteHistory = saveHistoryMap.value[noteId]
  if (!noteHistory || noteHistory.currentIndex <= 0) return
  
  noteHistory.currentIndex--
  const prevContent = noteHistory.history[noteHistory.currentIndex]
  editorContent.value = prevContent
  originContent = prevContent
  isUnsaved.value = false
  // 更新编辑器
  editorAreaRef.value?.setContent(prevContent)
}

// 恢复
const handleRedo = () => {
  if (!currentNote.value) return
  const noteId = currentNote.value.id
  const noteHistory = saveHistoryMap.value[noteId]
  if (!noteHistory || noteHistory.currentIndex >= noteHistory.history.length - 1) return
  
  noteHistory.currentIndex++
  const nextContent = noteHistory.history[noteHistory.currentIndex]
  editorContent.value = nextContent
  originContent = nextContent
  isUnsaved.value = false
  // 更新编辑器
  editorAreaRef.value?.setContent(nextContent)
}

// 抽取独立保存逻辑
const runSaveLogic = () => {
  if (!currentNote.value) return
  updateNote(currentNote.value.id, { content: editorContent.value })
  originContent = editorContent.value
  isUnsaved.value = false
  // 记录保存点
  pushSavePoint(currentNote.value.id, editorContent.value)
}

// 切换笔记/关闭页面触发强制保存
const flushSave = () => {
  if (saveTimer) {
    runSaveLogic()
    clearTimeout(saveTimer)
    saveTimer = null
  } else {
    if (isUnsaved.value) {
      runSaveLogic()
    }
  }
}

onMounted(async () => {
  try {
    await loadNotes()
    await loadAiConfig()
  } finally {
    loading.value = false
  }
  window.addEventListener('beforeunload', flushSave)
})

onBeforeUnmount(() => {
  flushSave()
  window.removeEventListener('beforeunload', flushSave)
  mediaQuery.removeEventListener('change', handleSystemThemeChange)
})

const editorContent = ref('')

// 主题模式 - 从 localStorage 读取，默认为 'light'
// 支持 'light' | 'dark' | 'system'
const themeMode = ref(localStorage.getItem('themeMode') || 'light')
const isDark = ref(false)
const systemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)

// 监听系统主题变化
const handleSystemThemeChange = (e) => {
  systemDark.value = e.matches
  // 如果当前是跟随系统模式，更新 isDark
  if (themeMode.value === 'system') {
    isDark.value = e.matches
  }
}

// 初始化系统主题监听
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
mediaQuery.addEventListener('change', handleSystemThemeChange)

// 监听主题变化
watch(themeMode, (newVal) => {
  // 持久化主题设置
  localStorage.setItem('themeMode', newVal)
  
  if (newVal === 'system') {
    // 跟随系统
    isDark.value = systemDark.value
  } else {
    isDark.value = newVal === 'dark'
  }
}, { immediate: true })

// 设置主题
const handleSetTheme = (mode) => {
  themeMode.value = mode
}

// 提供主题给子组件
provide('themeMode', themeMode)
provide('isDark', isDark)

// 切换笔记
watch(currentNote, (note) => {
  flushSave()
  // 关闭查找/替换面板
  editorAreaRef.value?.closeFindPanel()
  if (note) {
    editorContent.value = note.content
    originContent = note.content
    isUnsaved.value = false
    // 初始化该笔记的历史记录
    initNoteHistory(note.id, note.content)
  } else {
    editorContent.value = ''
    originContent = ''
    isUnsaved.value = false
  }
})

// 编辑器输入监听
watch(editorContent, (newVal) => {
  clearTimeout(saveTimer)
  if (!currentNote.value) return

  if (newVal !== originContent) {
    isUnsaved.value = true
    saveTimer = setTimeout(() => {
      runSaveLogic()
      saveTimer = null
    }, DEBOUNCE_DELAY)
  } else {
    isUnsaved.value = false
  }
})
</script>

<style>
html, body {
  padding: 0;
  margin: 0;
}
</style>