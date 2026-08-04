import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { noteTable, aiConfigTable } from '../utils/db'
import { useLocalModeStore } from './useLocalModeStore'
import { buildLocalNoteFile } from '../utils/localFile'

// ==================== 运行时状态（模块级单例） ====================
const noteList = ref([])
const openTabs = ref([])
const activeId = ref('')

// ==================== 持久配置（localStorage） ====================
const aiConfig = ref({ baseUrl: '', apiKey: '', model: '' })

// ==================== Computed ====================
const currentNote = computed(() => noteList.value.find(n => n.id === activeId.value) || null)
// 在线「未分类笔记」排除本地笔记（isLocal）
const getUnsortedNotes = computed(() => noteList.value.filter(n => n.folderId === null && !n.isLocal))

// ==================== Load ====================
const loadNotes = async () => {
  const list = await noteTable.toArray()
  const migrated = list.map(n => ({ ...n, folderId: n.folderId ?? null }))
  noteList.value = migrated
  const needsUpdate = migrated.some((m, i) => list[i].folderId === undefined)
  if (needsUpdate) await noteTable.bulkPut(migrated)
}

const loadAiConfig = async () => {
  const record = await aiConfigTable.get('global')
  if (record) aiConfig.value = { baseUrl: record.baseUrl || '', apiKey: record.apiKey || '', model: record.model || '' }
}

const saveAiConfig = () => aiConfigTable.put({ id: 'global', ...aiConfig.value })

// ==================== Actions（在线模式 - IndexedDB） ====================
const addNote = async (folderId = null) => {
  const newNote = { id: nanoid(), title: '新建无标题笔记', content: '# 在这里编写你的Markdown笔记', folderId, createTime: Date.now(), updateTime: Date.now() }
  await noteTable.add(newNote)
  noteList.value.push(newNote)
  openNote(newNote.id)
  return newNote
}

const delNote = async (id) => {
  await noteTable.delete(id)
  noteList.value = noteList.value.filter(i => i.id !== id)
  openTabs.value = openTabs.value.filter(t => t.id !== id)
  if (activeId.value === id) activeId.value = openTabs.value[0]?.id || ''
}

const updateNote = (id, payload) => {
  const idx = noteList.value.findIndex(n => n.id === id)
  if (idx > -1) {
    const updated = { ...noteList.value[idx], ...payload, updateTime: Date.now() }
    noteTable.put(updated)
    noteList.value[idx] = updated
  }
}

const moveNoteToFolder = (noteId, folderId) => {
  const idx = noteList.value.findIndex(n => n.id === noteId)
  if (idx > -1) {
    const updated = { ...noteList.value[idx], folderId }
    noteTable.put(updated)
    noteList.value[idx] = updated
  }
}

const openNote = (id) => {
  const target = noteList.value.find(n => n.id === id)
  if (!target) return
  activeId.value = id
  if (!openTabs.value.some(t => t.id === id)) openTabs.value.push({ id, title: target.title })
}

const closeTab = (id) => {
  openTabs.value = openTabs.value.filter(t => t.id !== id)
  if (activeId.value === id) activeId.value = openTabs.value.at(-1)?.id || ''
}

// ==================== 内存笔记操作（本地模式专用） ====================
/**
 * 异步新建本地笔记：先在内存中占位渲染，再写盘
 * @param {string} dirPath - 目录路径
 * @param {string} title - 标题
 * @param {string} content - 内容
 * @returns {Promise<Object|null>} - 成功返回笔记对象，失败返回 null
 */
const addLocalNoteDirectly = async (dirPath, title, content) => {
  // 1. 生成 ID 并创建内存笔记（立即渲染占位）
  const id = nanoid()
  const newNote = {
    id,
    title,
    content,
    folderId: null,
    isLocal: true, // 标记为本地笔记（不进在线侧边栏/搜索）
    isTemp: true, // 标记为临时笔记（正在写盘中）
    createTime: Date.now(),
    updateTime: Date.now()
  }

  // 2. 先加入内存列表（立刻渲染）
  noteList.value.unshift(newNote)
  openNote(id)

  // 3. 仅计算文件名（实际写盘由 createLocalNote 统筹，避免组件层重复 frontmatter 构建）
  try {
    const { filename } = buildLocalNoteFile(title, content)
    newNote.filename = filename
    return { id, filename, note: newNote }
  } catch (err) {
    // 文件名计算失败：从内存中移除
    console.error('本地笔记文件名生成失败:', err)
    noteList.value = noteList.value.filter(n => n.id !== id)
    if (activeId.value === id) activeId.value = openTabs.value[0]?.id || ''
    return null
  }
}

/**
 * 本地新建笔记的统一入口（store 内收口，组件只调用它）：
 * 内存占位（addLocalNoteDirectly）→ 写盘（matter + FileSystem Access）→ 失效目录缓存 → 落地（finalizeLocalNote）。
 * 原先散落在 Sidebar / FolderTree 的 fm + matter.stringify + writeFile + finalize 三段重复逻辑因此收敛为一处。
 * @returns {Promise<Object|null>} 成功返回 { id, filename, note }，失败返回 null
 */
const createLocalNote = async (dirPath, title, content = '') => {
  const result = await addLocalNoteDirectly(dirPath, title, content)
  if (!result) return null
  try {
    const { filename, fileContent } = buildLocalNoteFile(title, content)
    const local = useLocalModeStore()
    await local.writeFile(dirPath, filename, fileContent)
    local.invalidateCache(dirPath)
    finalizeLocalNote(result.id, { filename })
    return result
  } catch (err) {
    // 写盘失败：回滚内存占位
    console.error('本地笔记写盘失败:', err)
    noteList.value = noteList.value.filter(n => n.id !== result.id)
    if (activeId.value === result.id) activeId.value = openTabs.value[0]?.id || ''
    return null
  }
}

/**
 * 完成本地笔记写盘（由 createLocalNote 调用）
 */
const finalizeLocalNote = (id, persistedData) => {
  const idx = noteList.value.findIndex(n => n.id === id)
  if (idx > -1) {
    const note = noteList.value[idx]
    note.isTemp = false
    note.filename = persistedData.filename
    note.timeStamp = Date.now()
    noteList.value[idx] = note // 触发响应式更新
  }
}

// ==================== 单例导出 ====================
const instance = {
  noteList, openTabs, activeId, aiConfig, currentNote, getUnsortedNotes,
  loadNotes, loadAiConfig, saveAiConfig,
  addNote, delNote, updateNote, openNote, closeTab, moveNoteToFolder,
  addLocalNoteDirectly, createLocalNote, finalizeLocalNote
}

export function useNoteStore() { return instance }