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

// 版本3：回收站（软删除）
// - notes / folders 表新增 deletedAt 索引（0/undefined=未删除，>0=删除时间戳）
db.version(3).stores({
  notes: 'id, folderId, deletedAt',
  folders: 'id, parentId, order, deletedAt',
  aiConfig: 'id'
})

// 版本4：兼容性升版（消除 "Schema was extended" 警告）
// 早期开发版曾就地修改 version(3) 的 schema 而未升版，导致已存在的浏览器库被
// Dexie 自动补偿（native IndexedDB 版本被抬高），并持续打印
// "Schema was extended without increasing the number passed to db.version()"。
// 这里显式升到 version(4)（schema 与 v3 完全一致）作为全新的、未补偿的版本，
// 让 Dexie 执行一次干净的迁移并消除该警告。
// ⚠️ 切勿再就地修改任何旧版本号；以后扩展 schema 一律新增 version(5)、version(6)…
db.version(4).stores({
  notes: 'id, folderId, deletedAt',
  folders: 'id, parentId, order, deletedAt',
  aiConfig: 'id'
})

export const noteTable = db.notes
export const aiConfigTable = db.aiConfig
export const folderTable = db.folders
