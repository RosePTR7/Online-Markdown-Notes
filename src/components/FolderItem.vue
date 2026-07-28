<template>
  <div class="folder-item-wrapper">
    <!-- 文件夹项 -->
    <div
      class="folder-item flex items-center px-2 py-1.5 rounded-xl cursor-pointer group transition-colors duration-200 border"
      :class="[
        isDark 
          ? 'bg-slate-600/50 border-slate-500/50 hover:bg-slate-600 text-slate-300' 
          : 'bg-slate-200/70 border-slate-300/70 hover:bg-slate-200 text-slate-700',
        isDragOver && dragPosition === 'before' ? (isDark ? 'border-t-2 border-t-indigo-400' : 'border-t-2 border-t-indigo-500') : '',
        isDragOver && dragPosition === 'after' ? (isDark ? 'border-b-2 border-b-indigo-400' : 'border-b-2 border-b-indigo-500') : '',
        isDragOver && dragPosition === 'inside' ? (isDark ? 'bg-indigo-900/30 border border-indigo-500' : 'bg-indigo-50 border border-indigo-300') : ''
      ]"
      :style="{ paddingLeft: (depth * 16 + 8) + 'px' }"
      draggable="true"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="handleClick"
      @contextmenu.prevent="handleContextMenu"
    >
      <!-- 展开/折叠箭头 -->
      <button
        class="w-4 h-4 flex items-center justify-center mr-1 transition-transform duration-200 shrink-0"
        :class="{ 'rotate-90': isExpanded }"
        @click.stop="toggleExpand"
      >
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
      </button>
      
      <!-- 文件夹图标 -->
      <span class="mr-2 shrink-0">
        <svg class="w-4 h-4" :class="isDark ? 'text-indigo-400' : 'text-indigo-500'" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      </span>
      
      <!-- 文件夹名称 -->
      <span class="flex-1 truncate text-sm">{{ folder.name }}</span>
      
      <!-- 操作按钮 -->
      <button
        class="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-xs shrink-0 transition-colors duration-200"
        :class="isDark ? 'hover:bg-slate-500 text-slate-400' : 'hover:bg-gray-300 text-gray-600'"
        @click.stop="handleContextMenu"
      >
        ···
      </button>
    </div>
    
    <!-- 子文件夹和笔记（展开时显示） -->
    <div v-if="isExpanded" class="folder-children">
      <!-- 子文件夹 -->
      <FolderItem
        v-for="childFolder in childFolders"
        :key="'folder-' + childFolder.id"
        :folder="childFolder"
        :depth="depth + 1"
      />
      
      <!-- 文件夹内的笔记 -->
      <div
        v-for="note in folderNotes"
        :key="'note-' + note.id"
        class="note-item flex items-center px-2 py-1.5 rounded-xl cursor-pointer group transition-colors duration-200 border"
        :class="[
          activeId === note.id
            ? (isDark ? 'bg-slate-600 border-indigo-500/50 text-indigo-300' : 'bg-white border-indigo-300 text-indigo-600')
            : (isDark 
                ? 'bg-slate-600/30 border-slate-500/30 hover:bg-slate-600 text-slate-300' 
                : 'bg-slate-200/50 border-slate-300/50 hover:bg-slate-200 text-slate-700')
        ]"
        :style="{ paddingLeft: ((depth + 1) * 16 + 24) + 'px' }"
        draggable="true"
        @dragstart="handleNoteDragStart(note, $event)"
        @dragend="handleDragEnd"
        @dragover.prevent="handleNoteDragOver"
        @dragleave="handleNoteDragLeave"
        @drop="handleNoteDrop(note, $event)"
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
      
      <!-- 空文件夹提示 -->
      <div
        v-if="childFolders.length === 0 && folderNotes.length === 0"
        class="px-2 py-2 text-xs text-center italic"
        :class="isDark ? 'text-slate-500' : 'text-slate-400'"
        :style="{ paddingLeft: ((depth + 1) * 16 + 8) + 'px' }"
      >
        空文件夹
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useFolderStore } from '../stores/useFolderStore'
import { useNoteStore } from '../stores/useNoteStore'

const props = defineProps({
  folder: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  }
})

const isDark = inject('isDark', ref(false))
const openContextMenu = inject('openContextMenu', () => {})

const folderStore = useFolderStore()
const noteStore = useNoteStore()

const { activeId, openNote, moveNoteToFolder } = noteStore
const { 
  isFolderExpanded, toggleFolder, getChildFolders, 
  dragState, setDragState, clearDragState
} = folderStore

// 计算属性
const isExpanded = computed(() => isFolderExpanded(props.folder.id))
const childFolders = computed(() => getChildFolders(props.folder.id))
const folderNotes = computed(() => {
  return noteStore.noteList.value
    .filter(n => n.folderId === props.folder.id)
    .sort((a, b) => b.updateTime - a.updateTime)
})

// 拖拽状态
const isDragOver = ref(false)
const dragPosition = ref(null)

// 展开/折叠
const toggleExpand = () => {
  toggleFolder(props.folder.id)
}

// 点击文件夹
const handleClick = () => {
  toggleFolder(props.folder.id)
}

// 文件夹拖拽开始
const handleDragStart = (e) => {
  e.stopPropagation()
  setDragState({
    isDragging: true,
    dragItem: { type: 'folder', id: props.folder.id }
  })
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', id: props.folder.id }))
}

// 笔记拖拽开始
const handleNoteDragStart = (note, e) => {
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
  dragPosition.value = null
}

// 文件夹拖拽经过
const handleDragOver = (e) => {
  e.stopPropagation()
  e.preventDefault()
  
  const dragItem = dragState.value.dragItem
  if (!dragItem) return
  
  // 不能拖拽文件夹到自身
  if (dragItem.type === 'folder' && dragItem.id === props.folder.id) return
  
  isDragOver.value = true
  
  // 计算拖拽位置
  const rect = e.currentTarget.getBoundingClientRect()
  const y = e.clientY - rect.top
  const height = rect.height
  
  if (y < height * 0.25) {
    dragPosition.value = 'before'
  } else if (y > height * 0.75) {
    dragPosition.value = 'after'
  } else {
    dragPosition.value = 'inside'
  }
  
  e.dataTransfer.dropEffect = 'move'
}

// 笔记项拖拽经过
const handleNoteDragOver = (e) => {
  e.stopPropagation()
  e.preventDefault()
  
  const dragItem = dragState.value.dragItem
  if (!dragItem) return
  
  isDragOver.value = true
  
  const rect = e.currentTarget.getBoundingClientRect()
  const y = e.clientY - rect.top
  const height = rect.height
  
  if (y < height * 0.5) {
    dragPosition.value = 'before'
  } else {
    dragPosition.value = 'after'
  }
  
  e.dataTransfer.dropEffect = 'move'
}

// 拖拽离开
const handleDragLeave = (e) => {
  e.stopPropagation()
  isDragOver.value = false
  dragPosition.value = null
}

// 笔记项拖拽离开
const handleNoteDragLeave = (e) => {
  e.stopPropagation()
  isDragOver.value = false
  dragPosition.value = null
}

// 文件夹放置
const handleDrop = async (e) => {
  e.stopPropagation()
  e.preventDefault()
  
  const dragItem = dragState.value.dragItem
  if (!dragItem) return
  
  // 不能拖拽文件夹到自身
  if (dragItem.type === 'folder' && dragItem.id === props.folder.id) {
    clearDragState()
    return
  }
  
  if (dragItem.type === 'folder') {
    // 文件夹拖拽
    if (dragPosition.value === 'inside') {
      await folderStore.moveFolder(dragItem.id, props.folder.id, 'inside')
    } else {
      await folderStore.moveFolder(dragItem.id, props.folder.id, dragPosition.value)
    }
  } else {
    // 笔记拖拽到文件夹
    if (dragPosition.value === 'inside') {
      await moveNoteToFolder(dragItem.id, props.folder.id)
    } else {
      // 拖拽到文件夹旁边，放到同级
      await moveNoteToFolder(dragItem.id, props.folder.parentId)
    }
  }
  
  clearDragState()
  isDragOver.value = false
  dragPosition.value = null
}

// 笔记项放置
const handleNoteDrop = async (targetNote, e) => {
  e.stopPropagation()
  e.preventDefault()
  
  const dragItem = dragState.value.dragItem
  if (!dragItem) return
  
  if (dragItem.type === 'note') {
    // 笔记拖拽到笔记上
    if (dragPosition.value === 'before' || dragPosition.value === 'after') {
      // 移动到目标笔记的同一文件夹
      await moveNoteToFolder(dragItem.id, targetNote.folderId)
    }
  } else {
    // 文件夹拖拽到笔记上，移动到笔记的文件夹
    await folderStore.moveFolder(dragItem.id, targetNote.folderId, 'inside')
  }
  
  clearDragState()
  isDragOver.value = false
  dragPosition.value = null
}

// 右键菜单 - 文件夹
const handleContextMenu = (e) => {
  e.stopPropagation()
  e.preventDefault()
  openContextMenu({
    type: 'folder',
    targetId: props.folder.id,
    x: e.clientX,
    y: e.clientY
  })
}

// 右键菜单 - 笔记
const openNoteMenu = (note, e) => {
  e.stopPropagation()
  e.preventDefault()
  openContextMenu({
    type: 'note',
    targetId: note.id,
    x: e.clientX,
    y: e.clientY
  })
}
</script>