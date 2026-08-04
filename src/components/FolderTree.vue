<template>
  <div class="folder-tree">
    <!-- 加载中（本地模式） -->
    <div v-if="isLocal && loading" class="px-4 py-4 text-center text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
      扫描本地文件...
    </div>

    <!-- 文件夹列表（在线/本地共用同一套渲染外观） -->
    <div class="px-1 pb-1">
      <!-- 在线模式：IndexedDB 文件夹树 -->
      <template v-if="!isLocal">
        <FolderItem
          v-for="folder in topLevelFolders"
          :key="'folder-' + folder.id"
          :folder="folder"
          :depth="0"
        />
      </template>

      <!-- 本地模式：文件系统扫描树 -->
      <template v-else>
        <FolderItem
          v-for="item in rootFolders"
          :key="'local-' + item.name"
          :folder="{ name: item.name, kind: item.kind, path: item.name }"
          :contents="item.contents || []"
          :is-local="true"
          :depth="0"
          @expand="onFolderExpand"
        />
      </template>

      <!-- 空状态 -->
      <div
        v-if="isLocal ? rootFolders.length === 0 : topLevelFolders.length === 0"
        class="px-4 py-4 text-center text-xs"
        :class="isDark ? 'text-slate-500' : 'text-slate-400'"
      >
        {{ isLocal ? '该目录暂无文件或文件夹' : '暂无文件夹，点击上方按钮创建' }}
      </div>
    </div>

    <!-- 本地模式：根目录笔记（未分类）+ 未保存笔记 -->
    <template v-if="isLocal">
      <!-- 根目录文件（未分类笔记） -->
      <div v-if="rootFiles.length > 0" class="px-1 pb-1">
        <div
          v-for="file in rootFiles"
          :key="'local-file-' + file.name"
          class="flex items-center px-2 py-1.5 rounded-xl cursor-pointer group transition-colors duration-200 border"
          :class="[
            isItemActive(file.name)
              ? (isDark ? 'bg-slate-600 border-indigo-500/50 text-indigo-300' : 'bg-white border-indigo-300 text-indigo-600')
              : (isDark ? 'bg-slate-600/30 border-slate-500/30 hover:bg-slate-600 text-slate-300' : 'bg-slate-200/50 border-slate-300/50 hover:bg-slate-200 text-slate-700')
          ]"
          @click="emit('open-note', { name: file.name, dirPath: '' })"
          @contextmenu.prevent="openFileMenu(file, $event)"
        >
          <span class="mr-2 shrink-0">
            <Icon name="doc" class="w-3.5 h-3.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'" />
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
          @click="emit('open-note', { id: note.id, isTemp: true })"
        >
          <span class="mr-2 shrink-0">
            <Icon name="doc" class="w-3.5 h-3.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'" />
          </span>
          <span class="flex-1 truncate text-sm">{{ note.title }}</span>
          <span v-if="note.isTemp" class="text-xs ml-2 opacity-50">●</span>
        </div>
      </div>
    </template>

    <!-- 右键菜单（在线/本地统一一套外观，仅菜单项与逻辑按模式区分；菜单项复用 MenuItem） -->
    <ContextMenu :visible="menuVisible" :x="menuX" :y="menuY" :menu-class="isLocal ? 'w-48' : 'w-40'" @close="closeMenu">
      <!-- 文件夹菜单 -->
      <template v-if="menuType === 'folder'">
        <MenuItem icon="rename" label="重命名" @click="startRename" />
        <MenuItem icon="add-folder" label="新建子文件夹" @click="addSubFolder" />
        <MenuItem icon="add-note" label="新建笔记" @click="addNoteInFolder" />
        <div class="h-px mx-2 my-1" :class="isDark ? 'bg-slate-600' : 'bg-slate-200'"></div>
        <MenuItem icon="delete" label="删除文件夹" danger @click="confirmDeleteFolder" />
      </template>

      <!-- 笔记菜单（在线模式） -->
      <template v-if="menuType === 'note'">
        <MenuItem icon="rename" label="重命名" @click="renameNote" />
        <MenuItem icon="move-unsorted" label="移至未分类" @click="moveToUnsorted" />
        <div class="h-px mx-2 my-1" :class="isDark ? 'bg-slate-600' : 'bg-slate-200'"></div>
        <MenuItem icon="delete" label="删除笔记" danger @click="deleteNote" />
      </template>

      <!-- 文件菜单（本地模式） -->
      <template v-if="menuType === 'file'">
        <MenuItem icon="delete" label="删除笔记" danger @click="confirmDeleteLocalNote" />
      </template>
    </ContextMenu>
  </div>
</template>

<script setup>
import { ref, computed, inject, provide, onMounted, watch } from 'vue'
import { useFolderStore } from '../stores/useFolderStore'
import { useNoteStore } from '../stores/useNoteStore'
import { useModalStore } from '../stores/useModalStore'
import { useLocalModeStore } from '../stores/useLocalModeStore'
import FolderItem from './FolderItem.vue'
import Icon from './Icon.vue'
import ContextMenu from './ContextMenu.vue'
import MenuItem from './MenuItem.vue'
import { resolveLocalTitle, isLocalActive } from '../utils/localNotes'

const emit = defineEmits(['open-note', 'refresh'])

const isDark = inject('isDark', ref(false))
const folderStore = useFolderStore()
const noteStore = useNoteStore()
const modalStore = useModalStore()
const localModeStore = useLocalModeStore()

const {
  addFolder, updateFolder, deleteFolder,
  getTopLevelFolders, folderList
} = folderStore
const {
  addNote, updateNote, moveNoteToFolder, delNote,
  noteList, activeId, createLocalNote
} = noteStore
const {
  hasFolder, listDirectoryContents, addLocalFolder, deleteLocalNote,
  deleteLocalFolder, renameDirectory
} = localModeStore

const isLocal = computed(() => localModeStore.mode.value === 'local')

// ========== 在线模式数据 ==========
const topLevelFolders = computed(() => getTopLevelFolders.value)

// ========== 本地模式数据 ==========
const loading = ref(false)
const rootItems = ref([])
// 已懒加载过的目录路径集合（替代原先 FolderTree 自建的 folderCache Map，避免与 store 的 folderCache 双缓存同一份目录列表）
const loadedDirs = ref(new Set())
const rootFolders = computed(() => rootItems.value.filter(i => i.kind === 'directory'))
const rootFiles = computed(() => rootItems.value.filter(i => i.kind === 'file' && i.name.endsWith('.md')))

const tempNotes = computed(() => noteList.value.filter(n => n.isTemp === true))
const localNotesMap = computed(() => {
  const map = {}
  for (const n of noteList.value) {
    if (n.filename) map[n.filename.replace(/\.md$/i, '')] = n
  }
  return map
})
// 供 FolderItem 在本地模式下解析文件名→标题/激活态
provide('localNotesMap', localNotesMap)

const getNoteTitle = (filename) => resolveLocalTitle(localNotesMap.value, filename)
const isItemActive = (filename) => isLocalActive(localNotesMap.value, filename, activeId.value)
const openFileMenu = (file, e) => {
  e.stopPropagation()
  e.preventDefault()
  openContextMenu({ type: 'file', target: { name: file.name, dirPath: '' }, x: e.clientX, y: e.clientY })
}

// 扫描指定目录
async function scanDirectory(relativePath = '') {
  if (!hasFolder()) return []
  return await listDirectoryContents(relativePath)
}

// 增量合并：保留已存在项的 contents，新增项、删除消失项
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

// 并发锁：进行中的扫描复用同一 Promise
let scanPromise = null
async function refreshScan() {
  if (!hasFolder()) { rootItems.value = []; return }
  if (scanPromise) return scanPromise
  loading.value = true
  scanPromise = (async () => {
    try {
      const list = await scanDirectory()
      rootItems.value = mergeItems(rootItems.value, list)
    } catch (err) { console.error('扫描本地文件夹失败:', err) }
    finally { loading.value = false }
  })()
  try { await scanPromise } finally { scanPromise = null }
}

// 清空本地缓存并重新扫描（模式切换/目录切换时调用，保证串行）
async function resetAndScan() {
  loadedDirs.value.clear()
  rootItems.value = []
  await refreshScan()
}

// 按路径在节点树中查找节点（支持嵌套）
function findNodeByPath(items, path) {
  const parts = path.split('/').filter(Boolean)
  let list = items
  let node = null
  for (const part of parts) {
    node = list.find(i => i.name === part)
    if (!node) return null
    list = node.contents || (node.contents = [])
  }
  return node
}

// 写入节点内容（就地修改，保证引用不丢失，递归 FolderItem 能响应）
function setNodeContents(path, contents) {
  const node = findNodeByPath(rootItems.value, path)
  if (node) {
    node.contents = contents
  }
  loadedDirs.value.add(path)
}

// 文件夹展开时懒加载（来自本地 FolderItem 的 expand 事件）
async function onFolderExpand(folderPath, isExpanded) {
  if (!isExpanded || !hasFolder() || loadedDirs.value.has(folderPath)) return
  try {
    const contents = await listDirectoryContents(folderPath)
    setNodeContents(folderPath, contents)
  } catch (err) { console.error('懒加载文件夹失败:', err) }
}

// ========== 右键菜单（在线/本地统一） ==========
const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuType = ref('') // 'folder' | 'note' | 'file'
const menuTarget = ref(null) // 在线：id 字符串；本地：路径字符串 或 { name, dirPath }

const openContextMenu = (data) => {
  menuVisible.value = true
  menuType.value = data.type
  menuTarget.value = data.target
  menuX.value = data.x
  menuY.value = data.y
}
// 提供给 FolderItem（在线/本地都用同一入口打开菜单）
provide('openContextMenu', openContextMenu)

const closeMenu = () => {
  menuVisible.value = false
  menuType.value = ''
  menuTarget.value = null
}

// ===== 菜单 handler 公共 helper：消除本地分支重复的 try/catch/刷新/toast 与文件夹查找 =====
const findFolderById = (id) => folderList.value.find(f => f.id === id)
// 本地写盘操作统一包裹：执行 + 刷新扫描 + 失败 toast；refresh=false 时由调用方自行刷新（如子目录定向刷新）
const runLocalOp = async (fn, failMsg, { refresh = true } = {}) => {
  try {
    await fn()
    if (refresh) refreshScan()
  } catch (err) {
    console.error(failMsg + ':', err)
    modalStore.showToast(failMsg + ': ' + err.message, 'error')
  }
}

// 重命名文件夹
const startRename = async () => {
  closeMenu()
  const target = menuTarget.value
  if (!isLocal.value) {
    const folder = findFolderById(target)
    if (!folder) return
    const newName = await modalStore.prompt({
      title: '重命名文件夹', defaultValue: folder.name, placeholder: '请输入文件夹名称'
    })
    if (newName && newName.trim()) updateFolder(folder.id, { name: newName.trim() })
  } else {
    const dirPath = target
    const oldName = dirPath.split('/').pop()
    const newName = await modalStore.prompt({ title: '重命名文件夹', defaultValue: oldName, placeholder: '请输入文件夹名称' })
    const trimmed = newName?.trim()
    if (trimmed && trimmed !== oldName) {
      await runLocalOp(() => renameDirectory(dirPath, trimmed), '重命名失败')
    }
  }
}

// 新建子文件夹
const addSubFolder = async () => {
  closeMenu()
  const parentPath = menuTarget.value
  const newName = await modalStore.prompt({ title: '新建子文件夹', defaultValue: '', placeholder: '请输入文件夹名称' })
  const trimmed = newName?.trim()
  if (!trimmed) return
  if (isLocal.value) {
    await runLocalOp(() => addLocalFolder(parentPath, trimmed), '创建文件夹失败')
  } else {
    await addFolder(parentPath, trimmed)
  }
}

// 在文件夹内新建笔记
const addNoteInFolder = async () => {
  closeMenu()
  const dirPath = menuTarget.value
  const name = await modalStore.prompt({ title: '新建笔记', placeholder: '请输入笔记名称' })
  if (!name?.trim()) return

  if (isLocal.value) {
    try {
      const result = await createLocalNote(dirPath, name.trim(), '')
      if (result) {
        // 刷新目录：根目录刷新根内容，子目录更新懒加载缓存
        if (dirPath) {
          const contents = await listDirectoryContents(dirPath)
          setNodeContents(dirPath, contents)
        } else {
          refreshScan()
        }
      }
    } catch (err) {
      console.error('在文件夹内新建笔记失败:', err)
      modalStore.showToast('保存失败: ' + err.message, 'error')
    }
  } else {
    await addNote(dirPath)
  }
}

// 删除文件夹
const confirmDeleteFolder = async () => {
  const target = menuTarget.value
  closeMenu()

  const folderName = isLocal.value ? target.split('/').pop() : (findFolderById(target)?.name || '')
  const confirmed = await modalStore.confirm({
    title: '删除文件夹',
    message: `确定删除文件夹 "${folderName}" 及其所有内容吗？此操作无法撤销。`,
    confirmText: '删除',
    confirmDanger: true
  })

  if (confirmed) {
    if (isLocal.value) {
      await runLocalOp(() => deleteLocalFolder(target), '删除本地文件夹失败')
    } else {
      await deleteFolder(target)
    }
  }
}

// 重命名笔记（在线）
const renameNote = async () => {
  const note = noteList.value.find(n => n.id === menuTarget.value)
  if (!note) return
  closeMenu()
  const newName = await modalStore.prompt({ title: '重命名笔记', defaultValue: note.title, placeholder: '请输入笔记名称' })
  if (newName && newName.trim()) updateNote(note.id, { title: newName.trim() })
}

// 移至未分类（在线）
const moveToUnsorted = async () => {
  await moveNoteToFolder(menuTarget.value, null)
  closeMenu()
}

// 删除笔记（在线）
const deleteNote = async () => {
  const targetId = menuTarget.value
  closeMenu()
  const confirmed = await modalStore.confirm({
    title: '删除笔记', message: '确定删除这条笔记吗？此操作无法撤销。', confirmText: '删除', confirmDanger: true
  })
  if (confirmed) delNote(targetId)
}

// 删除本地笔记（文件）
const confirmDeleteLocalNote = async () => {
  const { name, dirPath } = menuTarget.value
  closeMenu()
  const confirmed = await modalStore.confirm({
    title: '删除笔记', message: `确定删除文件 "${name}" 吗？此操作无法撤销。`, confirmText: '删除', confirmDanger: true
  })
  if (confirmed) {
    await runLocalOp(() => deleteLocalNote(dirPath, name), '删除笔记失败')
  }
}

// 仅在初始化时扫描一次，模式切换回本地时也扫描
onMounted(() => { if (isLocal.value) refreshScan() })

watch(() => localModeStore.mode.value, (newVal) => {
  if (newVal !== 'local' || !hasFolder()) return
  resetAndScan()
})

defineExpose({ refreshScan, resetAndScan })
</script>
