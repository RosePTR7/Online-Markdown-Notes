<template>
  <div v-if="loading" class="w-full h-screen flex items-center justify-center text-lg text-gray-500">
    笔记加载中...
  </div>
  <div v-else class="h-screen flex flex-col overflow-hidden bg-slate-50 font-['system-ui','-apple-system','PingFang SC','Microsoft YaHei',sans-serif]">
    <!-- 顶部导航栏 -->
    <div class="flex items-center border-b border-slate-200 bg-white pl-10 pr-4 py-2 gap-10 shrink-0">
      <span class="font-bold text-slate-800 text-xl">在线Markdown笔记</span>
      <div class="flex-1"></div>
      <button class="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded shrink-0" @click="showSetting=true">AI配置</button>
    </div>

    <!-- 主体两栏布局 -->
    <div class="flex flex-1 overflow-hidden mt-3">
      <!-- 左侧侧边栏 -->
      <Sidebar />

      <!-- 右侧编辑器区域 -->
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

let saveTimer = null
const DEBOUNCE_DELAY = 2000
let originContent = ''
const isUnsaved = ref(false)

// 抽取独立保存逻辑
const runSaveLogic = () => {
  if (!currentNote.value) return
  updateNote(currentNote.value.id, { content: editorContent.value })
  originContent = editorContent.value
  isUnsaved.value = false
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

// 切换笔记
watch(currentNote, (note) => {
  flushSave()
  if (note) {
    editorContent.value = note.content
    originContent = note.content
    isUnsaved.value = false
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