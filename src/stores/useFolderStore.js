import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { folderTable, noteTable } from '../utils/db'

// ==================== 运行时状态（模块级单例） ====================
const folderList = ref([])
const expandedFolders = ref(new Set())

const dragState = ref({
  isDragging: false,
  dragItem: null,
  dragOverId: null,
  dragOverPosition: null
})

// ==================== 持久配置（localStorage） ====================
const loadExpandedState = () => {
  const saved = localStorage.getItem('expandedFolders')
  if (saved) {
    try { return JSON.parse(saved) } catch { return [] }
  }
  return []
}

const saveExpandedState = () => {
  localStorage.setItem('expandedFolders', JSON.stringify([...expandedFolders.value]))
}

// ==================== 从 IndexedDB / localStorage 加载 ====================
const loadFolders = async () => {
  folderList.value = await folderTable.toArray()
  expandedFolders.value = new Set(loadExpandedState())
}

// ==================== Actions ====================
const addFolder = async (parentId = null, name = '新建文件夹') => {
  const siblings = folderList.value.filter(f => f.parentId === parentId)
  const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.order || 0)) : -1
  
  const newFolder = {
    id: nanoid(),
    name,
    parentId,
    order: maxOrder + 1,
    createTime: Date.now(),
    updateTime: Date.now()
  }
  
  await folderTable.add(newFolder)
  folderList.value.push(newFolder)
  
  expandedFolders.value.add(parentId ?? newFolder.id)
  saveExpandedState()
  return newFolder
}

const deleteFolder = async (id) => {
  const getChildIds = (pid) => {
    const children = folderList.value.filter(f => f.parentId === pid)
    let ids = children.map(c => c.id)
    children.forEach(child => { ids = ids.concat(getChildIds(child.id)) })
    return ids
  }
  
  const idsToDelete = [id, ...getChildIds(id)]
  await noteTable.where('folderId').anyOf(idsToDelete).delete()
  await folderTable.where('id').anyOf(idsToDelete).delete()
  
  folderList.value = folderList.value.filter(f => !idsToDelete.includes(f.id))
  idsToDelete.forEach(fid => expandedFolders.value.delete(fid))
  saveExpandedState()
}

const updateFolder = async (id, payload) => {
  const idx = folderList.value.findIndex(f => f.id === id)
  if (idx > -1) {
    const updated = { ...folderList.value[idx], ...payload, updateTime: Date.now() }
    await folderTable.put(updated)
    folderList.value[idx] = updated
  }
}

const toggleFolder = (id) => {
  expandedFolders.value.has(id) ? expandedFolders.value.delete(id) : expandedFolders.value.add(id)
  saveExpandedState()
}

const moveFolder = async (id, targetParentId, position = 'inside') => {
  if (targetParentId === id) return
  
  const getChildIds = (pid) => {
    const children = folderList.value.filter(f => f.parentId === pid)
    let ids = children.map(c => c.id)
    children.forEach(child => { ids = ids.concat(getChildIds(child.id)) })
    return ids
  }
  
  if (getChildIds(id).includes(targetParentId)) return
  
  const folder = folderList.value.find(f => f.id === id)
  const targetFolder = folderList.value.find(f => f.id === targetParentId)
  if (!folder || !targetFolder) return
  
  if (position === 'inside') {
    const siblings = folderList.value.filter(f => f.parentId === targetParentId && f.id !== id)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.order || 0)) : -1
    await updateFolder(id, { parentId: targetParentId, order: maxOrder + 1 })
  } else {
    const parentId = targetFolder.parentId
    const newOrder = position === 'before' ? targetFolder.order - 0.5 : targetFolder.order + 0.5
    await updateFolder(id, { parentId, order: newOrder })
    
    // 重新排序
    const siblings = folderList.value.filter(f => f.parentId === parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
    for (let i = 0; i < siblings.length; i++) {
      if (siblings[i].order !== i) await updateFolder(siblings[i].id, { order: i })
    }
  }
}

const moveNoteToFolder = async (noteId, folderId) => {
  await noteTable.update(noteId, { folderId, updateTime: Date.now() })
}

const setDragState = (state) => { dragState.value = { ...dragState.value, ...state } }
const clearDragState = () => { dragState.value = { isDragging: false, dragItem: null, dragOverId: null, dragOverPosition: null } }

// ==================== Getters ====================
const isFolderExpanded = (id) => expandedFolders.value.has(id)
const getChildFolders = (parentId) =>
  folderList.value.filter(f => f.parentId === parentId).sort((a, b) => (a.order || 0) - (b.order || 0))

const getTopLevelFolders = computed(() =>
  folderList.value.filter(f => f.parentId === null).sort((a, b) => (a.order || 0) - (b.order || 0))
)

// ==================== 单例导出 ====================
const instance = {
  folderList,
  expandedFolders,
  dragState,
  isFolderExpanded,
  getChildFolders,
  getTopLevelFolders,
  loadFolders,
  addFolder,
  deleteFolder,
  updateFolder,
  toggleFolder,
  moveFolder,
  moveNoteToFolder,
  setDragState,
  clearDragState
}

export function useFolderStore() {
  return instance
}