import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { noteTable, aiConfigTable } from '../utils/db'

// 模块级别的单例状态
const noteList = ref([])
const openTabs = ref([])
const activeId = ref('')
const aiConfig = ref({
  baseUrl: '',
  apiKey: '',
  model: ''
})

// 当前选中笔记（模块级别 computed）
const currentNote = computed(() => noteList.value.find(n => n.id === activeId.value) || null)

export function useNoteStore() {

  // 从数据库加载全部笔记
  const loadNotes = async () => {
    const list = await noteTable.toArray()
    // 数据迁移：为旧笔记添加 folderId 字段
    const migratedList = list.map(note => ({
      ...note,
      folderId: note.folderId ?? null
    }))
    noteList.value = migratedList
    
    // 如果有迁移的数据，更新数据库
    for (let i = 0; i < list.length; i++) {
      if (list[i].folderId === undefined) {
        await noteTable.put(migratedList[i])
      }
    }
  }

  // 加载AI配置（固定id=global）
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

  // 保存AI配置
  const saveAiConfig = async () => {
    await aiConfigTable.put({
      id: 'global',
      baseUrl: aiConfig.value.baseUrl,
      apiKey: aiConfig.value.apiKey,
      model: aiConfig.value.model
    })
  }

  // 新增笔记
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

  // 删除笔记
  const delNote = async (id) => {
    await noteTable.delete(id)
    noteList.value = noteList.value.filter(item => item.id !== id)
    openTabs.value = openTabs.value.filter(t => t.id !== id)
    if (activeId.value === id) activeId.value = openTabs.value[0]?.id || ''
  }

  // 更新笔记
  const updateNote = async (id, payload) => {
    const idx = noteList.value.findIndex(n => n.id === id)
    if (idx > -1) {
      const updated = {
        ...noteList.value[idx],
        ...payload,
        updateTime: Date.now()
      }
      await noteTable.put(updated)
      noteList.value[idx] = updated
    }
  }

  // 移动笔记到文件夹（不更新 updateTime，因为移动不算修改笔记内容）
  const moveNoteToFolder = async (noteId, folderId) => {
    const idx = noteList.value.findIndex(n => n.id === noteId)
    if (idx > -1) {
      const updated = {
        ...noteList.value[idx],
        folderId
      }
      await noteTable.put(updated)
      noteList.value[idx] = updated
    }
  }

  // 获取文件夹内的笔记
  const getNotesByFolder = (folderId) => {
    return noteList.value.filter(n => n.folderId === folderId)
  }

  // 获取未分类的笔记
  const getUnsortedNotes = computed(() => {
    return noteList.value.filter(n => n.folderId === null)
  })

  // 打开笔记，加入标签页
  const openNote = (id) => {
    const target = noteList.value.find(n => n.id === id)
    if (!target) return
    activeId.value = id
    const hasTab = openTabs.value.some(t => t.id === id)
    if (!hasTab) openTabs.value.push({ id, title: target.title })
  }

  // 关闭标签页
  const closeTab = (id) => {
    openTabs.value = openTabs.value.filter(t => t.id !== id)
    if (activeId.value === id) {
      const lastTab = openTabs.value.at(-1)
      activeId.value = lastTab?.id || ''
    }
  }

  return {
    noteList,
    openTabs,
    activeId,
    aiConfig,
    currentNote,
    loadNotes,
    loadAiConfig,
    addNote,
    delNote,
    updateNote,
    openNote,
    closeTab,
    saveAiConfig,
    moveNoteToFolder,
    getNotesByFolder,
    getUnsortedNotes
  }
}
