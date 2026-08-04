<template>
  <div class="unsorted-notes">
    <!-- 标题栏 -->
    <div
      class="flex items-center justify-between px-3 py-2 border-b transition-colors duration-200"
      :class="isDark ? 'border-slate-600' : 'border-slate-200'"
    >
      <div class="flex items-center gap-2">
        <Icon name="add-note" class="w-4 h-4" :class="isDark ? 'text-slate-400' : 'text-slate-500'" />
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
    <div 
      class="px-1 py-1 min-h-[60px]"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
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
          <Icon name="doc" class="w-3.5 h-3.5" :class="isDark ? 'text-slate-50' : 'text-slate-500'" />
        </span>
        <span class="flex-1 truncate text-sm">{{ note.title }}</span>
        <button
          class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors duration-200 bg-transparent border-none outline-none p-0"
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

    <!-- 右键菜单 - 复用通用 ContextMenu + MenuItem 组件 -->
    <ContextMenu :visible="menuVisible" :x="menuX" :y="menuY" @close="closeMenu">
      <MenuItem icon="rename" label="重命名" @click="renameNote" />
      <div class="h-px mx-2 my-1" :class="isDark ? 'bg-slate-600' : 'bg-slate-200'"></div>
      <MenuItem icon="delete" label="删除笔记" danger @click="deleteNote" />
    </ContextMenu>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useFolderStore } from '../stores/useFolderStore'
import { useNoteStore } from '../stores/useNoteStore'
import { useModalStore } from '../stores/useModalStore'
import Icon from './Icon.vue'
import ContextMenu from './ContextMenu.vue'
import MenuItem from './MenuItem.vue'

const isDark = inject('isDark', ref(false))
const folderStore = useFolderStore()
const noteStore = useNoteStore()
const modalStore = useModalStore()

const { activeId, openNote, updateNote, delNote, moveNoteToFolder, getUnsortedNotes } = noteStore
const { dragState, setDragState, clearDragState } = folderStore

// 拖拽状态
const isDragOver = ref(false)

// 未分类笔记（双保险：排除本地笔记）
const unsortedNotes = computed(() => {
  return getUnsortedNotes.value.filter(n => !n.isLocal).sort((a, b) => b.updateTime - a.updateTime)
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
  isDragOver.value = false
}

// 拖拽经过未分类区域
const handleDragOver = (e) => {
  e.preventDefault()
  const dragItem = dragState.value.dragItem
  if (!dragItem) return
  isDragOver.value = true
  e.dataTransfer.dropEffect = 'move'
}

// 拖拽离开未分类区域
const handleDragLeave = (e) => {
  // 检查是否真的离开了容器
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX
  const y = e.clientY
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isDragOver.value = false
  }
}

// 放置到未分类区域
const handleDrop = async (e) => {
  e.preventDefault()
  e.stopPropagation()
  
  const dragItem = dragState.value.dragItem
  if (!dragItem) return
  
  if (dragItem.type === 'note') {
    // 移动笔记到未分类（folderId = null）
    await moveNoteToFolder(dragItem.id, null)
  }
  
  clearDragState()
  isDragOver.value = false
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
  const targetId = menuTargetId.value
  closeMenu()
  
  const confirmed = await modalStore.confirm({
    title: '删除笔记',
    message: '确定删除这条笔记吗？此操作无法撤销。',
    confirmText: '删除',
    confirmDanger: true
  })
  
  if (confirmed) {
    delNote(targetId)
  }
}
</script>