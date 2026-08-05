<template>
  <div class="folder-item-wrapper">
    <!-- 文件夹项（在线/本地外观完全一致） -->
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
      :draggable="!isLocal"
      @dragstart="(e) => handleDragStart('folder', props.folder.id, e)"
      @dragend="handleDragEnd"
      @dragover.prevent="(e) => handleDragOver(false, e)"
      @dragleave="(e) => handleDragLeave(e)"
      @drop="handleDrop"
      @click="handleFolderClick"
      @contextmenu.prevent="handleContextMenu"
    >
      <!-- 展开/折叠箭头 -->
      <button
        class="flex items-center justify-center mr-1 transition-transform duration-200 shrink-0 text-xs font-bold bg-transparent border-none outline-none p-0"
        :class="{ 'rotate-90': isExpanded }"
        @click.stop="handleToggleExpand"
      >
        >
      </button>

      <!-- 文件夹图标 -->
      <span class="mr-2 shrink-0">
        <Icon name="folder" class="w-4 h-4" :class="isDark ? 'text-amber-400' : 'text-amber-400'" />
      </span>

      <!-- 文件夹名称 -->
      <span class="flex-1 truncate text-sm">{{ folder.name }}</span>

      <!-- 操作按钮 -->
      <button
        class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors duration-200 bg-transparent border-none outline-none p-0"
        :class="isDark ? 'hover:bg-slate-500 text-slate-400' : 'hover:bg-gray-300 text-gray-600'"
        @click.stop="handleContextMenu"
      >
        ···
      </button>
    </div>

    <!-- 子内容（展开时显示） -->
    <div v-if="isExpanded" class="folder-children">
      <!-- 子文件夹（递归，外观一致，仅数据源不同） -->
      <FolderItem
        v-for="childFolder in childFolders"
        :key="(isLocal ? 'local-' : 'folder-') + childFolder.key"
        :folder="childFolder"
        :depth="depth + 1"
        :is-local="isLocal"
        :contents="childFolder.contents || []"
      />

      <!-- 文件夹内的条目：在线=笔记 / 本地=文件（外观一致） -->
      <div
        v-for="item in items"
        :key="(isLocal ? 'local-' : 'note-') + item.key"
        class="note-item flex items-center px-2 py-1.5 rounded-xl cursor-pointer group transition-colors duration-200 border"
        :class="[
          isItemActive(item)
            ? (isDark ? 'bg-slate-600 border-indigo-500/50 text-indigo-300' : 'bg-white border-indigo-300 text-indigo-600')
            : (isDark
                ? 'bg-slate-600/30 border-slate-500/30 hover:bg-slate-600 text-slate-300'
                : 'bg-slate-200/50 border-slate-300/50 hover:bg-slate-200 text-slate-700')
        ]"
        :style="{ paddingLeft: ((depth + 1) * 16 + 24) + 'px' }"
        :draggable="!isLocal"
        @dragstart="(e) => handleDragStart('note', item.id, e)"
        @dragend="handleDragEnd"
        @dragover.prevent="(e) => handleDragOver(true, e)"
        @dragleave="(e) => handleDragLeave(e)"
        @drop="handleNoteDrop(item, $event)"
        @click="handleItemClick(item)"
        @contextmenu.prevent="handleItemMenu(item, $event)"
      >
        <!-- 条目图标 -->
        <span class="mr-2 shrink-0">
          <Icon name="doc" class="w-3.5 h-3.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'" />
        </span>
        <span class="flex-1 truncate text-sm">{{ itemTitle(item) }}</span>
        <button
          class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors duration-200 bg-transparent border-none outline-none p-0"
          :class="isDark ? 'hover:bg-slate-500 text-slate-400' : 'hover:bg-gray-300 text-gray-600'"
          @click.stop="handleItemMenu(item, $event)"
        >
          ···
        </button>
      </div>

      <!-- 空文件夹提示 -->
      <div
        v-if="childFolders.length === 0 && items.length === 0"
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
import Icon from './Icon.vue'
import { resolveLocalTitle, isLocalActive } from '../utils/localNotes'

// 递归引用自身（Vue 3 按文件名推断组件名）
defineOptions({ name: 'FolderItem' })

const props = defineProps({
  folder: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  // 是否为本地模式（数据源/逻辑不同，外观一致）
  isLocal: {
    type: Boolean,
    default: false
  },
  // 本地模式：当前文件夹的已加载内容（懒加载缓存）
  contents: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['expand', 'open-note'])

const isDark = inject('isDark', ref(false))
const openContextMenu = inject('openContextMenu', () => {})
const localNotesMap = inject('localNotesMap', null)

const folderStore = useFolderStore()
const noteStore = useNoteStore()

const { activeId, openNote, moveNoteToFolder } = noteStore
const {
  isFolderExpanded, toggleFolder, getChildFolders,
  dragState, setDragState, clearDragState
} = folderStore

// 本地模式下当前文件夹的完整相对路径
const folderPath = computed(() => props.isLocal ? (props.folder.path || props.folder.name) : '')

// 展开状态：在线委托 folderStore，本地用本地 ref + 向上 emit
const expanded = ref(false)
const isExpanded = computed(() => props.isLocal ? expanded.value : isFolderExpanded(props.folder.id))

// 子文件夹（外观一致，数据源不同）
const childFolders = computed(() => {
  if (!props.isLocal) return getChildFolders(props.folder.id)
  const items = props.contents || []
  const base = folderPath.value
  return items
    .filter(i => i.kind === 'directory')
    .map(i => ({ ...i, key: base ? base + '/' + i.name : i.name, path: base ? base + '/' + i.name : i.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// 文件夹内条目（在线=笔记对象 / 本地=.md 文件对象），统一为 { key, ... }
const items = computed(() => {
  if (!props.isLocal) {
    return noteStore.noteList.value
      .filter(n => n.folderId === props.folder.id && !n.isLocal)
      .sort((a, b) => b.updateTime - a.updateTime)
      .map(n => ({ ...n, key: n.id }))
  }
  const base = folderPath.value
  return (props.contents || [])
    .filter(i => i.kind === 'file' && i.name.endsWith('.md'))
    .map(f => ({ name: f.name, dirPath: base, key: f.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// 本地模式下从文件名解析标题 / 激活态
const itemTitle = (item) => {
  if (!props.isLocal) return item.title
  return resolveLocalTitle(localNotesMap?.value, item.name)
}
const isItemActive = (item) => {
  if (!props.isLocal) return activeId.value === item.id
  return isLocalActive(localNotesMap?.value, item.name, activeId.value)
}

// 展开 / 折叠
const handleToggleExpand = () => {
  if (props.isLocal) {
    expanded.value = !expanded.value
    emit('expand', folderPath.value, expanded.value)
  } else {
    toggleFolder(props.folder.id)
  }
}
const handleFolderClick = () => handleToggleExpand()

// 打开条目
const handleItemClick = (item) => {
  if (props.isLocal) emit('open-note', { name: item.name, dirPath: item.dirPath })
  else openNote(item.id)
}

// 右键菜单（统一委托给父级 ContextMenu）
const handleContextMenu = (e) => {
  e.stopPropagation()
  e.preventDefault()
  if (props.isLocal) openContextMenu({ type: 'folder', target: folderPath.value, x: e.clientX, y: e.clientY })
  else openContextMenu({ type: 'folder', target: props.folder.id, x: e.clientX, y: e.clientY })
}
const handleItemMenu = (item, e) => {
  e.stopPropagation()
  e.preventDefault()
  if (props.isLocal) openContextMenu({ type: 'file', target: { name: item.name, dirPath: item.dirPath }, x: e.clientX, y: e.clientY })
  else openContextMenu({ type: 'note', target: item.id, x: e.clientX, y: e.clientY })
}

// ========== 拖拽（仅在线模式；本地模式不拖拽） ==========
const isDragOver = ref(false)
const dragPosition = ref(null)

// 复位拖拽视觉状态（handleDragEnd / handleDragLeave / drop 收尾共用）
const resetDragVisual = () => {
  isDragOver.value = false
  dragPosition.value = null
}

// 通用拖拽启动：type 为 'folder' | 'note'
const handleDragStart = (type, id, e) => {
  if (props.isLocal) return
  e.stopPropagation()
  setDragState({ isDragging: true, dragItem: { type, id } })
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }))
}

// 通用拖拽过站：isNote 决定分区（文件夹三区 before/after/inside，笔记两区 before/after）
const handleDragOver = (isNote, e) => {
  if (props.isLocal) return
  e.stopPropagation()
  e.preventDefault()
  const dragItem = dragState.value.dragItem
  if (!dragItem) return
  if (dragItem.type === 'folder' && dragItem.id === props.folder.id) return
  isDragOver.value = true
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = (e.clientY - rect.top) / rect.height
  if (isNote) {
    dragPosition.value = ratio < 0.5 ? 'before' : 'after'
  } else {
    dragPosition.value = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside'
  }
  e.dataTransfer.dropEffect = 'move'
}

// 通用拖拽离开
const handleDragLeave = (e) => {
  if (props.isLocal) return
  e.stopPropagation()
  resetDragVisual()
}

// 拖拽收尾：清状态 + 复位视觉（handleDragEnd 与各 drop 共用）
const finishDrop = () => {
  clearDragState()
  resetDragVisual()
}

const handleDragEnd = () => finishDrop()

const handleDrop = async (e) => {
  if (props.isLocal) return
  e.stopPropagation()
  e.preventDefault()
  const dragItem = dragState.value.dragItem
  if (!dragItem) return
  if (dragItem.type === 'folder' && dragItem.id === props.folder.id) {
    finishDrop()
    return
  }
  if (dragItem.type === 'folder') {
    if (dragPosition.value === 'inside') {
      await folderStore.moveFolder(dragItem.id, props.folder.id, 'inside')
    } else {
      await folderStore.moveFolder(dragItem.id, props.folder.id, dragPosition.value)
    }
  } else {
    if (dragPosition.value === 'inside') {
      await moveNoteToFolder(dragItem.id, props.folder.id)
    } else {
      await moveNoteToFolder(dragItem.id, props.folder.parentId)
    }
  }
  finishDrop()
}

const handleNoteDrop = async (targetNote, e) => {
  if (props.isLocal) return
  e.stopPropagation()
  e.preventDefault()
  const dragItem = dragState.value.dragItem
  if (!dragItem) return
  if (dragItem.type === 'note') {
    if (dragPosition.value === 'before' || dragPosition.value === 'after') {
      await moveNoteToFolder(dragItem.id, targetNote.folderId)
    }
  } else {
    await folderStore.moveFolder(dragItem.id, targetNote.folderId, 'inside')
  }
  finishDrop()
}
</script>
