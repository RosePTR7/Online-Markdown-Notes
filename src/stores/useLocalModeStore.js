import { ref } from 'vue'
import matter from 'gray-matter'

// ==================== 运行时状态（模块级单例） ====================
const mode = ref(localStorage.getItem('localMode') || 'online')
let folderHandle = null
const folderCache = new Map()

// ==================== 持久配置（localStorage） ====================
const loadMode = () => {
  mode.value = localStorage.getItem('localMode') || 'online'
}

const saveMode = (m) => {
  localStorage.setItem('localMode', m)
}

// ==================== 初始化 ====================
loadMode()

// ==================== Actions ====================
const setMode = (m) => {
  mode.value = m
  saveMode(m)
}

const getMode = () => mode.value

const hasFolder = () => !!folderHandle

const setFolderHandle = (handle) => { folderHandle = handle }

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
  
  if (!folderHandle) throw new Error('未绑定本地文件夹')
  
  const dir = await getOrCreateDirectory(relativePath)
  const items = []
  for await (const [name, handle] of dir.values()) {
    items.push({ name, kind: handle.kind })
  }
  folderCache.set(cacheKey, items)
  return items
}

const invalidateCache = (relativePath) => {
  const cacheKey = relativePath || '__root__'
  folderCache.delete(cacheKey)
  for (const key of folderCache.keys()) {
    if (key.startsWith(cacheKey + '/')) folderCache.delete(key)
  }
}

const addLocalNote = async (dirPath, title, content) => {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const filename = `${id}.md`
  
  const fm = {
    title,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  }
  const fileContent = matter.stringify(content, fm)
  
  await writeFile(dirPath, filename, fileContent)
  invalidateCache(dirPath)
  return { id: filename.replace('.md', ''), path: dirPath, filename }
}

const addLocalFolder = async (parentPath, name) => {
  await getOrCreateDirectory(parentPath ? parentPath + '/' + name : name)
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
  for await (const [name, handle] of current.values()) {
    if (handle.kind === 'directory') {
      await current.removeEntryRecursive(name, { recursive: true })
    } else {
      await current.removeEntry(name)
    }
  }
  await current.removeEntry(parts[parts.length - 1])
  invalidateCache(dirPath)
}

// ==================== 单例导出 ====================
const instance = {
  // 状态
  mode,
  // Getters
  getMode,
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
  addLocalNote,
  addLocalFolder,
  deleteLocalNote,
  deleteLocalFolder
}

export function useLocalModeStore() {
  return instance
}