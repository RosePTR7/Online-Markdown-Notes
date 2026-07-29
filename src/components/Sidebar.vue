<template>
  <div class="w-full flex flex-col shrink-0 overflow-hidden transition-colors duration-300" :class="isDark ? 'bg-slate-800' : 'bg-white'">
    <!-- 新建笔记按钮 -->
    <button
      class="m-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-base self-start w-[calc(100%-16px)] transition-colors duration-200"
      @click="addNote(null)"
    >
      + 新建笔记
    </button>

    <!-- 圆角矩形容器包裹搜索框和内容 -->
    <div class="flex-1 flex flex-col mx-2 mb-2 rounded-2xl overflow-hidden transition-colors duration-300" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">
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
          <!-- 文件夹树 -->
          <div class="shrink-0">
            <FolderTree ref="folderTreeRef" />
          </div>
          
          <!-- 分隔线 -->
          <div class="h-px mx-3 my-2 shrink-0" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'"></div>
          
          <!-- 未分类笔记 -->
          <div class="shrink-0">
            <UnsortedNotes ref="unsortedNotesRef" />
          </div>
        </div>
      </div>
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
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useNoteStore } from '../stores/useNoteStore'
import { useFolderStore } from '../stores/useFolderStore'
import FolderTree from './FolderTree.vue'
import UnsortedNotes from './UnsortedNotes.vue'

const isDark = inject('isDark', ref(false))

const noteStore = useNoteStore()
const folderStore = useFolderStore()

const {
  noteList, activeId,
  addNote, delNote, updateNote, openNote
} = noteStore

const { folderList } = folderStore

// 组件引用
const folderTreeRef = ref(null)
const unsortedNotesRef = ref(null)

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