<template>
  <div class="w-60 flex flex-col shrink-0 bg-white overflow-hidden">
    <button class="m-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-base" @click="addNote">+ 新建笔记</button>

    <!-- 圆角矩形容器包裹搜索框和笔记列表 -->
    <div class="flex-1 flex flex-col mx-2 mb-2 bg-slate-100 rounded-2xl overflow-hidden">
      <!-- 搜索框 -->
      <div class="px-3 pt-3 pb-2">
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索笔记..."
          class="w-full px-3 py-1.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-400 text-sm box-border bg-white"
        />
      </div>

      <!-- 搜索结果区域 -->
      <div v-if="searchKeyword" class="overflow-auto border-b border-slate-200 max-h-[60vh]">
        <div class="px-3 py-1 text-xs text-slate-500">搜索结果 ({{ searchResults.length }})</div>
        <div
          v-for="note in searchResults"
          :key="note.id"
          class="p-2 cursor-pointer hover:bg-slate-200 text-slate-700 rounded-xl mx-2 mb-1 flex justify-between items-center group border border-transparent"
          :class="activeId === note.id ? 'bg-white text-indigo-600 border-indigo-300' : 'border-slate-300'"
          @click="openNote(note.id)"
        >
          <span class="flex-1 truncate" v-html="highlightText(note.title)"></span>
        </div>
        <div v-if="searchResults.length === 0" class="p-4 text-center text-slate-400 text-sm">无匹配结果</div>
      </div>

      <!-- 笔记列表区域 -->
      <div class="flex-1 overflow-auto relative px-1 pt-1">
        <div
          v-for="note in sortedList"
          :key="note.id"
          class="p-2 cursor-pointer hover:bg-slate-200 text-slate-700 rounded-xl mx-1 mb-1 flex justify-between items-center group border"
          :class="activeId === note.id ? 'bg-white text-indigo-600 border-indigo-300' : 'border-slate-300'"
          @click="openNote(note.id)"
        >
          <span class="flex-1 truncate">{{ note.title }}</span>
          <button
            class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg hover:bg-gray-300 flex items-center justify-center text-lg text-gray-600 shrink-0"
            @click="openNoteMenu(note, $event)"
          >
            ···
          </button>
        </div>
      </div>
    </div>

    <!-- 侧边笔记右键菜单 独立遮罩关闭 -->
    <div
      v-if="menuVisible"
      class="fixed inset-0 z-40"
      @click="closeNoteMenu"
    >
      <div
        class="fixed bg-white shadow-lg border rounded-xl py-1 z-50 w-28"
        :style="{ left: menuX + 'px', top: menuY + 'px' }"
        @click.stop
      >
        <div v-if="!showRenameInput">
          <div class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm rounded-lg mx-1" @click="showRenameInput = true">重命名</div>
          <div class="px-3 py-2 hover:bg-red-100 cursor-pointer text-sm text-red-500 rounded-lg mx-1" @click="openDeleteConfirm()">删除笔记</div>
        </div>
        <div v-else class="p-2">
          <input
            v-model="renameInputValue"
            class="border w-full px-2 py-1 text-sm mb-2 outline-none rounded-lg"
            @keyup.enter="submitRename"
          />
          <div class="flex gap-1 justify-end">
            <button class="text-xs px-2 py-1 border rounded-lg" @click="closeNoteMenu">取消</button>
            <button class="text-xs px-2 py-1 bg-blue-500 text-white rounded-lg" @click="submitRename">确定</button>
          </div>
        </div>
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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useNoteStore } from '../stores/useNoteStore'

const noteStore = useNoteStore()
const {
  noteList, activeId,
  addNote, delNote, updateNote, openNote
} = noteStore

const sortedList = computed(() => [...noteList.value].sort((a, b) => b.updateTime - a.updateTime))

// ==========搜索功能==========
const searchKeyword = ref('')

const searchResults = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return []
  return sortedList.value.filter(note => 
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

// ==========侧边笔记右键菜单==========
const menuVisible = ref(false)
let activeMenuNoteId = ''
const menuX = ref(0)
const menuY = ref(0)
const renameInputValue = ref('')
const showRenameInput = ref(false)
const showDeleteModal = ref(false)
let pendingDeleteId = ''

const openNoteMenu = (note, e) => {
  e.stopPropagation()
  menuVisible.value = true
  activeMenuNoteId = note.id
  renameInputValue.value = note.title
  showRenameInput.value = false
  menuX.value = e.clientX
  menuY.value = e.clientY
}

const closeNoteMenu = () => {
  menuVisible.value = false
  activeMenuNoteId = ''
}

const submitRename = () => {
  const name = renameInputValue.value.trim()
  if (!name) return
  updateNote(activeMenuNoteId, { title: name })
  closeNoteMenu()
}

const openDeleteConfirm = () => {
  pendingDeleteId = activeMenuNoteId
  closeNoteMenu()
  showDeleteModal.value = true
}

const confirmDelete = () => {
  delNote(pendingDeleteId)
  showDeleteModal.value = false
  pendingDeleteId = ''
}
</script>