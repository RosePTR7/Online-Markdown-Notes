import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { noteTable, aiConfigTable } from '../utils/db'

// ==================== 运行时状态（模块级单例） ====================
const noteList = ref([])
const openTabs = ref([])
const activeId = ref('')

// ==================== 持久配置（localStorage） ====================
const aiConfig = ref({
  baseUrl: '',
  apiKey: '',
  model: ''
})

// 当前选中笔记
const currentNote = computed(() => noteList.value.find(n => n.id === activeId.value) || null)

// ==================== 从 IndexedDB 加载 ====================
const loadNotes = async () => {
  const list = await noteTable.toArray()
  // 数据迁移：为旧笔记添加 folderId 字段
  const migratedList = list.map(note => ({ ...note, folderId: note.folderId ?? null }))
  noteList.value = migratedList
  
  for (let i = 0; i < list.length; i++) {
    if (list[i].folderId === undefined) {
      await noteTable.put(migratedList[i])
    }
  }
}

const loadAiConfig = async () => {
  const record = await aiConfigTable.get('global')
  if (record) {
    aiConfig.value = {
      baseUrl: record.baseUrl || '',
      apiKey: record.apiKey || '',
      model: record.model || ''
    }
  }
}

const saveAiConfig = async () => {
  await aiConfigTable.put({
    id: 'global',
    baseUrl: aiConfig.value.baseUrl,
    apiKey: aiConfig.value.apiKey,
    model: aiConfig.value.model
  })
}

// ==================== Actions ====================
const addNote = async (folderId = null) => {
  const newNote = {
    id: nanoid(),
    title: '新建无标题笔记',
    content: '# 在这里编写你的Markdown笔记',
    folderId,
    createTime: Date.now(),
    updateTime: Date.now()
  }
  await noteTable.add(newNote)
  noteList.value.push(newNote)
  openNote(newNote.id)
  return newNote
}

const delNote = async (id) => {
  await noteTable.delete(id)
  noteList.value = noteList.value.filter(item => item.id !== id)
  openTabs.value = openTabs.value.filter(t => t.id !== id)
  if (activeId.value === id) activeId.value = openTabs.value[0]?.id || ''
}

const updateNote = async (id, payload) => {
  const idx = noteList.value.findIndex(n => n.id === id)
  if (idx > -1) {
    const updated = { ...noteList.value[idx], ...payload, updateTime: Date.now() }
    await noteTable.put(updated)
    noteList.value[idx] = updated
  }
}

const moveNoteToFolder = async (noteId, folderId) => {
  const idx = noteList.value.findIndex(n => n.id === noteId)
  if (idx > -1) {
    const updated = { ...noteList.value[idx], folderId }
    await noteTable.put(updated)
    noteList.value[idx] = updated
  }
}

const openNote = (id) => {
  const target = noteList.value.find(n => n.id === id)
  if (!target) return
  activeId.value = id
  if (!openTabs.value.some(t => t.id === id)) {
    openTabs.value.push({ id, title: target.title })
  }
}

const closeTab = (id) => {
  openTabs.value = openTabs.value.filter(t => t.id !== id)
  if (activeId.value === id) {
    activeId.value = openTabs.value.at(-1)?.id || ''
  }
}

// ==================== Getters ====================
const getNotesByFolder = (folderId) => noteList.value.filter(n => n.folderId === folderId)

const getUnsortedNotes = computed(() => noteList.value.filter(n => n.folderId === null))

// ==================== 单例导出 ====================
const instance = {
  // 状态
  noteList,
  openTabs,
  activeId,
  aiConfig,
  currentNote,
  // Getters
  getNotesByFolder,
  getUnsortedNotes,
  // Actions
  loadNotes,
  loadAiConfig,
  saveAiConfig,
  addNote,
  delNote,
  updateNote,
  openNote,
  closeTab,
  moveNoteToFolder
}

export function useNoteStore() {
  return instance
}