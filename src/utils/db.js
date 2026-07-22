import Dexie from 'dexie'

export const db = new Dexie('NoteDB')

// 表：notes 笔记；aiConfig AI配置
db.version(1).stores({
  notes: 'id',
  aiConfig: 'id'
})

export const noteTable = db.notes
export const aiConfigTable = db.aiConfig