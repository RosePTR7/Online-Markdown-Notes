<template>
  <div v-if="loading" class="w-full h-screen flex items-center justify-center text-lg" :class="isDark ? 'text-slate-400 bg-slate-900' : 'text-gray-500 bg-white'">
    笔记加载中...
  </div>
  <div v-else class="h-screen flex overflow-hidden transition-colors duration-300" :class="isDark ? 'bg-slate-900' : 'bg-slate-50'">
    <Sidebar :style="{ width: sidebarWidth + 'px' }" />
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
        @manual-save="handleManualSave"
      />
    </div>

    <!-- 全局模态框 -->
    <Modal />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, provide } from 'vue'
import { useNoteStore } from './stores/useNoteStore'
import { useFolderStore } from './stores/useFolderStore'
import { useSaveManager } from './stores/useSaveManager'
import Sidebar from './components/Sidebar.vue'
import EditorArea from './components/EditorArea.vue'
import Modal from './components/Modal.vue'

const noteStore = useNoteStore()
const folderStore = useFolderStore()
const saveManager = useSaveManager()
const {
  aiConfig, currentNote,
  loadNotes, loadAiConfig, loadAutoSave
} = noteStore
const { loadFolders } = folderStore

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

// 防抖时长由保存调度器（useSaveManager）统一管理；这里仅保留「当前激活笔记的原值」与未保存标记
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
  // 撤销产生一次改动：标记未保存即可，editorContent 变化已由下方 watch 走「按笔记独立的后台保存」
  isUnsaved.value = true
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
  isUnsaved.value = true
  // 更新编辑器
  editorAreaRef.value?.setContent(nextContent)
}

// 保存调度器初始化：注入真正的落盘函数与「落盘后」回调。
// - persist：调用 store.persistNote（本地写磁盘 / 在线写 Dexie），按 noteId 隔离。
// - afterSave：落盘成功后记录历史保存点；若是当前激活笔记，则刷新 originContent / 未保存标记。
// 这样「保存 + 计时器」从 App 抽离成可调用单元，且每篇笔记独立、切换不互相取消。
saveManager.initSaveManager({
  persist: (id, content) => noteStore.persistNote(id, content),
  afterSave: (id, content) => {
    pushSavePoint(id, content)
    if (id === currentNote.value?.id) {
      originContent = content
      isUnsaved.value = false
    }
  }
})

const handleBeforeUnload = () => { saveManager.flushAll() }

onMounted(async () => {
  try {
    await loadNotes()
    await loadFolders()
    await loadAiConfig()
    await loadAutoSave()
  } finally {
    loading.value = false
  }
  // beforeunload：尽力把所有脏笔记落盘（异步写盘，浏览器不保证 await，但有总比没有好）
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  // 卸载时同样尽力落盘全部脏笔记
  saveManager.flushAll()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('keydown', onKeydown)
  mediaQuery.removeEventListener('change', handleSystemThemeChange)
})

const editorContent = ref('')

// ==========手动保存（工具栏按钮 + 快捷键 Ctrl/Cmd+S）==========
// 强行打断该笔记未完成的防抖计时器并立即落盘：先 scheduleSave 把最新内容兜底写入 pending，
// 再 flushNote 清除 timer 并立即 persist（flushNote 内部已 clearTimeout + 立即 runSave）。
const handleManualSave = async () => {
  if (!currentNote.value) return
  const id = currentNote.value.id
  saveManager.scheduleSave(id, editorContent.value)
  await saveManager.flushNote(id)
}

// 全局快捷键：Ctrl+S（Mac 为 Cmd+S）。必须 preventDefault 阻止浏览器「保存网页」对话框。
const onKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    handleManualSave()
  }
}

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
  // 注意：此处不再 flush 旧笔记。按修复方案，旧笔记的预保存计时器在后台继续，
  // 切走不打断它——这正是根治「切换串味」的关键（每笔记独立、互不取消）。
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

// 编辑器输入监听：内容变化即把「当前笔记 + 最新内容」交给按 noteId 隔离的保存调度器。
// 调度器内部为每篇笔记独立防抖计时，切换笔记只会写入对应 noteId 的条目，互不串味。
watch(editorContent, (newVal) => {
  if (!currentNote.value) return

  if (newVal !== originContent) {
    isUnsaved.value = true
    // 即时把内存中的 note.content 保持为最新（不写盘），避免切回时显示陈旧内容；
    // 真正持久化交给 scheduleSave（按 noteId 独立的防抖/后台写盘）。
    noteStore.updateNoteContent(currentNote.value.id, newVal)
    // 关键：用编辑发生时的笔记 id 建独立待保存，计时器在后台继续，切走也不取消
    if (noteStore.autoSaveEnabled.value) {
      // 自动保存开启：按 noteId 独立的防抖/后台写盘
      saveManager.scheduleSave(currentNote.value.id, newVal)
    } else {
      // 自动保存关闭：仅标记脏（写入 pending 但不设 timer），仍可手动保存 / 卸载落盘
      saveManager.markDirty(currentNote.value.id, newVal)
    }
  } else {
    // 内容改回原值：取消该笔记的待保存（避免无谓写盘），并标记已保存
    isUnsaved.value = false
    saveManager.removePending(currentNote.value.id)
  }
})
</script>

<style>
html, body {
  padding: 0;
  margin: 0;
}
</style>