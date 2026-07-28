<template>
  <div class="folder-tree">
    <!-- 新建文件夹按钮 -->
    <div class="px-2 py-1">
      <button
        class="w-full py-1.5 text-sm rounded-lg border border-dashed flex items-center justify-center gap-1 transition-colors duration-200"
        :class="isDark 
          ? 'border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 hover:bg-slate-700/50' 
          : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50'"
        @click="addTopFolder"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        新建文件夹
      </button>
    </div>

    <!-- 文件夹列表 -->
    <div class="px-1 pb-1">
      <FolderItem
        v-for="folder in topLevelFolders"
        :key="'folder-' + folder.id"
        :folder="folder"
        :depth="0"
      />
      
      <!-- 空状态提示 -->
      <div
        v-if="topLevelFolders.length === 0"
        class="px-4 py-4 text-center text-xs"
        :class="isDark ? 'text-slate-500' : 'text-slate-400'"
      >
        暂无文件夹，点击上方按钮创建
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
          <!-- 文件夹菜单 -->
          <template v-if="menuType === 'folder'">
            <div
              class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'"
              @click="startRename"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              重命名
            </div>
            <div
              class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'"
              @click="addSubFolder"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              新建子文件夹
            </div>
            <div
              class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'"
              @click="addNoteInFolder"
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
              @click="confirmDeleteFolder"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除文件夹
            </div>
          </template>

          <!-- 笔记菜单 -->
          <template v-if="menuType === 'note'">
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
            <div
              class="px-3 py-2 cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-200 flex items-center gap-2"
              :class="isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-100 text-slate-700'"
              @click="moveToUnsorted"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              移至未分类
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
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, inject, provide } from 'vue'
import { useFolderStore } from '../stores/useFolderStore'
import { useNoteStore } from '../stores/useNoteStore'
import { useModalStore } from '../stores/useModalStore'
import FolderItem from './FolderItem.vue'

const isDark = inject('isDark', ref(false))
const folderStore = useFolderStore()
const noteStore = useNoteStore()
const modalStore = useModalStore()

const { addFolder, updateFolder, deleteFolder, getTopLevelFolders } = folderStore
const { addNote, updateNote, moveNoteToFolder, delNote } = noteStore

// 顶级文件夹
const topLevelFolders = computed(() => getTopLevelFolders.value)

// 菜单状态
const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuType = ref('') // 'folder' | 'note'
const menuTargetId = ref('')

// 打开菜单方法 - 提供给子组件
const openMenu = (data) => {
  menuVisible.value = true
  menuType.value = data.type
  menuTargetId.value = data.targetId
  menuX.value = data.x
  menuY.value = data.y
}

// 提供给子组件使用
provide('openContextMenu', openMenu)

// 关闭菜单
const closeMenu = () => {
  menuVisible.value = false
  menuType.value = ''
  menuTargetId.value = ''
}

// 新建顶级文件夹
const addTopFolder = async () => {
  await addFolder(null, '新建文件夹')
}

// 重命名文件夹
const startRename = async () => {
  const folder = folderStore.folderList.value.find(f => f.id === menuTargetId.value)
  if (!folder) return
  closeMenu()
  
  const newName = await modalStore.prompt({
    title: '重命名文件夹',
    defaultValue: folder.name,
    placeholder: '请输入文件夹名称'
  })
  
  if (newName && newName.trim()) {
    updateFolder(folder.id, { name: newName.trim() })
  }
}

// 新建子文件夹
const addSubFolder = async () => {
  await addFolder(menuTargetId.value, '新建文件夹')
  closeMenu()
}

// 在文件夹内新建笔记
const addNoteInFolder = async () => {
  await addNote(menuTargetId.value)
  closeMenu()
}

// 删除文件夹
const confirmDeleteFolder = async () => {
  const folder = folderStore.folderList.value.find(f => f.id === menuTargetId.value)
  if (!folder) return
  closeMenu()
  
  const confirmed = await modalStore.confirm({
    title: '删除文件夹',
    message: `确定删除文件夹 "${folder.name}" 及其所有内容吗？此操作无法撤销。`,
    confirmText: '删除',
    confirmDanger: true
  })
  
  if (confirmed) {
    await deleteFolder(folder.id)
  }
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

// 移至未分类
const moveToUnsorted = async () => {
  await moveNoteToFolder(menuTargetId.value, null)
  closeMenu()
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