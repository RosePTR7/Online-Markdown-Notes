import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import matter from 'gray-matter'
import { noteTable, aiConfigTable } from '../utils/db'

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
  // 1. 生成 ID 并创建内存笔记
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
  
  // 3. 异步写盘
  try {
    // 生成文件名（基于标题，替换非法字符），避免冲突时追加时间戳
    const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || 'untitled'
    const filename = `${safeTitle}.md`
    const fm = { title, created: new Date().toISOString(), updated: new Date().toISOString() }
    const fileContent = matter.stringify(content, fm)
    
    // 需要从外部写入文件（因为这里无法访问 FileSystem Access API）
    // 返回文件名和 ID 供调用者处理
    newNote.filename = filename
    newNote._tempFilename = filename // 临时标记
    
    return { id, filename, note: newNote }
  } catch (err) {
    // 4. 写盘失败：从内存中移除
    console.error('本地笔记写盘失败:', err)
    noteList.value = noteList.value.filter(n => n.id !== id)
    if (activeId.value === id) activeId.value = openTabs.value[0]?.id || ''
    return null
  }
}

/**
 * 完成本地笔记写盘（由 Sidebar 调用）
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
  addLocalNoteDirectly, finalizeLocalNote
}

export function useNoteStore() { return instance }