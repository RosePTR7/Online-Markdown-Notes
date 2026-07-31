<template>
  <div class="w-full flex flex-col shrink-0 relative h-full overflow-hidden transition-colors duration-300" :class="isDark ? 'bg-slate-800' : 'bg-white'">
     <!-- 标题 -->
      <div class="px-4 py-3 border-b transition-colors duration-300 flex justify-center items-center" :class="isDark ? 'border-slate-700' : 'border-slate-200'">
        <span class="font-bold text-xl transition-colors duration-300" :class="isDark ? 'text-slate-50' : 'text-slate-800'">在线Markdown笔记</span>
      </div>
      <!-- 分隔线 -->
      <div class="h-px transition-colors duration-300" :class="isDark ? 'bg-slate-200' : 'bg-slate-500'"></div>
    <!-- 新建笔记按钮 -->
    <button
      v-if="mode === 'online'"
      class="m-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-base self-start w-[calc(100%-16px)] transition-colors duration-200 flex items-center justify-center gap-1"
      @click="addNote(null)"
    >
      <svg class="w-3.5 h-3.5" :class="isDark ? 'text-slate-50' : 'text-slate-50'" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
      </svg>
      新建笔记
    </button>
    
    <!-- 本地模式：新建笔记按钮 -->
    <button
      v-if="mode === 'local'"
      class="m-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-base self-start w-[calc(100%-16px)] transition-colors duration-200 flex items-center justify-center gap-1"
      @click="handleLocalNewNote"
    >
      <svg class="w-3.5 h-3.5 text-slate-50" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
      </svg>
      新建笔记
    </button>
    
    <!-- 新建文件夹按钮 -->
    <button
      v-if="mode === 'online'"
      class="m-2 py-2 bg-amber-400 hover:bg-amber-500 text-white rounded-xl font-bold text-base self-start w-[calc(100%-16px)] transition-colors duration-200 flex items-center justify-center gap-1"
      @click="showNewFolderDialog"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      新建文件夹
    </button>
    
    <!-- 本地模式：新建文件夹按钮 -->
    <button
      v-if="mode === 'local'"
      class="m-2 py-2 bg-amber-400 hover:bg-amber-500 text-white rounded-xl font-bold text-base self-start w-[calc(100%-16px)] transition-colors duration-200 flex items-center justify-center gap-1"
      @click="handleLocalNewFolder"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      新建文件夹
    </button>

    <!-- 圆角矩形容器包裹搜索框和内容（主内容区） -->
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

      <!-- 主内容区域：文件夹树 + 未分类笔记（统一滚动容器） -->
      <div v-else class="flex-1 overflow-y-auto overflow-x-hidden">
        <div class="flex flex-col">
          <!-- 在线模式：文件夹树 + 未分类笔记 -->
          <template v-if="mode === 'online'">
            <div class="shrink-0">
              <FolderTree ref="folderTreeRef" />
            </div>
            
            <!-- 分隔线 -->
            <div class="h-px mx-3 my-2 shrink-0" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'"></div>
            
            <!-- 未分类笔记 -->
            <div class="shrink-0">
              <UnsortedNotes ref="unsortedNotesRef" />
            </div>
          </template>
          
          <!-- 本地模式：本地文件夹树 -->
          <template v-else>
            <LocalFolderTree
              ref="localFolderTreeRef"
              @open-note="openLocalNote"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- ====== 模式切换 + 固定分隔线（侧边栏底部） ===== -->
    <div class="h-px shrink-0" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'"></div>
    <div class="flex items-center justify-between px-2 py-2 shrink-0">
      <div class="flex items-center gap-1">
        <span class="text-xs font-medium transition-colors duration-300" :class="isDark ? 'text-slate-400' : 'text-slate-500'">在线</span>
        
        <!-- 滑块 -->
        <div 
          class="relative w-10 h-5 rounded-full cursor-pointer transition-colors duration-300 select-none"
          :class="mode === 'local' ? 'bg-indigo-500' : 'bg-slate-400'"
          @click="switchMode"
        >
          <!-- 滑动圆点 -->
          <div 
            class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
            :class="mode === 'local' ? 'translate-x-[18px]' : 'translate-x-0.5'"
          ></div>
        </div>
        
        <span class="text-xs font-medium transition-colors duration-300" :class="isDark ? 'text-slate-400' : 'text-slate-500'">本地</span>
      </div>
      
      <!-- 更改路径按钮（仅本地模式显示在右侧） -->
      <button
        v-if="mode === 'local'"
        class="px-2 py-1 text-xs rounded transition-colors duration-300"
        :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'"
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
import { useNoteStore } from '../stores/useNoteStore'
import { useFolderStore } from '../stores/useFolderStore'
import { useModalStore } from '../stores/useModalStore'
import { useLocalModeStore } from '../stores/useLocalModeStore'
import FolderTree from './FolderTree.vue'
import UnsortedNotes from './UnsortedNotes.vue'
import LocalFolderTree from './LocalFolderTree.vue'

const isDark = inject('isDark', ref(false))

const noteStore = useNoteStore()
const folderStore = useFolderStore()
const modalStore = useModalStore()
const localModeStore = useLocalModeStore()

const {
  noteList, activeId,
  addNote, delNote, updateNote, openNote
} = noteStore

const { folderList, addFolder } = folderStore

// 本地模式
const { mode, hasFolder, setFolderHandle, clearFolderHandle, listDirectoryContents, readFile, writeFile, deleteFile } = localModeStore

// 组件引用
const folderTreeRef = ref(null)
const unsortedNotesRef = ref(null)
const localFolderTreeRef = ref(null)

// ==========搜索功能==========
const searchKeyword = ref('')

const searchResults = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return []
  return noteList.value.filter(note => 
    note.title.toLowerCase().includes(keyword) ||
    note.content.toLowerCase().includes(keyword)
  )
})

const highlightText = (text) => {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return text
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
}

// 获取笔记所在文件夹名称
const getNoteFolderName = (folderId) => {
  if (!folderId) return '未分类'
  const folder = folderList.value.find(f => f.id === folderId)
  return folder ? folder.name : '未分类'
}

// ==========新建文件夹==========
const showNewFolderDialog = async () => {
  const name = await modalStore.prompt({
    title: '新建文件夹',
    defaultValue: '',
    placeholder: '请输入文件夹名称'
  })
  
  if (name && name.trim()) {
    await addFolder(null, name.trim())
  }
}

// 切换模式
const switchMode = () => {
  localModeStore.setMode(localModeStore.mode.value === 'online' ? 'local' : 'online')
}

// ==========本地模式操作==========
const showSelectFolderPrompt = ref(false)

// 选择本地文件夹
const selectLocalFolder = async () => {
  try {
    const handle = await window.showDirectoryPicker()
    setFolderHandle(handle)
    showSelectFolderPrompt.value = false
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('选择文件夹失败:', err)
    }
  }
}

// 更改本地文件夹路径
const changeLocalFolderPath = async () => {
  clearFolderHandle()
  try {
    const handle = await window.showDirectoryPicker()
    setFolderHandle(handle)
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('更改文件夹路径失败:', err)
    } else {
      // 用户取消，恢复之前的 handle
      // 注意：clearFolderHandle 已调用，这里需要重新选择
    }
  }
}

// 本地模式：新建笔记
const handleLocalNewNote = async () => {
  if (!hasFolder()) {
    showSelectFolderPrompt.value = true
    return
  }
  
  const name = await modalStore.prompt({
    title: '新建笔记',
    defaultValue: '',
    placeholder: '请输入笔记名称'
  })
  
  if (name && name.trim()) {
    await localModeStore.addLocalNote('', name.trim(), '')
  }
}

// 本地模式：新建文件夹
const handleLocalNewFolder = async () => {
  if (!hasFolder()) {
    showSelectFolderPrompt.value = true
    return
  }
  
  const name = await modalStore.prompt({
    title: '新建文件夹',
    defaultValue: '',
    placeholder: '请输入文件夹名称'
  })
  
  if (name && name.trim()) {
    await localModeStore.addLocalFolder('', name.trim())
  }
}

// 打开本地笔记
const openLocalNote = async (file) => {
  if (!hasFolder()) return
  
  try {
    // 读取文件内容
    const content = await readFile('', file.name)
    
    // 从文件名提取 noteId (去掉 .md 后缀)
    const noteId = file.name.replace(/\.md$/i, '')
    
    // 创建或更新笔记到 noteStore
    let existingNote = noteList.value.find(n => n.id === noteId)
    if (!existingNote) {
      // 解析 frontmatter 中的 title
      let title = file.name.replace(/\.md$/i, '')
      let actualContent = content
      
      // 简单检查是否有 frontmatter
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (fmMatch) {
        const fmLines = fmMatch[1].split('\n')
        for (const line of fmLines) {
          const colonIdx = line.indexOf(':')
          if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim().toLowerCase()
            const val = line.slice(colonIdx + 1).trim()
            if (key === 'title') {
              title = val
              break
            }
          }
        }
      }
      
      existingNote = {
        id: noteId,
        title,
        content: actualContent,
        folderId: null,
        createTime: Date.now(),
        updateTime: Date.now()
      }
      noteStore.noteList.value.push(existingNote)
    }
    
    openNote(noteId)
  } catch (err) {
    console.error('读取本地笔记失败:', err)
    modalStore.showToast('读取笔记失败: ' + err.message, 'error')
  }
}

// ==========删除确认==========
const showDeleteModal = ref(false)
const deleteMessage = ref('')
let pendingDeleteId = ''
let pendingDeleteType = '' // 'note' | 'folder'

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
</script>