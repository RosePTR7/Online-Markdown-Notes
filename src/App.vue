<template>
  <div v-if="loading" class="w-full h-screen flex items-center justify-center text-lg text-gray-500">
    笔记加载中...
  </div>
  <div v-else class="h-screen flex overflow-hidden bg-slate-50 font-['system-ui','-apple-system','PingFang SC','Microsoft YaHei',sans-serif]">
    <!-- 左侧：标题 + 侧边栏 -->
    <div class="flex flex-col bg-white shrink-0">
      <!-- 标题 -->
      <div class="px-4 py-3 border-b border-slate-200">
        <span class="font-bold text-slate-800 text-xl">在线Markdown笔记</span>
      </div>
      <!-- 侧边栏 -->
      <Sidebar />
    </div>

    <!-- 分界线 -->
    <div class="w-1 bg-slate-600 shrink-0"></div>

    <!-- 右侧：按钮 + 编辑器区域 -->
    <div class="flex-1 flex flex-col overflow-hidden pl-2">
      <!-- 按钮栏 -->
      <div class="flex items-center px-3 py-2 border-b border-slate-200 bg-white shrink-0">
        <div class="flex items-center gap-2">
          <div class="relative" ref="editMenuRef">
            <button class="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded" @click="togglePanel('edit')">编辑</button>
            <!-- 编辑下拉菜单 -->
            <div v-if="activePanel === 'edit'" class="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-lg py-1 z-50 w-36">
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700" @click="handleUndo()">撤销</div>
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700" @click="handleRedo()">恢复</div>
              <div class="border-t border-slate-200 my-1"></div>
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700" @click="openFindReplace('find')">查找</div>
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700" @click="openFindReplace('replace')">替换</div>
            </div>
          </div>
          <div class="relative" ref="viewMenuRef">
            <button class="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded" @click="togglePanel('view')">查看</button>
            <!-- 查看下拉菜单 -->
            <div v-if="activePanel === 'view'" class="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-lg py-1 z-50 w-36">
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700" @click="themeMode = 'light'">☀️ 亮色</div>
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700" @click="themeMode = 'dark'">🌙 暗色</div>
            </div>
          </div>
        </div>
        <div class="flex-1"></div>
        <button class="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded" @click="showSetting=true">AI配置</button>
      </div>

      <!-- 编辑器区域 -->
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
  document.removeEventListener('click', closePanelOnClickOutside)
})

const showSetting = ref(false)
const editorContent = ref('')

// ==========编辑/查看面板==========
const activePanel = ref(null) // 'edit' | 'view' | null
const editMenuRef = ref(null)
const viewMenuRef = ref(null)

const togglePanel = (panel) => {
  activePanel.value = activePanel.value === panel ? null : panel
}

// 点击外部关闭菜单
const closePanelOnClickOutside = (e) => {
  if (activePanel.value === 'edit' && editMenuRef.value && !editMenuRef.value.contains(e.target)) {
    activePanel.value = null
  } else if (activePanel.value === 'view' && viewMenuRef.value && !viewMenuRef.value.contains(e.target)) {
    activePanel.value = null
  }
}
document.addEventListener('click', closePanelOnClickOutside)
// 打开查找/替换悬浮窗口
const openFindReplace = (mode) => {
  activePanel.value = null
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