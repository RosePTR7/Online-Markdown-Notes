<template>
  <div
    class="w-full flex flex-col shrink-0 relative h-full overflow-hidden transition-colors duration-300"
    :class="isDark ? 'bg-slate-800' : 'bg-white'"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- 标题 -->
    <div class="px-4 py-3 border-b transition-colors duration-300 flex justify-center items-center" :class="isDark ? 'border-slate-700' : 'border-slate-200'">
      <span class="font-bold text-xl transition-colors duration-300" :class="isDark ? 'text-slate-50' : 'text-slate-800'">在线Markdown笔记</span>
    </div>
    <!-- 分隔线 -->
    <div class="h-px transition-colors duration-300" :class="isDark ? 'bg-slate-200' : 'bg-slate-500'"></div>

    <!-- 操作按钮 -->
    <div class="px-2 pt-2 pb-1 space-y-1">
      <button
        class="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-base transition-colors duration-200 flex items-center justify-center gap-1 border"
        @click="handleCreateNote"
        :disabled="isCreating"
      >
        <Icon name="doc" class="w-3.5 h-3.5" v-if="!isCreating" />
        <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" v-else />
        新建笔记
      </button>
      <button
        class="w-full py-2 bg-amber-400 hover:bg-amber-500 text-white rounded-xl font-bold text-base transition-colors duration-200 flex items-center justify-center gap-1 border"
        @click="handleCreateFolder"
        :disabled="isCreating"
      >
        <Icon name="add-folder" class="w-4 h-4" v-if="!isCreating" />
        新建文件夹
      </button>
      <button
        v-if="localModeStore.mode.value === 'online'"
        class="w-full py-2 rounded-xl font-semibold text-base transition-colors duration-200 flex items-center justify-center gap-1 border"
        :class="isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-200'"
        @click="showRecycleBin = true"
      >
        <Icon name="trash" class="w-4 h-4" />
        回收站
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

      <!-- 主内容区域：在线/本地共用同一套侧边栏外观，仅接入不同的数据与逻辑 -->
      <div v-else class="flex-1 overflow-y-auto overflow-x-hidden">
        <FolderTree ref="folderTreeRef" @open-note="handleOpenLocalNote" />
        <!-- 在线模式：未分类笔记区 -->
        <template v-if="localModeStore.mode.value === 'online'">
          <div class="h-px mx-3 my-2 shrink-0" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'"></div>
          <UnsortedNotes />
        </template>
        <!-- 手动刷新按钮（本地模式，兜底同步磁盘变化） -->
        <div v-if="localModeStore.mode.value === 'local'" class="shrink-0 px-3 py-2 border-t" :class="isDark ? 'border-slate-600' : 'border-slate-200'">
          <button
            class="w-full py-1.5 text-xs rounded-lg transition-colors duration-200 flex items-center justify-center gap-1"
            :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-200' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'"
            @click="handleManualRefresh"
          >
            <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" v-if="localRefreshing" />
            <Icon name="refresh" class="w-3.5 h-3.5" v-else />
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

    <!-- 拖拽导入高亮遮罩：从浏览器外拖入文件时显示，提示可在此处导入 -->
    <div
      v-if="isDragOver"
      class="absolute inset-2 z-50 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center pointer-events-none select-none transition-colors duration-200"
      :class="isDark ? 'border-indigo-400 bg-slate-900/60' : 'border-indigo-500 bg-white/75'"
    >
      <Icon name="import" class="w-9 h-9 mb-2" :class="isDark ? 'text-indigo-300' : 'text-indigo-500'" />
      <div class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-700'">拖放文件到此处导入</div>
      <div class="text-xs mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">支持 .md / .markdown / .txt / .json</div>
    </div>

    <!-- 回收站覆盖层 -->
    <RecycleBin :visible="showRecycleBin" @close="showRecycleBin = false" />
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
import RecycleBin from './RecycleBin.vue'
import Icon from './Icon.vue'

const isDark = inject('isDark', ref(false))

// 回收站覆盖层开关
const showRecycleBin = ref(false)

const noteStore = useNoteStore()
const folderStore = useFolderStore()
const modalStore = useModalStore()
const localModeStore = useLocalModeStore()

const {
  noteList, activeId,
  createNote, delNote, updateNote, openNote
} = noteStore
const { folderList, addFolder } = folderStore

// 创建状态锁定
const isCreating = ref(false)

// ==========通用创建操作==========
const handleCreateNote = async () => {
  if (isCreating.value) return

  // 本地模式：未选目录时先引导选择，再创建
  if (localModeStore.mode.value === 'local' && !localModeStore.hasFolder()) {
    const confirmed = await modalStore.confirm({
      title: '选择本地文件夹',
      message: '请先选择一个本地文件夹作为笔记存储目录。',
      confirmText: '选择文件夹'
    })
    if (confirmed) await selectLocalFolder()
    return
  }

  const name = await modalStore.prompt({
    title: '新建笔记',
    defaultValue: '',
    placeholder: '请输入笔记名称'
  })
  if (!name?.trim()) return

  isCreating.value = true
  try {
    const result = await createNote(null, name.trim(), '')
    // 本地模式新建后刷新目录树让新笔记立即出现（在线模式由 addNote 自行更新列表）
    if (result && localModeStore.mode.value === 'local') {
      folderTreeRef.value?.refreshScan?.()
    }
  } finally {
    isCreating.value = false
  }
}

const handleCreateFolder = async () => {
  if (isCreating.value) return
  
  if (localModeStore.mode.value === 'local') {
    if (!localModeStore.hasFolder()) {
      const confirmed = await modalStore.confirm({
        title: '选择本地文件夹',
        message: '请先选择一个本地文件夹作为笔记存储目录。',
        confirmText: '选择文件夹'
      })
      if (confirmed) await selectLocalFolder()
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
      if (folderTreeRef.value?.refreshScan) {
        folderTreeRef.value.refreshScan()
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
  if (next === 'local' && folderTreeRef.value?.resetAndScan) {
    await folderTreeRef.value.resetAndScan()
  }
}

// 手动刷新（本地模式兜底）
async function handleManualRefresh() {
  if (!folderTreeRef.value?.refreshScan) return
  localRefreshing.value = true
  try {
    // 深度刷新：根目录 + 所有已展开子目录都从磁盘重读，彻底反映外部增删改名
    await folderTreeRef.value.refreshScan(true)
  } finally {
    localRefreshing.value = false
  }
}

// ==========本地模式操作==========
const folderTreeRef = ref(null)

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
    
    // 检查是否已存在（按 filename + dirPath 精确匹配，避免同名不同目录误判）
    const existingByFilename = noteList.value.find(n => n.filename === data.name && (n.dirPath || '') === (data.dirPath || ''))
    if (existingByFilename) {
      openNote(existingByFilename.id)
      return
    }

    // 生成 nanoid 作为笔记 ID 并加入内存（记录 dirPath，重命名/删除时用于定位已打开的标签页）
    const noteId = nanoid()
    const newNote = { id: noteId, filename: data.name, dirPath: data.dirPath || '', title, content: actualContent, folderId: null, isLocal: true, createTime: Date.now(), updateTime: Date.now() }
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
    if (folderTreeRef.value?.resetAndScan) {
      await folderTreeRef.value.resetAndScan()
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('更改文件夹路径失败:', err)
  }
}

// ==========拖拽导入（从浏览器外拖文件到侧边栏）==========
// 用计数器避免拖到子元素时 dragleave/dragenter 反复触发导致高亮闪烁
const dragCounter = ref(0)
const isDragOver = computed(() => dragCounter.value > 0)

const onDragEnter = (e) => {
  e.preventDefault()
  // 仅当拖入的是文件（而非网页内部元素）时才计数，避免干扰内部拖拽
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
    dragCounter.value++
  }
}

const onDragOver = (e) => {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

const onDragLeave = (e) => {
  e.preventDefault()
  dragCounter.value = Math.max(0, dragCounter.value - 1)
}

const onDrop = async (e) => {
  e.preventDefault()
  dragCounter.value = 0
  const files = e.dataTransfer?.files
  if (files && files.length) {
    await noteStore.importFiles(files)
  }
}

// 注：删除确认等模态对话框已统一改用 useModalStore.confirm / prompt，不再手搓弹窗。
</script>