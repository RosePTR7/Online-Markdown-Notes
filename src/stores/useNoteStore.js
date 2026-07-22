import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { noteTable, aiConfigTable } from '../utils/db'

export function useNoteStore() {
  const noteList = ref([])
  const openTabs = ref([])
  const activeId = ref('')
  const aiConfig = ref({
    baseUrl: '',
    apiKey: ''
  })

  // 从数据库加载全部笔记
  const loadNotes = async () => {
    const list = await noteTable.toArray()
    noteList.value = list
  }

  // 加载AI配置（固定id=global）
  const loadAiConfig = async () => {
    const record = await aiConfigTable.get('global')
    if (record) {
      aiConfig.value = {
        baseUrl: record.baseUrl,
        apiKey: record.apiKey
      }
    }
  }

  // 保存AI配置
  const saveAiConfig = async () => {
    await aiConfigTable.put({
      id: 'global',
      baseUrl: aiConfig.value.baseUrl,
      apiKey: aiConfig.value.apiKey
    })
  }

  // 新增笔记
  const addNote = async () => {
    const newNote = {
      id: nanoid(),
      title: '新建无标题笔记',
      content: '# 在这里编写你的Markdown笔记',
      createTime: Date.now(),
      updateTime: Date.now()
    }
    await noteTable.add(newNote)
    noteList.value.push(newNote)
    openNote(newNote.id)
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

  // 当前选中笔记
  const currentNote = computed(() => noteList.value.find(n => n.id === activeId.value) || null)

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
    saveAiConfig
  }
}