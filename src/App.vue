<template>
  <div v-if="loading" class="w-full h-screen flex items-center justify-center text-lg text-gray-500">
    笔记加载中...
  </div>
  <div v-else class="h-screen flex flex-col overflow-hidden bg-slate-50 font-['system-ui','-apple-system','PingFang SC','Microsoft YaHei',sans-serif]" @click="closeNoteMenu">
    <!-- 顶部导航栏 -->
    <div class="flex items-center border-b border-slate-200 bg-white pl-10 pr-4 py-2 gap-10 shrink-0">
      <span class="font-bold text-slate-800 text-xl">在线Markdown笔记</span>
      <div class="flex-1"></div>
      <button class="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded shrink-0" @click="showSetting=true">AI配置</button>
    </div>

    <!-- 主体两栏布局 -->
    <div class="flex flex-1 overflow-hidden mt-3">
      <!-- 左侧侧边栏 -->
      <div class="w-60 border-r border-slate-200 flex flex-col shrink-0 bg-white">
        <button class="m-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-base" @click="addNote">+ 新建笔记</button>

        <div class="flex-1 overflow-auto relative">
          <div
            v-for="note in sortedList"
            :key="note.id"
            class="p-2 cursor-pointer hover:bg-slate-100 text-slate-700 rounded-lg mx-1 flex justify-between items-center group"
            :class="activeId === note.id ? 'bg-slate-100 text-indigo-600 border-b-2 border-indigo-500' : ''"
            @click="openNote(note.id)"
          >
            <span class="flex-1 truncate">{{ note.title }}</span>
            <button
              class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-gray-300 flex items-center justify-center text-lg text-gray-600 shrink-0"
              @click="openNoteMenu(note, $event)"
            >
              ···
            </button>
          </div>

          <!-- 笔记右键菜单 -->
          <div
            v-if="menuVisible"
            class="fixed bg-white shadow-lg border rounded py-1 z-50 w-28"
            :style="{ left: menuX + 'px', top: menuY + 'px' }"
            @click.stop
          >
            <div v-if="!showRenameInput">
              <div class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm" @click="showRenameInput = true">重命名</div>
              <div class="px-3 py-2 hover:bg-red-100 cursor-pointer text-sm text-red-500" @click="openDeleteConfirm()">删除笔记</div>
            </div>
            <div v-else class="p-2">
              <input
                v-model="renameInputValue"
                class="border w-full px-1 py-1 text-sm mb-2 outline-none"
                @keyup.enter="submitRename"
              />
              <div class="flex gap-1 justify-end">
                <button class="text-xs px-1 border rounded" @click="closeNoteMenu">取消</button>
                <button class="text-xs px-1 bg-blue-500 text-white rounded" @click="submitRename">确定</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧编辑器区域 -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <div v-if="currentNote" class="p-2 border-b flex items-center shrink-0 gap-4">
          <div class="flex-1 flex gap-1 overflow-x-auto">
            <div
              v-for="tab in openTabs"
              :key="tab.id"
              class="px-3 py-1 rounded-t cursor-pointer flex items-center gap-1 shrink-0 max-w-[140px]"
              :class="activeId === tab.id
                ? 'bg-slate-100 text-indigo-600 border-b-2 border-indigo-500'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              @click="openNote(tab.id)"
            >
              <span class="truncate">{{ noteList.find(n => n.id === tab.id)?.title }}</span>
              <span @click.stop="closeTab(tab.id)" class="hover:text-red-500 shrink-0">×</span>
            </div>
          </div>
          <button class="bg-indigo-500 hover:bg-indigo-600 text-white rounded px-3 py-1 shrink-0" @click="handlePolish">AI一键润色</button>
        </div>

        <!-- 保存状态状态栏 -->
        <div v-if="currentNote" class="px-3 py-1 text-xs border-b border-gray-100">
          <span :class="isUnsaved ? 'text-red-500' : 'text-green-600'">
            {{ isUnsaved ? '有未保存修改' : '已保存' }}
          </span>
        </div>

        <MdEditor
          ref="mdEditorRef"
          v-if="currentNote"
          v-model="editorContent"
          class="flex-1 overflow-hidden"
        />
        <div v-else class="flex items-center justify-center flex-1 text-gray-400">请新建/选择一条笔记</div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showDeleteModal=false">
      <div class="bg-white p-5 rounded w-80">
        <h3 class="text-lg font-bold mb-3 text-slate-800">确认删除</h3>
        <p class="text-slate-600 mb-5">删除后笔记无法恢复，确定删除这条笔记吗？</p>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700" @click="showDeleteModal=false">取消</button>
          <button class="px-4 py-1.5 rounded bg-red-500 hover:bg-red-600 text-white" @click="confirmDelete">确定删除</button>
        </div>
      </div>
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useNoteStore } from './stores/useNoteStore'
import MdEditor from './components/MdEditor.vue'
import { polishMarkdown } from './utils/aiApi'

const noteStore = useNoteStore()
const {
  noteList, openTabs, activeId, aiConfig, currentNote,
  loadNotes, loadAiConfig,
  addNote, delNote, updateNote, openNote, closeTab, saveAiConfig
} = noteStore

let loading = ref(true)
const mdEditorRef = ref(null)

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

// 切换笔记/关闭页面触发强制保存（方案A核心逻辑）
const flushSave = () => {
  if (saveTimer) {
    // 存在等待执行的防抖任务：立刻执行保存，不丢弃修改
    runSaveLogic()
    clearTimeout(saveTimer)
    saveTimer = null
  } else {
    // 无等待任务，依靠脏标记判断
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

const sortedList = computed(() => [...noteList.value].sort((a, b) => b.updateTime - a.updateTime))

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

// 删除弹窗
const showDeleteModal = ref(false)
let pendingDeleteId = ''
const openDeleteConfirm = () => {
  pendingDeleteId = activeMenuNoteId.value
  closeNoteMenu()
  showDeleteModal.value = true
}
const confirmDelete = () => {
  delNote(pendingDeleteId)
  showDeleteModal.value = false
  pendingDeleteId = ''
}

// 右键菜单
const menuVisible = ref(false)
const activeMenuNoteId = ref('')
const renameInputValue = ref('')
const showRenameInput = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const openNoteMenu = (note, e) => {
  e.stopPropagation()
  const rect = e.target.getBoundingClientRect()
  menuX.value = rect.right + 10
  menuY.value = rect.top
  activeMenuNoteId.value = note.id
  renameInputValue.value = note.title
  showRenameInput.value = false
  menuVisible.value = true
}
const closeNoteMenu = () => {
  menuVisible.value = false
  activeMenuNoteId.value = ''
}
const submitRename = () => {
  const name = renameInputValue.value.trim()
  if (!name) return
  updateNote(activeMenuNoteId.value, { title: name })
  closeNoteMenu()
}

// AI润色
const handlePolish = async () => {
  if (!currentNote.value) {
    alert('请先选择一条笔记再执行润色')
    return
  }
  if (!confirm('确定要AI润色并覆盖当前笔记内容吗？')) return
  try {
    const result = await polishMarkdown(currentNote.value.content, aiConfig.baseUrl, aiConfig.apiKey)
    editorContent.value = result
    runSaveLogic()
  } catch (err) {
    alert('润色失败：' + err.message)
  }
}
</script>