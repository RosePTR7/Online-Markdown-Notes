import { ref } from 'vue'

// ==================== 运行时状态（模块级单例） ====================
const mode = ref(localStorage.getItem('localMode') || 'online')
let folderHandle = null
const folderCache = new Map()

// ==================== 持久配置（localStorage） ====================
if (!localStorage.getItem('localMode')) {
  localStorage.setItem('localMode', 'online')
}

// ==================== Helpers ====================
const hasFolder = () => !!folderHandle

const setFolderHandle = (handle) => {
  folderHandle = handle
  // 绑定新目录前清空旧缓存，防止新旧目录数据混杂
  folderCache.clear()
}

const clearFolderHandle = () => {
  folderHandle = null
  folderCache.clear()
}

const getOrCreateDirectory = async (relativePath) => {
  if (!folderHandle) throw new Error('未绑定本地文件夹')
  
  let current = folderHandle
  if (relativePath) {
    const parts = relativePath.split('/').filter(Boolean)
    for (const part of parts) {
      try {
        current = await current.getDirectoryHandle(part, { create: true })
      } catch (e) {
        // 仅 NotFoundError 走兜底重试，其余错误（权限拒绝等）直接上抛
        if (e.name !== 'NotFoundError') throw e
        const handle = await current.getDirectoryHandle(part)
        current = handle
      }
    }
  }
  return current
}

const readFile = async (dirPath, filename) => {
  const dir = await getOrCreateDirectory(dirPath)
  const file = await dir.getFileHandle(filename)
  const blob = await file.getFile()
  return await blob.text()
}

const writeFile = async (dirPath, filename, content) => {
  const dir = await getOrCreateDirectory(dirPath)
  const fileHandle = await dir.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

const deleteFile = async (dirPath, filename) => {
  const dir = await getOrCreateDirectory(dirPath)
  await dir.removeEntry(filename)
}

const listDirectoryContents = async (relativePath) => {
  const cacheKey = relativePath || '__root__'
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)
  
  if (!folderHandle) return []
  
  try {
    const dir = await getOrCreateDirectory(relativePath)
    const items = []
    // 使用 for await...of 处理异步迭代器
    for await (const [name, handle] of dir.entries()) {
      items.push({ name, kind: handle.kind })
    }
    folderCache.set(cacheKey, items)
    return items
  } catch (err) {
    // 目录不存在属正常情况，静默返回空列表；其余错误保留日志
    if (err.name !== 'NotFoundError') console.error('遍历目录失败:', err)
    return []
  }
}

const invalidateCache = (relativePath) => {
  const cacheKey = relativePath || '__root__'
  folderCache.delete(cacheKey)
  for (const key of folderCache.keys()) {
    if (key.startsWith(cacheKey + '/')) folderCache.delete(key)
  }
}


// 递归复制目录内容（文件系统无原生 rename，需新建+复制+删除）
const copyDirectory = async (src, dest) => {
  for await (const [name, handle] of src.entries()) {
    if (handle.kind === 'directory') {
      const newDest = await dest.getDirectoryHandle(name, { create: true })
      await copyDirectory(handle, newDest)
    } else {
      const file = await handle.getFile()
      const content = await file.text()
      const newFile = await dest.getFileHandle(name, { create: true })
      const writable = await newFile.createWritable()
      await writable.write(content)
      await writable.close()
    }
  }
}

// ==================== Actions ====================
const setMode = (m) => {
  mode.value = m
  localStorage.setItem('localMode', m)
}

const addLocalFolder = async (parentPath, name) => {
  await getOrCreateDirectory(parentPath ? parentPath + '/' + name : name)
  // 写盘后使该目录的磁盘缓存失效，下次刷新会从磁盘重新扫描到新文件夹
  invalidateCache(parentPath)
}

const deleteLocalNote = async (dirPath, filename) => {
  await deleteFile(dirPath, filename)
  invalidateCache(dirPath)
}

const deleteLocalFolder = async (dirPath) => {
  if (!folderHandle) throw new Error('未绑定本地文件夹')
  const parts = dirPath.split('/').filter(Boolean)
  let current = folderHandle
  for (const part of parts) {
    current = await current.getDirectoryHandle(part)
  }
  // 安全删除子项
  for await (const [name, handle] of current.entries()) {
    if (handle.kind === 'directory') {
      try { await current.removeEntryRecursive(name, { recursive: true }) }
      catch { await current.removeEntry(name) }
    } else {
      await current.removeEntry(name)
    }
  }
  await current.removeEntry(parts[parts.length - 1])
  invalidateCache(dirPath)
}

// 重命名文件夹（新建新目录 → 复制内容 → 删除旧目录）
const renameDirectory = async (dirPath, newName) => {
  if (!folderHandle) throw new Error('未绑定本地文件夹')
  const parts = dirPath.split('/').filter(Boolean)
  const oldName = parts[parts.length - 1]
  if (!oldName || oldName === newName) return
  
  const parentPath = parts.slice(0, -1).join('/')
  const parent = await getOrCreateDirectory(parentPath)
  
  // 目标已存在则拒绝
  try {
    await parent.getDirectoryHandle(newName)
    throw new Error(`文件夹 "${newName}" 已存在`)
  } catch (e) {
    if (e.name !== 'NotFoundError') throw e
  }
  
  // 新建目录并复制内容
  const newDir = await parent.getDirectoryHandle(newName, { create: true })
  const oldDir = await parent.getDirectoryHandle(oldName)
  await copyDirectory(oldDir, newDir)
  
  // 删除旧目录
  await parent.removeEntry(oldName, { recursive: true })
  
  invalidateCache(parentPath)
}

// ==================== 单例导出 ====================
const instance = {
  // 状态
  mode,
  // Getters
  hasFolder,
  // Actions
  setMode,
  setFolderHandle,
  clearFolderHandle,
  getOrCreateDirectory,
  readFile,
  writeFile,
  deleteFile,
  listDirectoryContents,
  invalidateCache,
  addLocalFolder,
  deleteLocalNote,
  deleteLocalFolder,
  renameDirectory
}

export function useLocalModeStore() {
  return instance
}