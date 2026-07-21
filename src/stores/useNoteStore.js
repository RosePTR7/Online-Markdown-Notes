import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { noteStorage, aiConfigStorage } from '../utils/storages'

export function useNoteStore() {
  const noteList = ref(noteStorage.getAll())
  const openTabs = ref([])
  const activeId = ref('')
  const aiConfig = ref(aiConfigStorage.get())
  
  const saveNotes = () => noteStorage.save(noteList.value)
  const saveAiConfig = () => aiConfigStorage.save(aiConfig.value)
  
  // 新增笔记
  const addNote = () => {
    const newNote = {
      id: nanoid(),
      title: '新建无标题笔记',
      content: '# 在这里编写你的Markdown笔记',
      createTime: Date.now(),
      updateTime: Date.now()
    }
    noteList.value.push(newNote)
    saveNotes()
    openNote(newNote.id)
  }

  // 删除笔记
  const delNote = (id) => {
  noteList.value = noteList.value.filter(item => item.id !== id)
  saveNotes()
  openTabs.value = openTabs.value.filter(t => t.id !== id)
  if (activeId.value === id) activeId.value = openTabs.value[0]?.id || ''
  }

  // 更新笔记
  const updateNote = (id, payload) => {
    const idx = noteList.value.findIndex(n => n.id === id)
    if (idx > -1) {
      noteList.value[idx] = { ...noteList.value[idx], ...payload, updateTime: Date.now() }
      saveNotes()
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
  if (activeId.value === id) activeId.value = openTabs.value[openTabs.value.length - 1]?.id || ''
  }

  // 当前选中笔记
  const currentNote = computed(() => noteList.value.find(n => n.id === activeId.value) || null)

  return {
    noteList, openTabs, activeId, aiConfig, currentNote,
    addNote, delNote, updateNote, openNote, closeTab, saveAiConfig
  }
}