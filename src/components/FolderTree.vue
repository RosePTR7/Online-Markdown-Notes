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
          @open-note="emit('open-note', $event)"
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

      <!-- 文件菜单（本地模式）：与在线笔记菜单共用同一套外观，仅底层分派到本地文件系统 -->
      <template v-if="menuType === 'file'">
        <MenuItem icon="rename" label="重命名" @click="renameLocalNote" />
        <div class="h-px mx-2 my-1" :class="isDark ? 'bg-slate-600' : 'bg-slate-200'"></div>
        <MenuItem icon="delete" label="删除笔记" danger @click="confirmDeleteLocalNote" />
      </template>
    </ContextMenu>
  </div>
</template>

<script setup>
import { ref, computed, inject, provide, onMounted, onUnmounted, watch } from 'vue'
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
  updateNote, moveNoteToFolder, delNote, removeLocalNote,
  noteList, activeId, createNote, updateLocalNoteLocation, updateLocalNotesDirPath
} = noteStore
const {
  hasFolder, listDirectoryContents, addLocalFolder, deleteLocalNote,
  deleteLocalFolder, renameDirectory, renameLocalFile, getFolderHandle, folderHandleVersion, invalidateCache
} = localModeStore

const isLocal = computed(() => localModeStore.mode.value === 'local')

// ========== 在线模式数据 ==========
const topLevelFolders = computed(() => getTopLevelFolders.value)

// ========== 本地模式数据 ==========
const loading = ref(false)
const rootItems = ref([])
// 已懒加载过的目录路径集合（替代原先 FolderTree 自建的 folderCache Map，避免与 store 的 folderCache 双缓存同一份目录列表）
const loadedDirs = ref(new Set())
const rootFolders = computed(() => rootItems.value.filter(i => i.kind === 'directory').sort((a, b) => a.name.localeCompare(b.name)))
const rootFiles = computed(() => rootItems.value.filter(i => i.kind === 'file' && i.name.endsWith('.md')).sort((a, b) => a.name.localeCompare(b.name)))

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

// 增量合并：以磁盘最新列表(newList)为基础，匹配项保留已展开文件夹的 contents（克隆为全新数组，
// 避免复用旧引用导致后续就地修改无法触发响应式），磁盘上已消失的项（删除/改名）一律丢弃。
function mergeItems(oldList, newList) {
  return newList.map(fresh => {
    const old = oldList.find(o => o.name === fresh.name && o.kind === fresh.kind)
    return old ? { ...fresh, contents: [...(old.contents || [])] } : { ...fresh }
  })
}

// 并发控制：进行中的扫描用 scanning 标记；深刷新请求若恰逢浅扫描在跑，记住 pendingDeep，扫描结束后补一次深刷新。
// 早期版本用「return scanPromise」直接复用在途 Promise，会把深刷新请求降级为浅刷新（deep 标志被丢弃），
// 导致嵌套目录改名/外部改动后侧边栏不刷新——现改为可升级的 pendingDeep 机制，且 scanning 必定在 finally 中清除，不会永久卡死。
let scanning = false
let pendingDeep = false
// deep=true 时额外同步所有已展开的子目录，反映外部深层改动（如磁盘改名/新建子目录内文件）
async function refreshScan(deep = false) {
  if (!hasFolder()) { rootItems.value = []; return }
  if (scanning) {
    if (deep) pendingDeep = true // 在途的若是浅刷新，也要等它结束后补一次深刷新
    return
  }
  scanning = true
  try {
    invalidateCache('') // 根目录一定从磁盘重读，避免读到旧缓存
    const list = await listDirectoryContents('')
    rootItems.value = mergeItems(rootItems.value, list)
    if (deep) {
      for (const dir of [...loadedDirs.value]) {
        invalidateCache(dir) // 子目录缓存一并失效，重扫才反映外部改动
        try {
          const contents = await listDirectoryContents(dir)
          setNodeContents(dir, contents)
        } catch (err) { console.error('深度刷新子目录失败:', err) }
      }
    }
  } catch (err) { console.error('扫描本地文件夹失败:', err) }
  finally {
    scanning = false
    if (pendingDeep) { pendingDeep = false; refreshScan(true) }
  }
}

// 清空本地缓存并重新扫描（模式切换/目录切换时调用，保证串行）
async function resetAndScan() {
  loadedDirs.value.clear()
  rootItems.value = []
  await refreshScan()
}

// 不可变更新：按路径在节点树中定位目标节点并替换其 contents，返回一棵树（路径沿途节点与新 contents 均为全新引用）。
// 替换 rootItems.value 整棵引用即可触发所有依赖该树的 FolderItem 重渲染，解决嵌套文件夹内改/删后侧边栏不刷新。
function replaceNodeContents(items, parts, newContents) {
  return items.map(node => {
    if (node.name !== parts[0]) return node
    if (parts.length === 1) {
      return { ...node, contents: newContents }
    }
    return { ...node, contents: replaceNodeContents(node.contents || [], parts.slice(1), newContents) }
  })
}

// 写入节点内容（不可变：重建整棵树并替换根引用，保证响应式链路可靠）
function setNodeContents(path, contents) {
  const parts = (path || '').split('/').filter(Boolean)
  if (parts.length === 0) return
  rootItems.value = replaceNodeContents(rootItems.value, parts, contents)
  loadedDirs.value.add(path)
}

// 直接在内存树中确定性地重命名某条目：沿 dirPath 定位父目录，把名为 oldName 的条目改为 newName。
// 重建整棵根的引用以保证响应式——这是「改名后立即反映到侧边栏」的可靠路径，
// 不依赖 disk 重读的时序（disk 重读仅用于周期对账，且以"disk 确实含新名"为前置）。
function renameTreeItem(dirPath, oldName, newName) {
  const parts = (dirPath || '').split('/').filter(Boolean)
  const walk = (items, depth) => items.map(node => {
    if (depth < parts.length) {
      if (node.kind === 'directory' && node.name === parts[depth]) {
        return { ...node, contents: walk(node.contents || [], depth + 1) }
      }
      return node
    }
    if (node.name === oldName) return { ...node, name: newName }
    return node
  })
  rootItems.value = walk(rootItems.value, 0)
}

// 文件夹展开时懒加载（来自本地 FolderItem 的 expand 事件）
async function onFolderExpand(folderPath, isExpanded) {
  if (!isExpanded || !hasFolder() || loadedDirs.value.has(folderPath)) return
  try {
    const contents = await listDirectoryContents(folderPath)
    setNodeContents(folderPath, contents)
  } catch (err) { console.error('懒加载文件夹失败:', err) }
}

// ========== 本地文件夹自动观察（FileSystemObserver） ==========
// 仅 Chromium（Chrome/Edge 133+）支持；不支持时静默降级，由手动刷新按钮兜底。
// 观察根目录句柄并 recursive: true，即可递归捕获其下所有层级的 created/deleted/modified/moved 事件（含子文件夹内文件改动）。
let fsObserver = null
let fsChangeTimer = null
let pendingFsRecords = []

// 由相对路径分量推导出"受影响的父目录"（相对被观察根目录）。
// 例：['a.md'] -> ''（根）；['Sub','a.md'] -> 'Sub'；['NewDir'] -> ''（根会列出新目录本身）
const affectedDirOf = (components) => {
  const comps = components || []
  if (comps.length <= 1) return ''
  return comps.slice(0, -1).join('/')
}

// 防抖：一次"保存"常触发多条记录，合并成一次刷新，避免连刷/闪烁
const scheduleFsRefresh = (records) => {
  if (records && records.length) pendingFsRecords.push(...records)
  if (fsChangeTimer) clearTimeout(fsChangeTimer)
  fsChangeTimer = setTimeout(() => {
    fsChangeTimer = null
    const recs = pendingFsRecords
    pendingFsRecords = []
    handleFsChanges(recs)
  }, 400)
}

// 根据变更记录：失效磁盘缓存、同步已打开标签页（外部删除/移动/文件夹重命名）、再从磁盘深刷新投影到网页。
// 磁盘即事实来源——所有网页状态都由 refreshScan 从磁盘重读得出，无需在各处手动同步变量。
const handleFsChanges = async (records) => {
  const dirs = new Set()

  // 当前树里所有已知目录路径（含未展开文件夹自身节点），本次刷新前树仍反映旧磁盘状态，
  // 故可用于识别"文件夹级 moved"的旧路径。
  const knownDirSet = new Set()
  const collectDirs = (items, prefix = '') => {
    for (const it of items) {
      if (it.kind === 'directory') {
        const p = prefix ? prefix + '/' + it.name : it.name
        knownDirSet.add(p)
        if (it.contents) collectDirs(it.contents, p)
      }
    }
  }
  collectDirs(rootItems.value)

  const deletes = []     // 外部删除的 .md：{name, dir}
  const creates = []     // 外部新建的 .md：{name, dir}
  const fileMoves = []   // 明确的 moved（单文件）：{oldName, oldDir, newName, newDir}
  const folderMoves = [] // 文件夹级 moved：{oldDirPath, newDirPath}
  const dirOf = (c) => (c.length > 1 ? c.slice(0, -1).join('/') : '')

  for (const rec of records) {
    const comps = rec.relativePathComponents || []
    dirs.add(affectedDirOf(comps))
    const last = comps[comps.length - 1]
    const isMd = !!last && last.toLowerCase().endsWith('.md')

    if (rec.type === 'moved' && rec.relativePathMovedFromComponents) {
      const fromComps = rec.relativePathMovedFromComponents
      if (isMd) {
        // 单个笔记文件被移动/重命名：自带 old+new 锚点，精确重映射
        fileMoves.push({
          oldName: fromComps[fromComps.length - 1],
          oldDir: dirOf(fromComps),
          newName: last,
          newDir: dirOf(comps)
        })
      } else {
        // 可能是文件夹被移动/重命名：仅当旧路径确为已知目录时才处理（避免误判非 .md 文件移动）
        const oldDirPath = fromComps.join('/')
        const newDirPath = comps.join('/')
        if (oldDirPath && knownDirSet.has(oldDirPath)) {
          folderMoves.push({ oldDirPath, newDirPath })
        }
      }
    } else if (rec.type === 'deleted' && isMd) {
      deletes.push({ name: last, dir: dirOf(comps) })
    } else if (rec.type === 'created' && isMd) {
      creates.push({ name: last, dir: dirOf(comps) })
    }
  }

  // 调和 delete+create 配对：某些浏览器把"文件夹重命名"报成 delete(旧路径)+create(新路径)，
  // 此时同名 .md 的删除应视为"移动"而非真正删除，避免误关已打开标签页、丢失内存中的编辑。
  const pairedMoves = []
  for (const d of deletes) {
    const idx = creates.findIndex(c => c.name === d.name)
    if (idx > -1) {
      const c = creates[idx]
      creates.splice(idx, 1) // 消费掉该 create，避免被当成新建
      pairedMoves.push({ oldName: d.name, oldDir: d.dir, newName: c.name, newDir: c.dir })
    } else {
      removeLocalNote(d.name, d.dir) // 确属删除：清理已打开的标签页
    }
  }

  // 应用所有文件级重映射（显式 moved + delete/create 配对推导）
  for (const m of [...fileMoves, ...pairedMoves]) {
    noteStore.updateLocalNoteLocation(m.oldName, m.oldDir, m.newName, m.newDir)
  }
  // 应用文件夹级重映射：批量把该目录下已打开标签页的 dirPath 前缀改掉
  for (const f of folderMoves) {
    noteStore.updateLocalNotesDirPath(f.oldDirPath, f.newDirPath)
  }

  for (const dir of dirs) invalidateCache(dir) // 先让磁盘缓存失效，下一步重扫才会读到最新
  refreshScan(true) // 统一从磁盘重读，投影到侧边栏与标签页
}

const startWatching = async () => {
  stopWatching() // 先断开旧观察器，避免重复
  if (!('FileSystemObserver' in window)) {
    console.info('当前浏览器不支持 FileSystemObserver，本地目录变更将仅通过手动刷新同步')
    return
  }
  const handle = getFolderHandle()
  if (!handle) return
  try {
    // 确保目录读取权限已授予；未授予则请求，用户拒绝则降级为手动刷新
    const perm = await handle.queryPermission?.({ mode: 'read' })
    if (perm !== 'granted') {
      const req = await handle.requestPermission?.({ mode: 'read' })
      if (req !== 'granted') {
        console.info('未授予目录读取权限，本地目录变更将仅通过手动刷新同步')
        return
      }
    }
    const ObserverCtor = window.FileSystemObserver
    fsObserver = new ObserverCtor((records) => scheduleFsRefresh(records))
    await fsObserver.observe(handle, { recursive: true })
  } catch (err) {
    console.error('启动本地目录观察失败，将仅通过手动刷新同步:', err)
    fsObserver = null
  }
}

const stopWatching = () => {
  if (fsChangeTimer) { clearTimeout(fsChangeTimer); fsChangeTimer = null }
  pendingFsRecords = []
  if (fsObserver) { try { fsObserver.disconnect() } catch (_) {} fsObserver = null }
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
// 本地写盘操作统一包裹：执行 + 从磁盘深刷新 + 失败 toast。
// 「磁盘即事实来源」：操作落到本地磁盘后，统一用 refreshScan(true) 重读投影，不再多处手动同步变量。
const runLocalOp = async (fn, failMsg, { refresh = true } = {}) => {
  try {
    await fn()
    if (refresh) refreshScan(true)
  } catch (err) {
    console.error(failMsg + ':', err)
    modalStore.showToast(failMsg + ': ' + err.message, 'error')
  }
}

// 重命名文件夹
const startRename = async () => {
  const target = menuTarget.value
  closeMenu()
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
      // 重命名文件夹后，批量把该目录下已打开笔记的 dirPath 前缀从旧路径改为新路径（一处更新）
      const parent = dirPath.includes('/') ? dirPath.slice(0, dirPath.lastIndexOf('/')) : ''
      const newDirPath = parent ? parent + '/' + trimmed : trimmed
      noteStore.updateLocalNotesDirPath(dirPath, newDirPath)
    }
  }
}

// 新建子文件夹
const addSubFolder = async () => {
  const parentPath = menuTarget.value
  closeMenu()
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
// 在文件夹内新建笔记（统一走 createNote 门面，由 store 按模式分派）
const addNoteInFolder = async () => {
  const dirPath = menuTarget.value
  closeMenu()
  const name = await modalStore.prompt({ title: '新建笔记', placeholder: '请输入笔记名称' })
  if (!name?.trim()) return

  const result = await createNote(dirPath, name.trim(), '')
  if (!result) return
  // 本地模式：写盘即落盘，统一用 refreshScan 从磁盘重读投影（替代原先按目录定向 setNodeContents 的多处刷新）
  if (isLocal.value) refreshScan(true)
}

// 删除文件夹
const confirmDeleteFolder = async () => {
  const target = menuTarget.value
  closeMenu()

  const folderName = isLocal.value ? target.split('/').pop() : (findFolderById(target)?.name || '')
  const confirmed = await modalStore.confirm({
    title: '删除文件夹',
    message: `确定删除文件夹 "${folderName}" 及其所有内容吗？删除后可到「回收站」恢复。`,
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
    title: '删除笔记', message: '确定删除这条笔记吗？删除后可到「回收站」恢复。', confirmText: '删除', confirmDanger: true
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
    removeLocalNote(name, dirPath) // 同步清理内存与标签栏中对应的本地笔记记录
  }
}

// 重命名本地笔记（对齐在线"重命名"菜单，仅底层分派到本地文件系统）
// 磁盘即事实来源：renameLocalFile 把重命名落到本地磁盘；随后仅更新「已打开标签页的磁盘位置」这一处，
// 侧边栏由 refreshScan(true) 从磁盘重读后自然反映新名字——不再在多处手动同步变量。
const renameLocalNote = async () => {
  const target = menuTarget.value
  closeMenu()
  const { name, dirPath } = target
  const oldTitle = getNoteTitle(name)
  const newTitle = await modalStore.prompt({ title: '重命名笔记', defaultValue: oldTitle, placeholder: '请输入笔记名称' })
  const trimmed = newTitle?.trim()
  if (!trimmed || trimmed === oldTitle) return
  const newName = trimmed.endsWith('.md') ? trimmed : trimmed + '.md'
  try {
    await renameLocalFile(dirPath, name, trimmed)
    noteStore.updateLocalNoteLocation(name, dirPath, newName, dirPath)
    // 确定性：直接在内存树中改名，侧边栏立即反映（不依赖 disk 重读时序，杜绝旧文件残留回退）
    renameTreeItem(dirPath, name, newName)
  } catch (err) {
    console.error('重命名笔记失败:', err)
    modalStore.showToast('重命名失败: ' + err.message, 'error')
  }
}

// 初始化：本地模式先扫描一次，并在有绑定目录时启动观察
onMounted(() => {
  if (isLocal.value) refreshScan()
  if (isLocal.value && hasFolder()) startWatching()
})

// 模式切换：进入本地则清缓存重扫并启动观察；离开则停止观察
watch(() => localModeStore.mode.value, (newVal) => {
  if (newVal !== 'local' || !hasFolder()) { stopWatching(); return }
  resetAndScan()
  startWatching()
})

// 绑定/更换/清空目录：句柄变化后先清缓存重扫（保证首次/更换绑定后立即出内容），再重启观察
watch(folderHandleVersion, () => {
  if (isLocal.value && hasFolder()) { resetAndScan(); startWatching() }
  else stopWatching()
})

// 组件卸载：务必断开观察器，避免内存泄漏与跨组件误触发
onUnmounted(() => stopWatching())

defineExpose({ refreshScan, resetAndScan })
</script>
