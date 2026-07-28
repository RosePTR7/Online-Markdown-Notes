<template>
  <div class="unsorted-notes">
    <!-- 标题栏 -->
    <div
      class="flex items-center justify-between px-3 py-2 border-b transition-colors duration-200"
      :class="isDark ? 'border-slate-600' : 'border-slate-200'"
    >
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4" :class="isDark ? 'text-slate-400' : 'text-slate-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="text-sm font-medium" :class="isDark ? 'text-slate-300' : 'text-slate-600'">未分类笔记</span>
        <span
          class="text-xs px-1.5 py-0.5 rounded-full"
          :class="isDark ? 'bg-slate-600 text-slate-400' : 'bg-slate-200 text-slate-500'"
        >
          {{ unsortedNotes.length }}
        </span>
      </div>
    </div>

    <!-- 笔记列表 -->
    <div class="px-1 py-1">
      <div
        v-for="note in unsortedNotes"
        :key="note.id"
        class="note-item flex items-center px-2 py-1.5 rounded-xl cursor-pointer group transition-colors duration-200 border"
        :class="[
          activeId === note.id
            ? (isDark ? 'bg-slate-600 border-indigo-500/50 text-indigo-300' : 'bg-white border-indigo-300 text-indigo-600')
            : (isDark 
                ? 'bg-slate-600/30 border-slate-500/30 hover:bg-slate-600 text-slate-300' 
                : 'bg-slate-200/50 border-slate-300/50 hover:bg-slate-200 text-slate-700')
        ]"
        draggable="true"
        @dragstart="handleDragStart(note, $event)"
        @dragend="handleDragEnd"
        @click="openNote(note.id)"
        @contextmenu.prevent="openNoteMenu(note, $event)"
      >
        <!-- 笔记图标 -->
        <span class="mr-2 shrink-0">
          <svg class="w-3.5 h-3.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
          </svg>
        </span>
        <span class="flex-1 truncate text-sm">{{ note.title }}</span>
        <button
          class="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-xs shrink-0 transition-colors duration-200"
          :class="isDark ? 'hover:bg-slate-500 text-slate-400' : 'hover:bg-gray-300 text-gray-600'"
          @click.stop="openNoteMenu(note, $event)"
        >
          ···
        </button>
      </div>

      <!-- 空状态 -->
      <div
        v-if="unsortedNotes.length === 0"
        class="px-4 py-6 text-center text-xs"
        :class="isDark ? 'text-slate-500' : 'text-slate-400'"
      >
        所有笔记已归类
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="menuVisible"
        class="fixed inset-0 z-[100]"
        @click="closeMenu"
        @contextmenu.prevent="closeMenu"
      >
        <div
          class="fixed shadow-lg border rounded-xl py-1 z-[101] w-40 transition-colors duration-300"
          :class="isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'"
          :style="{ left: menuX + 'px', top: menuY + 'px' }"
          @click.stop
        >
          <div
            class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
            :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'"
            @click="renameNote"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            重命名
          </div>
          <div class="h-px mx-2 my-1" :class="isDark ? 'bg-slate-600' : 'bg-slate-200'"></div>
          <div
            class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
            :class="isDark ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-500'"
            @click="deleteNote"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            删除笔记
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useFolderStore } from '../stores/useFolderStore'
import { useNoteStore } from '../stores/useNoteStore'
import { useModalStore } from '../stores/useModalStore'

const isDark = inject('isDark', ref(false))
const folderStore = useFolderStore()
const noteStore = useNoteStore()
const modalStore = useModalStore()

const { activeId, openNote, updateNote, delNote, getUnsortedNotes } = noteStore
const { dragState, setDragState, clearDragState } = folderStore

// 未分类笔记
const unsortedNotes = computed(() => {
  return getUnsortedNotes.value.sort((a, b) => b.updateTime - a.updateTime)
})

// 菜单状态
const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuTargetId = ref('')

// 拖拽开始
const handleDragStart = (note, e) => {
  e.stopPropagation()
  setDragState({
    isDragging: true,
    dragItem: { type: 'note', id: note.id }
  })
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'note', id: note.id }))
}

// 拖拽结束
const handleDragEnd = () => {
  clearDragState()
}

// 打开笔记菜单
const openNoteMenu = (note, e) => {
  e.stopPropagation()
  e.preventDefault()
  menuVisible.value = true
  menuTargetId.value = note.id
  menuX.value = e.clientX
  menuY.value = e.clientY
}

// 关闭菜单
const closeMenu = () => {
  menuVisible.value = false
  menuTargetId.value = ''
}

// 重命名笔记
const renameNote = async () => {
  const note = noteStore.noteList.value.find(n => n.id === menuTargetId.value)
  if (!note) return
  closeMenu()
  
  const newName = await modalStore.prompt({
    title: '重命名笔记',
    defaultValue: note.title,
    placeholder: '请输入笔记名称'
  })
  
  if (newName && newName.trim()) {
    updateNote(note.id, { title: newName.trim() })
  }
}

// 删除笔记
const deleteNote = async () => {
  closeMenu()
  
  const confirmed = await modalStore.confirm({
    title: '删除笔记',
    message: '确定删除这条笔记吗？此操作无法撤销。',
    confirmText: '删除',
    confirmDanger: true
  })
  
  if (confirmed) {
    delNote(menuTargetId.value)
  }
}
</script>