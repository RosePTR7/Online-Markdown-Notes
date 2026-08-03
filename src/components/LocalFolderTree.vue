<template>
  <div class="local-folder-tree">
    <!-- 加载中 -->
    <div v-if="loading" class="px-4 py-4 text-center text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
      扫描本地文件...
    </div>
    
    <!-- 文件夹列表 -->
    <div v-if="rootFolders.length > 0" class="px-1 pb-1">
      <LocalFolderItem
        v-for="item in rootFolders"
        :key="'local-' + item.name"
        :folder="{ name: item.name, kind: item.kind, path: item.name }"
        :depth="0"
        :contents="folderCache.get(item.name) || []"
        :local-notes="localNotesMap"
        @expand="onFolderExpand"
        @contextmenu="onContextMenu"
        @open-note="emit('open-note', $event)"
        @refresh="$emit('refresh')"
      />
    </div>

    <!-- 根目录笔记（未分类） -->
    <div v-if="rootFiles.length > 0" class="px-1 pb-1">
      <div
        v-for="file in rootFiles"
        :key="'local-file-' + file.name"
        class="flex items-center px-2 py-1.5 rounded-xl cursor-pointer group transition-colors duration-200"
        :class="[
          isActive(file.name)
            ? (isDark ? 'bg-slate-600 text-indigo-300' : 'bg-white text-indigo-600')
            : (isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-200 text-slate-700')
        ]"
        @click="emit('open-note', { name: file.name })"
        @contextmenu.prevent="onContextMenu({ type: 'file', target: file, x: $event.clientX, y: $event.clientY })"
      >
        <span class="mr-2 shrink-0">
          <svg class="w-3.5 h-3.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
          </svg>
        </span>
        <span class="flex-1 truncate text-sm">{{ getNoteTitle(file.name) }}</span>
        <button
          class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors duration-200 bg-transparent border-none outline-none p-0"
          :class="isDark ? 'hover:bg-slate-500 text-slate-400' : 'hover:bg-gray-300 text-gray-600'"
          @click.stop="onContextMenu({ type: 'file', target: file, x: $event.clientX, y: $event.clientY })"
        >
          ···
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="rootItems.length === 0" class="px-4 py-4 text-center text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
      该目录暂无文件或文件夹
    </div>

    <!-- 未保存笔记（独立渲染，不与文件夹列表互斥） -->
    <div v-if="tempNotes.length > 0" class="px-1 pb-1 mt-2">
      <div class="px-3 py-2 border-b text-xs font-medium" :class="isDark ? 'text-slate-400 border-slate-600' : 'text-slate-500 border-slate-200'">
        未保存笔记 ({{ tempNotes.length }})
      </div>
      <div
        v-for="note in tempNotes"
        :key="'temp-' + note.id"
        class="flex items-center px-2 py-1.5 rounded-xl cursor-pointer group transition-colors duration-200 mt-1"
        :class="[
          activeId === note.id
            ? (isDark ? 'bg-slate-600 text-indigo-300' : 'bg-white text-indigo-600')
            : (isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-200 text-slate-700')
        ]"
        @click="handleOpenTempNote(note)"
      >
        <span class="mr-2 shrink-0">
          <svg class="w-3.5 h-3.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
          </svg>
        </span>
        <span class="flex-1 truncate text-sm">{{ note.title }}</span>
        <span v-if="note.isTemp" class="text-xs ml-2 opacity-50">●</span>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div v-if="menuVisible" class="fixed inset-0 z-[100]" @click="menuVisible=false" @contextmenu.prevent="menuVisible=false">
        <div
          class="fixed shadow-lg border rounded-xl py-1 z-[101] w-48 transition-colors duration-300"
          :class="isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'"
          :style="{ left: menuX + 'px', top: menuY + 'px' }"
          @click.stop
        >
          <!-- 文件夹菜单 -->
          <template v-if="menuType === 'folder'">
            <div class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'"
              @click="renameLocalFolder">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>重命名
            </div>
            <div class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'"
              @click="addSubFolderInLocal">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>新建子文件夹
            </div>
            <div class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'"
              @click="addNoteInLocalFolder">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>新建笔记
            </div>
            <div class="h-px mx-2 my-1" :class="isDark ? 'bg-slate-600' : 'bg-slate-200'"></div>
            <div class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-500'"
              @click="confirmDeleteLocalFolder">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>删除文件夹
            </div>
          </template>

          <!-- 文件菜单 -->
          <template v-if="menuType === 'file'">
            <div class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-500'"
              @click="confirmDeleteLocalNote">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>删除笔记
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, inject, onMounted, watch, computed } from 'vue'
import matter from 'gray-matter'
import { useModalStore } from '../stores/useModalStore'
import { useLocalModeStore } from '../stores/useLocalModeStore'
import { useNoteStore } from '../stores/useNoteStore'
import LocalFolderItem from './LocalFolderItem.vue'

const emit = defineEmits(['open-note', 'refresh'])
const isDark = inject('isDark', ref(false))
const modalStore = useModalStore()
const localModeStore = useLocalModeStore()
const noteStore = useNoteStore()

const { noteList, activeId, addLocalNoteDirectly, finalizeLocalNote } = noteStore
const { hasFolder, listDirectoryContents, addLocalFolder, deleteLocalNote, deleteLocalFolder, invalidateCache, renameDirectory } = localModeStore

// 临时/未保存笔记（在内存中但尚未写盘的）
const tempNotes = computed(() => 
  noteList.value.filter(n => n.isTemp === true)
)

// 加载状态
const loading = ref(false)
// 根目录内容（仅初始化时扫描）
const rootItems = ref([])
// 懒加载缓存：{ folderName: [{name, kind}, ...] }
const folderCache = ref(new Map())

// 根目录文件夹 / 根目录笔记
const rootFolders = computed(() => rootItems.value.filter(i => i.kind === 'directory'))
const rootFiles = computed(() => rootItems.value.filter(i => i.kind === 'file' && i.name.endsWith('.md')))

// 以文件名（不含 .md）为键的本地笔记映射，用于标题匹配
const localNotesMap = computed(() => {
  const map = {}
  for (const n of noteList.value) {
    if (n.filename) map[n.filename.replace(/\.md$/i, '')] = n
  }
  return map
})

// 从文件名获取笔记标题
const getNoteTitle = (filename) => {
  const mdName = filename.replace(/\.md$/i, '')
  const note = localNotesMap.value[mdName]
  return note ? note.title : mdName
}

// 检查笔记是否激活
const isActive = (filename) => {
  const mdName = filename.replace(/\.md$/i, '')
  const note = localNotesMap.value[mdName]
  return note ? activeId.value === note.id : false
}

// 扫描指定目录
async function scanDirectory(relativePath = '') {
  if (!hasFolder()) return []
  return await listDirectoryContents(relativePath)
}

// 增量合并：保留已存在项的 contents/结构，新增项、删除消失项
function mergeItems(oldList, newList) {
  const merged = oldList.map(old => {
    const fresh = newList.find(i => i.name === old.name && i.kind === old.kind)
    return fresh ? { ...fresh, contents: old.contents || [] } : old
  })
  for (const item of newList) {
    if (!merged.some(m => m.name === item.name && m.kind === item.kind)) {
      merged.push(item)
    }
  }
  return merged
}

// 并发锁：进行中的扫描复用同一 Promise，杜绝并发冲突
let scanPromise = null
async function refreshScan() {
  if (!hasFolder()) { rootItems.value = []; return }
  if (scanPromise) return scanPromise
  loading.value = true
  scanPromise = (async () => {
    try {
      const list = await scanDirectory()
      rootItems.value = mergeItems(rootItems.value, list)
    }
    catch (err) { console.error('扫描本地文件夹失败:', err) }
    finally { loading.value = false }
  })()
  try { await scanPromise } finally { scanPromise = null }
}

// 清空本地缓存并重新扫描（模式切换/目录切换时调用，保证串行）
async function resetAndScan() {
  folderCache.value = new Map()
  rootItems.value = []
  await refreshScan()
}

// 文件夹展开时懒加载
async function onFolderExpand(folderName, isExpanded) {
  if (!isExpanded || !hasFolder() || folderCache.value.has(folderName)) return
  try {
    const contents = await listDirectoryContents(folderName)
    folderCache.value.set(folderName, contents)
  } catch (err) { console.error('懒加载文件夹失败:', err) }
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

// 关闭菜单
const closeMenu = () => {
  menuVisible.value = false
  menuType.value = ''
  menuTarget.value = null
}

// 重命名本地文件夹
const renameLocalFolder = async () => {
  const dirPath = menuTarget.value
  closeMenu()
  
  const oldName = dirPath.split('/').pop()
  const newName = await modalStore.prompt({ title: '重命名文件夹', defaultValue: oldName, placeholder: '请输入文件夹名称' })
  if (newName?.trim() && newName.trim() !== oldName) {
    try {
      await renameDirectory(dirPath, newName.trim())
      refreshScan()
    } catch (err) {
      console.error('重命名文件夹失败:', err)
      modalStore.showToast('重命名失败: ' + err.message, 'error')
    }
  }
}

// 在文件夹内新建笔记（内存占位 + 异步写盘）
const addNoteInLocalFolder = async () => {
  const dirPath = menuTarget.value
  closeMenu()
  
  const name = await modalStore.prompt({ title: '新建笔记', placeholder: '请输入笔记名称' })
  if (!name?.trim()) return
  
  try {
    const result = await addLocalNoteDirectly(dirPath, name.trim(), '')
    if (result) {
      const fm = { title: name.trim(), created: new Date().toISOString(), updated: new Date().toISOString() }
      const fileContent = matter.stringify('', fm)
      await localModeStore.writeFile(dirPath, result.filename, fileContent)
      invalidateCache(dirPath)
      finalizeLocalNote(result.id, { filename: result.filename })
      // 刷新目录：根目录刷新根内容，子目录更新懒加载缓存
      if (dirPath) {
        const contents = await listDirectoryContents(dirPath)
        folderCache.value.set(dirPath, contents)
        // 展开相应的父文件夹
        const parent = dirPath.split('/')[0]
        const cached = folderCache.value.get(parent)
        if (cached) {
          const folderItem = cached.find(i => i.name === dirPath.split('/').pop())
          if (folderItem) folderItem.contents = contents
        }
      } else {
        refreshScan()
      }
    }
  } catch (err) {
    console.error('在文件夹内新建笔记失败:', err)
    modalStore.showToast('保存失败: ' + err.message, 'error')
  }
}

// 在文件夹内新建子文件夹（通知父组件处理）
const addSubFolderInLocal = async () => {
  const parentPath = menuTarget.value
  closeMenu()
  
  const name = await modalStore.prompt({ title: '新建子文件夹', placeholder: '请输入文件夹名称' })
  if (name?.trim()) {
    try {
      await localModeStore.addLocalFolder(parentPath, name.trim())
      refreshScan()
    } catch (err) {
      console.error('创建文件夹失败:', err)
    }
  }
}

// 删除本地笔记（确认框函数，命名区别于 store 方法）
const confirmDeleteLocalNote = async () => {
  const filename = menuTarget.value.name
  const dirPath = menuTarget.value.dirPath || ''
  closeMenu()
  
  const confirmed = await modalStore.confirm({
    title: '删除笔记', message: `确定删除文件 "${filename}" 吗？此操作无法撤销。`,
    confirmText: '删除', confirmDanger: true
  })
  
  if (confirmed) {
    try {
      await localModeStore.deleteLocalNote(dirPath, filename)
      refreshScan()
    } catch (err) {
      console.error('删除本地笔记失败:', err)
      modalStore.showToast('删除笔记失败: ' + err.message, 'error')
    }
  }
}

// 删除本地文件夹（确认框函数，命名区别于 store 方法）
const confirmDeleteLocalFolder = async () => {
  const folderName = menuTarget.value
  closeMenu()
  
  const confirmed = await modalStore.confirm({
    title: '删除文件夹', message: `确定删除文件夹 "${folderName}" 及其所有内容吗？此操作无法撤销。`,
    confirmText: '删除', confirmDanger: true
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

// 打开临时笔记
const handleOpenTempNote = (note) => {
  emit('open-note', { id: note.id, isTemp: true })
}

// 仅在初始化时扫描一次，模式切换回本地时也扫描（带防抖，避免连续切换重复扫描）
let scanTimer = null
onMounted(() => { refreshScan() })

watch(() => localModeStore.mode.value, (newVal) => {
  if (newVal !== 'local' || !hasFolder()) return
  clearTimeout(scanTimer)
  scanTimer = setTimeout(() => { resetAndScan() }, 200)
})

defineExpose({ refreshScan, resetAndScan })
</script>