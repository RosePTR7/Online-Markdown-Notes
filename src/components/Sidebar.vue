<template>
  <div class="w-full flex flex-col shrink-0 overflow-hidden transition-colors duration-300" :class="isDark ? 'bg-slate-800' : 'bg-white'">
    <button class="m-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-base self-start w-[224px]" @click="addNote">+ 新建笔记</button>

    <!-- 圆角矩形容器包裹搜索框和笔记列表 -->
    <div class="flex-1 flex flex-col mx-2 mb-2 rounded-2xl overflow-hidden transition-colors duration-300" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">
      <!-- 搜索框 -->
      <div class="px-3 pt-3 pb-2">
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索笔记..."
          class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-indigo-400 text-sm box-border transition-colors duration-300"
          :class="isDark ? 'bg-slate-600 border-slate-500 text-slate-200 placeholder-slate-400' : 'border-slate-300 bg-white'"
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
          <span class="flex-1 truncate" v-html="highlightText(note.title)"></span>
        </div>
        <div v-if="searchResults.length === 0" class="p-4 text-center text-sm transition-colors duration-300" :class="isDark ? 'text-slate-500' : 'text-slate-400'">无匹配结果</div>
      </div>

      <!-- 笔记列表区域 -->
      <div class="flex-1 overflow-auto relative px-1 pt-1">
        <div
          v-for="note in sortedList"
          :key="note.id"
          class="p-2 cursor-pointer rounded-xl mx-1 mb-1 flex justify-between items-center group border transition-colors duration-300"
          :class="isDark 
            ? (activeId === note.id ? 'bg-slate-600 text-indigo-300 border-indigo-500' : 'hover:bg-slate-600 text-slate-300 border-slate-600')
            : (activeId === note.id ? 'bg-white text-indigo-600 border-indigo-300' : 'hover:bg-slate-200 text-slate-700 border-slate-300')"
          @click="openNote(note.id)"
        >
          <span class="flex-1 truncate">{{ note.title }}</span>
          <button
            class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-lg shrink-0 transition-colors duration-300"
            :class="isDark ? 'hover:bg-slate-500 text-slate-400' : 'hover:bg-gray-300 text-gray-600'"
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
        class="fixed shadow-lg border rounded-xl py-1 z-50 w-28 transition-colors duration-300"
        :class="isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'"
        :style="{ left: menuX + 'px', top: menuY + 'px' }"
        @click.stop
      >
        <div v-if="!showRenameInput">
          <div class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-300" :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'" @click="showRenameInput = true">重命名</div>
          <div class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-300" :class="isDark ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-500'" @click="openDeleteConfirm()">删除笔记</div>
        </div>
        <div v-else class="p-2">
          <input
            v-model="renameInputValue"
            class="border w-full px-2 py-1 text-sm mb-2 outline-none rounded-lg transition-colors duration-300"
            :class="isDark ? 'bg-slate-600 border-slate-500 text-slate-200' : 'bg-white border-slate-300'"
            @keyup.enter="submitRename"
          />
          <div class="flex gap-1 justify-end">
            <button class="text-xs px-2 py-1 border rounded-lg transition-colors duration-300" :class="isDark ? 'border-slate-500 text-slate-300 hover:bg-slate-600' : 'border-slate-300 hover:bg-slate-100'" @click="closeNoteMenu">取消</button>
            <button class="text-xs px-2 py-1 bg-blue-500 text-white rounded-lg" @click="submitRename">确定</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showDeleteModal=false">
      <div class="p-5 rounded w-80 transition-colors duration-300" :class="isDark ? 'bg-slate-800' : 'bg-white'">
        <h3 class="text-lg font-bold mb-3 transition-colors duration-300" :class="isDark ? 'text-slate-100' : 'text-slate-800'">确认删除</h3>
        <p class="mb-5 transition-colors duration-300" :class="isDark ? 'text-slate-400' : 'text-slate-600'">删除后笔记无法恢复，确定删除这条笔记吗？</p>
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

const isDark = inject('isDark', ref(false))

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