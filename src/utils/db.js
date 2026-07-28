import Dexie from 'dexie'

export const db = new Dexie('NoteDB')

// 版本1：初始版本
db.version(1).stores({
  notes: 'id',
  aiConfig: 'id'
})

// 版本2：新增文件夹功能
// - notes 表新增 folderId 索引
// - 新增 folders 表
db.version(2).stores({
  notes: 'id, folderId',
  folders: 'id, parentId, order',
  aiConfig: 'id'
})

export const noteTable = db.notes
export const aiConfigTable = db.aiConfig
export const folderTable = db.folders
