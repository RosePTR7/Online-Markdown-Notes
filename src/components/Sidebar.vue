<template>
  <div class="w-full flex flex-col shrink-0 relative h-full overflow-hidden transition-colors duration-300" :class="isDark ? 'bg-slate-800' : 'bg-white'">
    <!-- 标题 -->
    <div class="px-4 py-3 border-b transition-colors duration-300 flex justify-center items-center" :class="isDark ? 'border-slate-700' : 'border-slate-200'">
      <span class="font-bold text-xl transition-colors duration-300" :class="isDark ? 'text-slate-50' : 'text-slate-800'">在线Markdown笔记</span>
    </div>
    <!-- 分隔线 -->
    <div class="h-px transition-colors duration-300" :class="isDark ? 'bg-slate-200' : 'bg-slate-500'"></div>

    <!-- 操作按钮 -->
    <div class="px-2 pt-2 pb-1 space-y-1">
      <button
        class="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-base transition-colors duration-200 flex items-center justify-center gap-1"
        @click="handleCreateNote"
        :disabled="isCreating"
      >
        <svg v-if="!isCreating" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
        </svg>
        <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        新建笔记
      </button>
      <button
        class="w-full py-2 bg-amber-400 hover:bg-amber-500 text-white rounded-xl font-bold text-base transition-colors duration-200 flex items-center justify-center gap-1"
        @click="handleCreateFolder"
        :disabled="isCreating"
      >
        <svg v-if="!isCreating" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        新建文件夹
      </button>
    </div>

    <!-- 内容区（圆角容器） -->
    <div class="flex-1 min-h-0 flex flex-col mx-2 mb-2 rounded-2xl overflow-hidden transition-colors duration-300 pb-20" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">
      <!-- 搜索框 -->
      <div class="px-3 pt-3 pb-2">
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索笔记..."
          class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-indigo-400 text-sm box-border transition-colors duration-300"
          :class="isDark ? 'bg-slate-600 border-slate-500 text-slate-50 placeholder-slate-50' : 'border-slate-300 bg-white'"
        />
      </div>

      <!-- 搜索结果区域 -->
      <div v-if="searchKeyword" class="overflow-auto border-b max-h-[60vh] transition-colors duration-300" :class="isDark ? 'border-slate-600' : 'border-slate-200'">
        <div class="px-3 py-1 text-xs transition-colors duration-300" :class="isDark ? 'text-slate-400' : 'text-slate-500'">搜索结果 ({{ searchResults.length }})</div>
        <div
          v-for="note in searchResults"
          :key="note.id"
          class="p-2 cursor-pointer rounded-xl mx-2 mb-1 flex justify-between items-center group border border-transparent transition-colors duration-300"
          :class="isDark 
            ? (activeId === note.id ? 'bg-slate-600 text-indigo-300 border-indigo-500' : 'hover:bg-slate-600 text-slate-300 border-slate-600')
            : (activeId === note.id ? 'bg-white text-indigo-600 border-indigo-300' : 'hover:bg-slate-200 text-slate-700 border-slate-300')"
          @click="openNote(note.id)"
        >
          <div class="flex-1 min-w-0">
            <div class="truncate text-sm" v-html="highlightText(note.title)"></div>
            <div class="text-xs truncate mt-0.5" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
              {{ getNoteFolderName(note.folderId) }}
            </div>
          </div>
        </div>
        <div v-if="searchResults.length === 0" class="p-4 text-center text-sm transition-colors duration-300" :class="isDark ? 'text-slate-500' : 'text-slate-400'">无匹配结果</div>
      </div>

      <!-- 主内容区域：根据模式切换组件 -->
      <div v-else class="flex-1 overflow-y-auto overflow-x-hidden">
        <!-- 在线模式：文件夹树 + 未分类笔记 -->
        <template v-if="localModeStore.mode.value === 'online'">
          <div class="shrink-0"><FolderTree /></div>
          <div class="h-px mx-3 my-2 shrink-0" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'"></div>
          <UnsortedNotes />
        </template>
        
        <!-- 本地模式：本地文件树（仅初始化时扫描，不自动刷新） -->
        <template v-else>
          <LocalFolderTree ref="localFolderTreeRef" @refresh="onLocalRefresh" @open-note="handleOpenLocalNote" />
        </template>
        <!-- 手动刷新按钮（本地模式，兜底同步磁盘变化） -->
        <div v-if="localModeStore.mode.value === 'local'" class="shrink-0 px-3 py-2 border-t" :class="isDark ? 'border-slate-600' : 'border-slate-200'">
          <button
            class="w-full py-1.5 text-xs rounded-lg transition-colors duration-200 flex items-center justify-center gap-1"
            :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-200' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'"
            @click="handleManualRefresh"
          >
            <svg v-if="localRefreshing" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>
      </div>
    </div>

    <!-- ====== 底部控制栏（模式切换 + 更改路径） ===== -->
    <div class="h-px shrink-0" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'"></div>
    <div class="flex items-center justify-between px-2 py-2 shrink-0">
      <div class="flex items-center gap-1  py-1">
        <span class="text-4 font-medium transition-colors duration-300" :class="isDark ? 'text-slate-400' : 'text-slate-500'">在线</span>
        <div 
          class="relative w-10 h-5 rounded-full cursor-pointer transition-colors duration-300 select-none"
          :class="localModeStore.mode.value === 'local' ? 'bg-indigo-500' : 'bg-slate-400'"
          @click="switchMode"
        >
          <div 
            class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
            :class="localModeStore.mode.value === 'local' ? 'translate-x-[22px]' : 'translate-x-0.5'"
          ></div>
        </div>
        <span class="text-4 font-medium transition-colors duration-300" :class="isDark ? 'text-slate-400' : 'text-slate-500'">本地</span>
      </div>
      
      <!-- 更改路径按钮（仅本地模式） -->
      <button
        v-if="localModeStore.mode.value === 'local'"
        class="px-2 py-1 text-xs rounded-lg transition-colors duration-300"
        :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-200 border-slate-500' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'"
        @click="changeLocalFolderPath"
      >
        更改路径
      </button>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showDeleteModal=false">
      <div class="p-5 rounded w-80 transition-colors duration-300" :class="isDark ? 'bg-slate-800' : 'bg-white'">
        <h3 class="text-lg font-bold mb-3 transition-colors duration-300" :class="isDark ? 'text-slate-100' : 'text-slate-800'">确认删除</h3>
        <p class="mb-5 transition-colors duration-300" :class="isDark ? 'text-slate-400' : 'text-slate-600'">{{ deleteMessage }}</p>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-1.5 rounded transition-colors duration-300" :class="isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'" @click="showDeleteModal=false">取消</button>
          <button class="px-4 py-1.5 rounded bg-red-500 hover:bg-red-600 text-white" @click="confirmDelete">确定删除</button>
        </div>
      </div>
    </div>

    <!-- 引导选择文件夹弹窗（本地模式下没选文件夹时） -->
    <div v-if="showSelectFolderPrompt" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showSelectFolderPrompt=false">
      <div class="p-5 rounded w-80 transition-colors duration-300" :class="isDark ? 'bg-slate-800' : 'bg-white'">
        <h3 class="text-lg font-bold mb-3 transition-colors duration-300" :class="isDark ? 'text-slate-100' : 'text-slate-800'">选择本地文件夹</h3>
        <p class="mb-5 transition-colors duration-300" :class="isDark ? 'text-slate-400' : 'text-slate-600'">请先选择一个本地文件夹作为笔记存储目录。</p>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-1.5 rounded transition-colors duration-300" :class="isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'" @click="showSelectFolderPrompt=false">取消</button>
          <button class="px-4 py-1.5 rounded bg-indigo-500 hover:bg-indigo-600 text-white" @click="selectLocalFolder">选择文件夹</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { nanoid } from 'nanoid'
import { useNoteStore } from '../stores/useNoteStore'
import { useFolderStore } from '../stores/useFolderStore'
import { useModalStore } from '../stores/useModalStore'
import { useLocalModeStore } from '../stores/useLocalModeStore'
import FolderTree from './FolderTree.vue'
import UnsortedNotes from './UnsortedNotes.vue'
import LocalFolderTree from './LocalFolderTree.vue'
import matter from 'gray-matter'

const isDark = inject('isDark', ref(false))

const noteStore = useNoteStore()
const folderStore = useFolderStore()
const modalStore = useModalStore()
const localModeStore = useLocalModeStore()

const {
  noteList, activeId,
  addNote, delNote, updateNote, openNote, addLocalNoteDirectly, finalizeLocalNote
} = noteStore
const { folderList, addFolder } = folderStore

// 创建状态锁定
const isCreating = ref(false)

// ==========通用创建操作==========
const handleCreateNote = async () => {
  if (isCreating.value) return
  
  if (localModeStore.mode.value === 'local') {
    if (!localModeStore.hasFolder()) {
      showSelectFolderPrompt.value = true
      return
    }
    // 显示输入框
    const name = await modalStore.prompt({
      title: '新建笔记',
      defaultValue: '',
      placeholder: '请输入笔记名称'
    })
    if (!name?.trim()) return
    
    isCreating.value = true
    try {
      const result = await addLocalNoteDirectly('', name.trim(), '')
      if (result) {
        // 异步写盘到文件系统
        try {
          const fm = { title: name.trim(), created: new Date().toISOString(), updated: new Date().toISOString() }
          const fileContent = matter.stringify('', fm)
          await localModeStore.writeFile('', result.filename, fileContent)
          finalizeLocalNote(result.id, { filename: result.filename })
          // 刷新根目录，让新笔记立即出现
          if (localFolderTreeRef.value?.refreshScan) {
            localFolderTreeRef.value.refreshScan()
          }
        } catch (err) {
          console.error('本地笔记写入失败:', err)
          modalStore.showToast('保存失败: ' + err.message, 'error')
        }
      }
    } finally {
      isCreating.value = false
    }
  } else {
    addNote(null)
  }
}

const handleCreateFolder = async () => {
  if (isCreating.value) return
  
  if (localModeStore.mode.value === 'local') {
    if (!localModeStore.hasFolder()) {
      showSelectFolderPrompt.value = true
      return
    }
    const name = await modalStore.prompt({
      title: '新建文件夹',
      defaultValue: '',
      placeholder: '请输入文件夹名称'
    })
    if (name?.trim()) {
      await localModeStore.addLocalFolder('', name.trim())
      // 通知子组件刷新
      if (localFolderTreeRef.value?.refreshScan) {
        localFolderTreeRef.value.refreshScan()
      }
    }
  } else {
    const name = await modalStore.prompt({
      title: '新建文件夹',
      defaultValue: '',
      placeholder: '请输入文件夹名称'
    })
    if (name && name.trim()) {
      await addFolder(null, name.trim())
    }
  }
}

// ==========搜索功能==========
const searchKeyword = ref('')

const searchResults = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return []
  return noteList.value.filter(note => 
    !note.isLocal &&
    (note.title.toLowerCase().includes(keyword) ||
    note.content.toLowerCase().includes(keyword))
  )
})

const highlightText = (text) => {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return text
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
}

const getNoteFolderName = (folderId) => {
  if (!folderId) return '未分类'
  const folder = folderList.value.find(f => f.id === folderId)
  return folder ? folder.name : '未分类'
}

// ==========模式切换==========
const localRefreshing = ref(false)

const switchMode = async () => {
  const next = localModeStore.mode.value === 'online' ? 'local' : 'online'
  localModeStore.setMode(next)
  // 切到本地时串行刷新：清缓存 → 扫描，避免新旧目录数据混杂
  if (next === 'local' && localFolderTreeRef.value?.resetAndScan) {
    await localFolderTreeRef.value.resetAndScan()
  }
}

// 手动刷新（本地模式兜底）
async function handleManualRefresh() {
  if (!localFolderTreeRef.value?.refreshScan) return
  localRefreshing.value = true
  try {
    await localFolderTreeRef.value.refreshScan()
  } finally {
    localRefreshing.value = false
  }
}

// ==========本地模式操作==========
const showSelectFolderPrompt = ref(false)
const localFolderTreeRef = ref(null)

const onLocalRefresh = () => {
  // 当本地文件夹树触发刷新事件时处理
}

// 打开本地笔记（处理文件系统笔记和临时内存笔记）
const handleOpenLocalNote = async (data) => {
  // 如果是临时笔记（已在内存中），直接激活
  if (data.isTemp) {
    openNote(data.id)
    return
  }
  
  if (!localModeStore.hasFolder()) return
  
  try {
    const content = await localModeStore.readFile(data.dirPath || '', data.name)
    let title = data.name.replace(/\.md$/i, '')
    let actualContent = content
    
    // 解析 frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim().toLowerCase()
          const val = line.slice(colonIdx + 1).trim()
          if (key === 'title') { title = val; break }
        }
      }
    }
    
    // 检查是否已存在
    const existingByFilename = noteList.value.find(n => n.filename === data.name)
    if (existingByFilename) {
      openNote(existingByFilename.id)
      return
    }
    
    // 生成 nanoid 作为笔记 ID 并加入内存
    const noteId = nanoid()
    const newNote = { id: noteId, filename: data.name, title, content: actualContent, folderId: null, isLocal: true, createTime: Date.now(), updateTime: Date.now() }
    noteList.value.push(newNote)
    openNote(noteId)
  } catch (err) {
    console.error('读取本地笔记失败:', err)
    modalStore.showToast('读取笔记失败: ' + err.message, 'error')
  }
}

const selectLocalFolder = async () => {
  try {
    const handle = await window.showDirectoryPicker()
    localModeStore.setFolderHandle(handle)
    showSelectFolderPrompt.value = false
  } catch (err) {
    if (err.name !== 'AbortError') console.error('选择文件夹失败:', err)
  }
}

const changeLocalFolderPath = async () => {
  localModeStore.clearFolderHandle()
  try {
    const handle = await window.showDirectoryPicker()
    localModeStore.setFolderHandle(handle)
    // 目录切换后串行清缓存并重新扫描，防止新旧目录数据混杂
    if (localFolderTreeRef.value?.resetAndScan) {
      await localFolderTreeRef.value.resetAndScan()
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('更改文件夹路径失败:', err)
  }
}

// ==========删除确认==========
const showDeleteModal = ref(false)
const deleteMessage = ref('')
let pendingDeleteId = ''
let pendingDeleteType = ''

const openDeleteConfirm = (id, type, message) => {
  pendingDeleteId = id
  pendingDeleteType = type
  deleteMessage.value = message
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  if (pendingDeleteType === 'note') {
    delNote(pendingDeleteId)
  } else if (pendingDeleteType === 'folder') {
    await folderStore.deleteFolder(pendingDeleteId)
  }
  showDeleteModal.value = false
  pendingDeleteId = ''
  pendingDeleteType = ''
}

defineExpose({ openDeleteConfirm })
</script>