import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { folderTable, noteTable } from '../utils/db'

// 模块级别的单例状态
const folderList = ref([])
const expandedFolders = ref(new Set()) // 展开的文件夹ID集合

// 拖拽状态
const dragState = ref({
  isDragging: false,
  dragItem: null, // { type: 'note' | 'folder', id: string }
  dragOverId: null,
  dragOverPosition: null // 'before' | 'inside' | 'after'
})

export function useFolderStore() {
  // 从数据库加载所有文件夹
  const loadFolders = async () => {
    const list = await folderTable.toArray()
    folderList.value = list
    // 恢复展开状态
    const savedExpanded = localStorage.getItem('expandedFolders')
    if (savedExpanded) {
      try {
        const ids = JSON.parse(savedExpanded)
        expandedFolders.value = new Set(ids)
      } catch (e) {
        expandedFolders.value = new Set()
      }
    }
  }

  // 保存展开状态到 localStorage
  const saveExpandedState = () => {
    localStorage.setItem('expandedFolders', JSON.stringify([...expandedFolders.value]))
  }

  // 创建新文件夹
  const addFolder = async (parentId = null, name = '新建文件夹') => {
    // 计算排序序号
    const siblings = folderList.value.filter(f => f.parentId === parentId)
    const maxOrder = siblings.length > 0 
      ? Math.max(...siblings.map(f => f.order || 0)) 
      : -1
    
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
    
    // 自动展开父文件夹
    if (parentId) {
      expandedFolders.value.add(parentId)
      saveExpandedState()
    }
    // 展开新创建的文件夹
    expandedFolders.value.add(newFolder.id)
    saveExpandedState()
    
    return newFolder
  }

  // 删除文件夹（级联删除子文件夹和笔记）
  const deleteFolder = async (id) => {
    // 递归获取所有子文件夹ID
    const getChildFolderIds = (parentId) => {
      const children = folderList.value.filter(f => f.parentId === parentId)
      let ids = children.map(c => c.id)
      children.forEach(child => {
        ids = ids.concat(getChildFolderIds(child.id))
      })
      return ids
    }

    const folderIdsToDelete = [id, ...getChildFolderIds(id)]
    
    // 删除文件夹内的笔记
    await noteTable.where('folderId').anyOf(folderIdsToDelete).delete()
    
    // 删除文件夹
    await folderTable.where('id').anyOf(folderIdsToDelete).delete()
    
    // 更新本地状态
    folderList.value = folderList.value.filter(f => !folderIdsToDelete.includes(f.id))
    folderIdsToDelete.forEach(fid => expandedFolders.value.delete(fid))
    saveExpandedState()
  }

  // 更新文件夹信息
  const updateFolder = async (id, payload) => {
    const idx = folderList.value.findIndex(f => f.id === id)
    if (idx > -1) {
      const updated = {
        ...folderList.value[idx],
        ...payload,
        updateTime: Date.now()
      }
      await folderTable.put(updated)
      folderList.value[idx] = updated
    }
  }

  // 切换文件夹展开/折叠
  const toggleFolder = (id) => {
    if (expandedFolders.value.has(id)) {
      expandedFolders.value.delete(id)
    } else {
      expandedFolders.value.add(id)
    }
    saveExpandedState()
  }

  // 检查文件夹是否展开
  const isFolderExpanded = (id) => {
    return expandedFolders.value.has(id)
  }

  // 获取文件夹的子文件夹
  const getChildFolders = (parentId) => {
    return folderList.value
      .filter(f => f.parentId === parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  }

  // 获取顶级文件夹
  const getTopLevelFolders = computed(() => {
    return folderList.value
      .filter(f => f.parentId === null)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  })

  // 移动文件夹
  const moveFolder = async (id, targetParentId, position = 'inside') => {
    const folder = folderList.value.find(f => f.id === id)
    if (!folder) return

    // 不能移动到自身或自身的子文件夹
    if (targetParentId === id) return
    
    const getChildFolderIds = (parentId) => {
      const children = folderList.value.filter(f => f.parentId === parentId)
      let ids = children.map(c => c.id)
      children.forEach(child => {
        ids = ids.concat(getChildFolderIds(child.id))
      })
      return ids
    }
    
    const descendantIds = getChildFolderIds(id)
    if (descendantIds.includes(targetParentId)) return

    if (position === 'inside') {
      // 移动到目标文件夹内部
      const siblings = folderList.value.filter(f => f.parentId === targetParentId && f.id !== id)
      const maxOrder = siblings.length > 0 
        ? Math.max(...siblings.map(f => f.order || 0)) 
        : -1
      
      await updateFolder(id, { 
        parentId: targetParentId,
        order: maxOrder + 1 
      })
    } else {
      // 移动到目标文件夹的同级
      const targetFolder = folderList.value.find(f => f.id === targetParentId)
      if (!targetFolder) return
      
      const parentId = targetFolder.parentId
      const siblings = folderList.value.filter(f => f.parentId === parentId && f.id !== id)
      
      let newOrder
      if (position === 'before') {
        newOrder = targetFolder.order - 0.5
      } else {
        newOrder = targetFolder.order + 0.5
      }
      
      await updateFolder(id, { 
        parentId,
        order: newOrder 
      })
      
      // 重新排序
      await reorderSiblings(parentId)
    }
  }

  // 重新排序同级文件夹
  const reorderSiblings = async (parentId) => {
    const siblings = folderList.value
      .filter(f => f.parentId === parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
    
    for (let i = 0; i < siblings.length; i++) {
      if (siblings[i].order !== i) {
        await updateFolder(siblings[i].id, { order: i })
      }
    }
  }

  // 移动笔记到文件夹
  const moveNoteToFolder = async (noteId, folderId) => {
    await noteTable.update(noteId, { 
      folderId,
      updateTime: Date.now() 
    })
    
    // 更新 noteList（需要从 useNoteStore 同步）
    return { noteId, folderId }
  }

  // 设置拖拽状态
  const setDragState = (state) => {
    dragState.value = { ...dragState.value, ...state }
  }

  // 清除拖拽状态
  const clearDragState = () => {
    dragState.value = {
      isDragging: false,
      dragItem: null,
      dragOverId: null,
      dragOverPosition: null
    }
  }

  return {
    folderList,
    expandedFolders,
    dragState,
    loadFolders,
    addFolder,
    deleteFolder,
    updateFolder,
    toggleFolder,
    isFolderExpanded,
    getChildFolders,
    getTopLevelFolders,
    moveFolder,
    moveNoteToFolder,
    setDragState,
    clearDragState
  }
}