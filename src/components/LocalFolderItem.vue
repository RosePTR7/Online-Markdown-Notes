<template>
  <div class="local-folder-item-wrapper">
    <!-- 文件夹项 -->
    <div
      class="local-folder-item flex items-center px-2 py-1.5 rounded-xl cursor-pointer group transition-colors duration-200"
      :class="[
        isDark 
          ? 'hover:bg-slate-600 text-slate-300' 
          : 'hover:bg-slate-200 text-slate-700',
      ]"
      :style="{ paddingLeft: (depth * 16 + 12) + 'px' }"
      @click="toggleExpand"
      @contextmenu.prevent="handleContextMenu"
    >
      <!-- 展开/折叠箭头 -->
      <button
        class="flex items-center justify-center mr-1 transition-transform duration-200 shrink-0 text-xs font-bold bg-transparent border-none outline-none p-0"
        :class="{ 'rotate-90': isExpanded }"
        @click.stop="toggleExpand"
      >
        >
      </button>
      
      <!-- 文件夹图标 -->
      <span class="mr-2 shrink-0">
        <svg class="w-4 h-4" :class="isDark ? 'text-amber-400' : 'text-amber-500'" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
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
    
    <!-- 子内容和笔记（展开时显示） -->
    <div v-if="isExpanded" class="local-folder-children">
      <!-- 子文件夹 -->
      <LocalFolderItem
        v-for="childFolder in childFolders"
        :key="'local-folder-' + childFolder.name"
        :folder="{ ...childFolder, path: folderPath + '/' + childFolder.name }"
        :depth="depth + 1"
        :contents="childFolder.contents || []"
        :local-notes="localNotes"
        :note-store="noteStore"
      />
      
      <!-- 文件 -->
      <div
        v-for="file in files"
        :key="'local-file-' + file.name"
        class="local-note-item flex items-center px-2 py-1.5 rounded-xl cursor-pointer group transition-colors duration-200"
        :class="[
          isActive(file.noteId || file.name)
            ? (isDark ? 'bg-slate-600 text-indigo-300' : 'bg-white text-indigo-600')
            : (isDark 
                ? 'hover:bg-slate-600 text-slate-300' 
                : 'hover:bg-slate-200 text-slate-700')
        ]"
        :style="{ paddingLeft: ((depth + 1) * 16 + 24) + 'px' }"
        @click="openLocalNote(file)"
        @contextmenu.prevent="openFileMenu(file, $event)"
      >
        <!-- 笔记图标 -->
        <span class="mr-2 shrink-0">
          <svg class="w-3.5 h-3.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
          </svg>
        </span>
        <span class="flex-1 truncate text-sm">{{ getNoteTitle(file.name) }}</span>
        <button
          class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors duration-200 bg-transparent border-none outline-none p-0"
          :class="isDark ? 'hover:bg-slate-500 text-slate-400' : 'hover:bg-gray-300 text-gray-600'"
          @click.stop="openFileMenu(file, $event)"
        >
          ···
        </button>
      </div>
      
      <!-- 空文件夹提示 -->
      <div
        v-if="childFolders.length === 0 && files.length === 0"
        class="px-2 py-2 text-xs text-center italic"
        :class="isDark ? 'text-slate-500' : 'text-slate-400'"
        :style="{ paddingLeft: ((depth + 1) * 16 + 12) + 'px' }"
      >
        空文件夹
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'

// 递归引用自身（Vue 3.3+ 中使用 defineOptions 可以简化）
import LocalFolderItem from './LocalFolderItem.vue'

// 注册递归组件
defineOptions({
  name: 'LocalFolderItem'
})

const props = defineProps({
  folder: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  contents: {
    type: Array,
    default: () => []
  },
  localNotes: {
    type: Object,
    default: () => ({})
  },
  noteStore: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['expand', 'contextmenu', 'open-note'])

const isDark = inject('isDark', ref(false))

// 展开状态
const isExpanded = ref(false)

// 当前文件夹的完整相对路径（根层没有 path 时用 name）
const folderPath = computed(() => props.folder.path || props.folder.name)

// 子文件夹（从 contents 或 folder.children 获取，支持懒加载缓存）
const childFolders = computed(() => {
  const items = props.contents.length > 0 ? props.contents : (props.folder.contents || [])
  return items
    .filter(item => item.kind === 'directory')
    .map(item => ({
      name: item.name,
      contents: item.contents || [] // 懒加载后会填充
    }))
})

// 文件
const files = computed(() => {
  const items = props.contents.length > 0 ? props.contents : (props.folder.contents || [])
  return items.filter(item => item.kind === 'file' && item.name.endsWith('.md'))
})

// 获取 activeId
const getActiveId = () => {
  if (props.noteStore?.activeId !== undefined) return props.noteStore.activeId
  return null
}

// 检查笔记是否激活
const isActive = (noteId) => {
  return getActiveId() === noteId
}

// 从文件名获取笔记标题
const getNoteTitle = (filename) => {
  const mdName = filename.replace(/\.md$/i, '')
  // 优先从 localNotes 中找
  const note = props.localNotes[mdName]
  if (note) return note.title
  // 否则用文件名作为标题
  return mdName
}

// 打开本地笔记
const openLocalNote = async (file) => {
  emit('open-note', { name: file.name, dirPath: folderPath.value })
}

// 展开/折叠
const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
  emit('expand', props.folder.name, isExpanded.value)
}

// 右键菜单
const handleContextMenu = (e) => {
  e.stopPropagation()
  e.preventDefault()
  emit('contextmenu', { type: 'folder', target: props.folder.name, x: e.clientX, y: e.clientY })
}

// 文件右键菜单
const openFileMenu = (file, e) => {
  e.stopPropagation()
  e.preventDefault()
  emit('contextmenu', { type: 'file', target: { ...file, dirPath: folderPath.value }, x: e.clientX, y: e.clientY })
}
</script>