<template>
  <div v-if="loading" class="w-full h-screen flex items-center justify-center text-lg text-gray-500">
    笔记加载中...
  </div>
    <div v-else class="h-screen flex overflow-hidden bg-slate-50 ...">    <!-- 左侧：标题 + 侧边栏 -->
    <div class="flex flex-col bg-white shrink-0 overflow-hidden" :style="{ width: sidebarWidth + 'px' }">
      <!-- 标题 -->
      <div class="px-4 py-3 border-b border-slate-200">
        <span class="font-bold text-slate-800 text-xl">在线Markdown笔记</span>
      </div>
      <!-- 分隔线 -->
      <div class="h-px bg-slate-200"></div>
      <!-- 侧边栏 -->
      <Sidebar />
    </div>

    <!-- 分界线（可拖拽） -->
    <div
      class="w-0.5 bg-slate-400 shrink-0 cursor-col-resize hover:bg-indigo-500 active:bg-indigo-600 transition-colors"
      @mousedown="startResize"
    ></div>

    <!-- 右侧：编辑器区域 -->
    <div class="flex-1 flex flex-col overflow-hidden pl-2">
      <!-- 编辑器区域（包含顶部工具栏） -->
      <EditorArea
        ref="editorAreaRef"
        v-model="editorContent"
        :isUnsaved="isUnsaved"
      />
    </div>

    <!-- AI配置弹窗 -->
    <div v-if="showSetting" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white p-5 rounded w-96">
        <h3 class="text-lg font-bold mb-3 text-slate-800">AI接口配置</h3>
        <div class="mb-2">
          <label class="text-slate-700">API BaseURL</label>
          <input v-model="aiConfig.baseUrl" class="w-full border border-slate-300 p-2 mt-1 rounded outline-none focus:border-indigo-400"/>
        </div>
        <div class="mb-3">
          <label class="text-slate-700">API Key</label>
          <input v-model="aiConfig.apiKey" class="w-full border border-slate-300 p-2 mt-1 rounded outline-none focus:border-indigo-400"/>
        </div>
        <div class="flex justify-end gap-2">
          <button class="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700" @click="showSetting=false">取消</button>
          <button class="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded" @click="saveAiConfig()">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useNoteStore } from './stores/useNoteStore'
import Sidebar from './components/Sidebar.vue'
import EditorArea from './components/EditorArea.vue'

const noteStore = useNoteStore()
const {
  aiConfig, currentNote,
  loadNotes, loadAiConfig, updateNote, saveAiConfig
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
})

const showSetting = ref(false)
const editorContent = ref('')

// 打开查找/替换悬浮窗口
const openFindReplace = (mode) => {
  editorAreaRef.value?.openFindReplacePanel(mode)
}

// 查找替换（供悬浮窗口调用）
const findKeyword = ref('')
const replaceKeyword = ref('')
const findCount = ref(null)

const doFind = () => {
  findCount.value = editorAreaRef.value?.handleFind(findKeyword.value) ?? 0
}
const doReplace = () => {
  editorAreaRef.value?.handleReplace(findKeyword.value, replaceKeyword.value)
  doFind()
}

// 主题模式
const themeMode = ref('light')

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