<template>
  <div class="local-folder-tree">
    <!-- 加载中 -->
    <div v-if="loading" class="px-4 py-4 text-center text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
      扫描本地文件...
    </div>
    
    <!-- 文件夹列表 -->
    <div v-else-if="topLevelItems.length > 0" class="px-1 pb-1">
      <LocalFolderItem
        v-for="item in topLevelItems"
        :key="'local-' + item.name"
        :folder="getFolderData(item)"
        :depth="0"
        :contents="item.contents || []"
        :local-notes="localNotesMap"
        :note-store="noteStoreRef"
        @expand="onFolderExpand"
        @contextmenu="onContextMenu"
        @open-note="onOpenNote"
      />
    </div>
    
    <!-- 空状态提示 -->
    <div
      v-else
      class="px-4 py-4 text-center text-xs"
      :class="isDark ? 'text-slate-500' : 'text-slate-400'"
    >
      该目录暂无文件或文件夹
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
          class="fixed shadow-lg border rounded-xl py-1 z-[101] w-48 transition-colors duration-300"
          :class="isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'"
          :style="{ left: menuX + 'px', top: menuY + 'px' }"
          @click.stop
        >
          <!-- 文件夹菜单 -->
          <template v-if="menuType === 'folder'">
            <div
              class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'"
              @click="addSubFolderInLocal"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              新建子文件夹
            </div>
            <div
              class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'"
              @click="addNoteInLocalFolder"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              新建笔记
            </div>
            <div class="h-px mx-2 my-1" :class="isDark ? 'bg-slate-600' : 'bg-slate-200'"></div>
            <div
              class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-500'"
              @click="confirmDeleteLocalFolder"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除文件夹
            </div>
          </template>

          <!-- 文件菜单 -->
          <template v-if="menuType === 'file'">
            <div
              class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-500'"
              @click="confirmDeleteLocalNote"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除笔记
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue'
import { useNoteStore } from '../stores/useNoteStore'
import { useModalStore } from '../stores/useModalStore'
import { useLocalModeStore } from '../stores/useLocalModeStore'
import LocalFolderItem from './LocalFolderItem.vue'

const isDark = inject('isDark', ref(false))
const noteStore = useNoteStore()
const modalStore = useModalStore()
const localModeStore = useLocalModeStore()

// 暴露 noteStore 给子组件
const noteStoreRef = noteStore

// 注意：不能解构 deleteLocalNote / deleteLocalFolder，因为后面要用同名函数
const { hasFolder, setFolderHandle, listDirectoryContents, readFile, writeFile, deleteFile, addLocalNote, addLocalFolder, invalidateCache } = localModeStore

// 加载状态
const loading = ref(false)

// 根目录内容
const rootItems = ref([])

// 懒加载缓存：{ folderPath: { [fileName]: contents[] } }
const folderCache = ref(new Map())

// 本地笔记索引（文件名 -> note 对象）
const localNotesMap = computed(() => {
  const map = {}
  for (const note of noteStore.noteList.value || []) {
    // 检查是否是本地的（id 是 nanoid 格式且没有文件夹归属或 folderId 为 null）
    if (note.folderId === null) {
      map[note.id + '.md'] = note
    }
  }
  return map
})

// 顶级项目
const topLevelItems = computed(() => rootItems.value)

// 获取文件夹数据（包含懒加载的内容）
const getFolderData = (item) => {
  const cacheKey = item.name
  const cached = folderCache.value.get(cacheKey)
  return {
    name: item.name,
    contents: cached || []
  }
}

// 扫描指定目录
async function scanDirectory(relativePath = '') {
  if (!hasFolder()) return []
  
  const contents = await listDirectoryContents(relativePath)
  
  // 对每个目录，先不扫描内容（懒加载）
  return contents
}

// 重新扫描
async function refreshScan() {
  if (!hasFolder()) {
    rootItems.value = []
    return
  }
  
  loading.value = true
  try {
    rootItems.value = await scanDirectory()
  } catch (err) {
    console.error('扫描本地文件夹失败:', err)
  } finally {
    loading.value = false
  }
}

// 文件夹展开时懒加载
async function onFolderExpand(folderName, isExpanded) {
  if (!isExpanded) return
  
  if (!hasFolder()) return
  
  // 检查是否已缓存
  if (folderCache.value.has(folderName)) return
  
  try {
    const contents = await listDirectoryContents(folderName)
    folderCache.value.set(folderName, contents)
  } catch (err) {
    console.error('懒加载文件夹失败:', err)
  }
}

// 打开笔记
const emit = defineEmits(['open-note'])

function onOpenNote(file) {
  emit('open-note', file)
}

// ========== 右键菜单 ==========
const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuType = ref('') // 'folder' | 'file'
const menuTarget = ref(null)

function onContextMenu(data) {
  menuVisible.value = true
  menuType.value = data.type
  menuTarget.value = data.target
  menuX.value = data.x
  menuY.value = data.y
}

function closeMenu() {
  menuVisible.value = false
  menuType.value = ''
  menuTarget.value = null
}

// 在文件夹内新建子文件夹
const addSubFolderInLocal = async () => {
  const parentPath = menuTarget.value
  closeMenu()
  
  const name = await modalStore.prompt({
    title: '新建子文件夹',
    defaultValue: '',
    placeholder: '请输入文件夹名称'
  })
  
  if (name && name.trim()) {
    await addLocalFolder(parentPath, name.trim())
    refreshScan()
  }
}

// 在文件夹内新建笔记
const addNoteInLocalFolder = async () => {
  const dirPath = menuTarget.value
  closeMenu()
  
  const name = await modalStore.prompt({
    title: '新建笔记',
    defaultValue: '',
    placeholder: '请输入笔记名称'
  })
  
  if (name && name.trim()) {
    await addLocalNote(dirPath, name.trim(), '')
    refreshScan()
  }
}

// 删除本地笔记（确认框函数，命名区别于 store 方法）
const confirmDeleteLocalNote = async () => {
  const filename = menuTarget.value.name
  closeMenu()
  
  const confirmed = await modalStore.confirm({
    title: '删除笔记',
    message: `确定删除文件 "${filename}" 吗？此操作无法撤销。`,
    confirmText: '删除',
    confirmDanger: true
  })
  
  if (confirmed) {
    try {
      await localModeStore.deleteLocalNote('', filename)
      refreshScan()
    } catch (err) {
      console.error('删除本地笔记失败:', err)
    }
  }
}

// 删除本地文件夹（确认框函数，命名区别于 store 方法）
const confirmDeleteLocalFolder = async () => {
  const folderName = menuTarget.value
  closeMenu()
  
  const confirmed = await modalStore.confirm({
    title: '删除文件夹',
    message: `确定删除文件夹 "${folderName}" 及其所有内容吗？此操作无法撤销。`,
    confirmText: '删除',
    confirmDanger: true
  })
  
  if (confirmed) {
    try {
      await localModeStore.deleteLocalFolder(folderName)
      refreshScan()
    } catch (err) {
      console.error('删除本地文件夹失败:', err)
    }
  }
}

onMounted(() => {
  refreshScan()
})

// 监听模式切换回本地时刷新
watch(() => localModeStore.mode, (newVal) => {
  if (newVal === 'local' && hasFolder()) {
    refreshScan()
  }
})

defineExpose({ refreshScan })
</script>