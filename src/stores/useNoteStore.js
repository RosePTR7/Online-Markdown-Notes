import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { noteTable, folderTable, aiConfigTable, localConfigTable } from '../utils/db'
import { useLocalModeStore } from './useLocalModeStore'
import { useModalStore } from './useModalStore'
import { buildLocalNoteFile } from '../utils/localFile'
import { useSaveManager } from './useSaveManager'
import { importTextFile, importJSON } from '../utils/importExport'

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
  const migrated = []
  const toUpdate = []
  for (const n of list) {
    if (n.deletedAt) continue // 跳过回收站（软删除）中的笔记，避免重启后重新出现
    const m = { ...n, folderId: n.folderId ?? null }
    migrated.push(m)
    if (n.folderId === undefined) toUpdate.push(m)
  }
  noteList.value = migrated
  if (toUpdate.length) await noteTable.bulkPut(toUpdate)
}

const loadAiConfig = async () => {
  const record = await aiConfigTable.get('global')
  if (record) aiConfig.value = { baseUrl: record.baseUrl || '', apiKey: record.apiKey || '', model: record.model || '' }
}

const saveAiConfig = () => aiConfigTable.put({ id: 'global', ...aiConfig.value })

// ==================== 自动保存开关（持久化） ====================
// 默认开启；IndexedDB 已有记录时以记录为准。复用 localConfig 表（id='autoSave'），
// 不弹确认框，刷新后直接套用上次习惯（与本地模式文件夹句柄的持久化行为一致）。
const autoSaveEnabled = ref(true)

const loadAutoSave = async () => {
  try {
    const rec = await localConfigTable.get('autoSave')
    if (rec) autoSaveEnabled.value = rec.enabled !== false
  } catch (e) {
    console.error('读取自动保存设置失败:', e)
  }
}

const setAutoSave = async (val) => {
  autoSaveEnabled.value = val
  try {
    await localConfigTable.put({ id: 'autoSave', enabled: val })
  } catch (e) {
    console.error('保存自动保存设置失败:', e)
  }
}

// ==================== Actions（在线模式 - IndexedDB） ====================
const addNote = async (folderId = null, title, content) => {
  const newNote = {
    id: nanoid(),
    title: title || '新建无标题笔记',
    content: content || '# 在这里编写你的Markdown笔记',
    folderId,
    createTime: Date.now(),
    updateTime: Date.now()
  }
  await noteTable.add(newNote)
  noteList.value.push(newNote)
  openNote(newNote.id)
  return newNote
}

// 新建笔记统一门面：按当前模式分派到在线 addNote 或本地 createLocalNote。
// 组件层只调 createNote，不再各自写 if(isLocal) 分派；新建逻辑变更只需改这一处。
// folderId：在线为文件夹 id（null=未分类）；本地为目录相对路径（空串=根目录）。
const createNote = async (folderId = null, title = '', content = '') => {
  const local = useLocalModeStore()
  if (local.mode.value === 'local') {
    return await createLocalNote(folderId || '', title, content)
  }
  return await addNote(folderId, title, content)
}

// 导入笔记（保留原始 id / 时间戳，用于 JSON 备份恢复；不生成新 id 以免破坏文件夹外键引用）
const importNote = async (note) => {
  await noteTable.add(note)
  noteList.value.push(note)
  return note
}

// ==================== 文件导入（菜单选择 / 拖拽 统一入口） ====================
// 支持的导入格式：拖拽或文件选择器都按扩展名校验，不支持则弹一次提示（样式同重命名弹窗）
const SUPPORTED_IMPORT_EXT = ['md', 'markdown', 'txt', 'json']

// 从导入数据添加单条笔记（复用 addNote，不再手搓 Dexie 写库）
const addNoteFromData = async (data) => {
  await addNote(data.folderId || null, data.title || '导入的笔记', data.content || '')
}

// 处理 JSON 备份导入（含确认弹窗与文件夹重建）
const importJSONData = async (data) => {
  const confirmed = await useModalStore().confirm({
    title: '导入备份',
    message: `确定要导入 ${data.notes?.length || 0} 条笔记和 ${data.folders?.length || 0} 个文件夹吗？`,
    confirmText: '导入',
    confirmDanger: false
  })
  if (!confirmed) return
  if (data.folders && Array.isArray(data.folders)) {
    for (const folder of data.folders) {
      const existing = await folderTable.get(folder.id)
      if (!existing) await folderTable.add(folder)
    }
    window.location.reload()
  }
  if (data.notes && Array.isArray(data.notes)) {
    for (const note of data.notes) {
      const existing = await noteTable.get(note.id)
      if (!existing) await importNote(note)
    }
  }
}

// 导入单个文件（按扩展名分派）
const importSingleFile = async (file) => {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'json') {
    const data = await importJSON(file)
    await importJSONData(data)
  } else if (ext === 'txt') {
    const noteData = await importTextFile(file)
    await addNoteFromData(noteData)
  } else {
    // .md / .markdown -> 尝试解析 frontmatter
    const noteData = await importTextFile(file, { parseFrontmatter: true })
    await addNoteFromData(noteData)
  }
}

// 统一导入入口：菜单文件选择器与侧边栏拖拽都调用它。
// 区分支持 / 不支持格式：支持的逐个导入；不支持的收集后弹一次提示（样式同重命名弹窗），不中断已支持的导入。
const importFiles = async (fileList) => {
  const files = Array.from(fileList || [])
  if (files.length === 0) return
  const supported = []
  const unsupported = []
  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext && SUPPORTED_IMPORT_EXT.includes(ext)) supported.push(f)
    else unsupported.push(f.name)
  }
  for (const f of supported) {
    try {
      await importSingleFile(f)
    } catch (err) {
      console.error('导入失败:', err)
      useModalStore().showToast('导入失败: ' + err.message, 'error')
    }
  }
  if (unsupported.length > 0) {
    const list = unsupported.join('、')
    await useModalStore().confirm({
      title: '无法导入',
      message: `不支持该格式的文件（${list}），仅支持 .md、.markdown、.txt、.json 格式。`,
      confirmText: '我知道了'
    })
  } else {
    useModalStore().showToast('导入成功', 'success')
  }
}

const delNote = async (id) => {
  const note = noteList.value.find(n => n.id === id)
  if (!note) return
  if (note.isLocal) {
    // 本地笔记不在 Dexie：仅从内存/标签移除（磁盘删除由 removeLocalNote / deleteLocalFolder 负责）
    noteList.value = noteList.value.filter(i => i.id !== id)
    openTabs.value = openTabs.value.filter(t => t.id !== id)
    if (activeId.value === id) activeId.value = openTabs.value[0]?.id || ''
    return
  }
  // 在线笔记软删除：置 deletedAt 并移出 noteList（数据仍留 Dexie，可在回收站恢复/彻底删除）
  await noteTable.update(id, { deletedAt: Date.now() })
  noteList.value = noteList.value.filter(i => i.id !== id)
  openTabs.value = openTabs.value.filter(t => t.id !== id)
  if (activeId.value === id) activeId.value = openTabs.value[0]?.id || ''
}

// ==================== 回收站（在线笔记软删除的恢复 / 彻底删除） ====================
// 已软删除的笔记不再出现在 noteList，但保留于 Dexie（deletedAt>0），供回收站查询。
const getDeletedNotes = async () => {
  const list = await noteTable.where('deletedAt').above(0).toArray()
  return list.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
}

const restoreNote = async (id) => {
  await noteTable.update(id, { deletedAt: 0 })
  const note = await noteTable.get(id)
  if (note && !noteList.value.some(n => n.id === id)) {
    noteList.value.push(note) // 重新进入在线笔记列表（currentNote 等计算属性自动生效）
  }
}

const purgeNote = async (id) => {
  await noteTable.delete(id)
  openTabs.value = openTabs.value.filter(t => t.id !== id)
  if (activeId.value === id) activeId.value = openTabs.value[0]?.id || ''
}

const emptyRecycleBin = async () => {
  const deleted = await noteTable.where('deletedAt').above(0).toArray()
  const ids = deleted.map(n => n.id)
  if (ids.length) {
    await noteTable.where('deletedAt').above(0).delete()
    openTabs.value = openTabs.value.filter(t => !ids.includes(t.id))
  }
}

// 文件夹被软删除时，把该文件夹（含子文件夹）下的在线笔记从内存列表移除，并清理其打开的标签
const removeNotesFromListByFolder = (folderIds) => {
  const set = new Set(folderIds)
  const removedIds = noteList.value.filter(n => set.has(n.folderId)).map(n => n.id)
  if (!removedIds.length) return
  noteList.value = noteList.value.filter(n => !set.has(n.folderId))
  openTabs.value = openTabs.value.filter(t => !removedIds.includes(t.id))
  if (activeId.value && removedIds.includes(activeId.value)) {
    activeId.value = openTabs.value[0]?.id || ''
  }
}

// 本地笔记仅存于内存（不写 Dexie），删除磁盘文件后需同步清理内存与标签栏，避免已删笔记残留在标签栏
const removeLocalNote = (filename, dirPath) => {
  const note = noteList.value.find(n => n.filename === filename && (n.dirPath || '') === dirPath)
  if (!note) return
  noteList.value = noteList.value.filter(i => i.id !== note.id)
  openTabs.value = openTabs.value.filter(t => t.id !== note.id)
  if (activeId.value === note.id) activeId.value = openTabs.value[0]?.id || ''
}

const updateNote = (id, payload) => {
  const idx = noteList.value.findIndex(n => n.id === id)
  if (idx > -1) {
    // 原地修改属性（不替换数组元素），避免 currentNote 计算属性因引用变化而每键触发切换 watch
    const note = noteList.value[idx]
    Object.assign(note, payload, { updateTime: Date.now() })
    noteTable.put({ ...note })
  }
}

// 统一落盘入口（被保存调度器调用）：
//   本地笔记需重建 frontmatter 后写回 .md 文件（此前 updateNote 只写内存/Dexie，本地编辑内容从未落盘）；
//   在线笔记走原 updateNote。
// 这样无论是防抖计时器、切换后台保存、还是 flush，本地笔记的内容都能真正写到磁盘。
const persistNote = async (id, content) => {
  const idx = noteList.value.findIndex(n => n.id === id)
  if (idx === -1) return
  const note = noteList.value[idx]
  if (note.isLocal) {
    try {
      const local = useLocalModeStore()
      const { filename, fileContent } = buildLocalNoteFile(note.title, content)
      await local.writeFile(note.dirPath || '', filename, fileContent)
      local.invalidateCache(note.dirPath || '')
      // 原地同步内存笔记内容（不重复写 Dexie，本地笔记只存内存），避免替换元素触发 currentNote 重算
      note.content = content
      note.updateTime = Date.now()
    } catch (err) {
      console.error('本地笔记落盘失败:', err)
      useModalStore().showToast('保存失败: ' + err.message, 'error')
    }
  } else {
    updateNote(id, { content })
  }
}

// 仅更新内存中的笔记内容（不写 Dexie / 不写磁盘）：编辑器每次输入即时保持 note.content 为最新，
// 避免「切走再在 1.5s 防抖窗口内切回」时显示陈旧内容。真正的持久化仍交由 persistNote 防抖完成。
const updateNoteContent = (id, content) => {
  const idx = noteList.value.findIndex(n => n.id === id)
  // 原地修改属性（不替换元素），否则 currentNote 计算属性引用变化会每键触发「切换笔记」watch
  if (idx > -1) noteList.value[idx].content = content
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
  // 关闭标签前尽力把未落盘的改动写盘（1.5s 防抖内的编辑也保住），fire-and-forget
  useSaveManager().flushNote(id)
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
    dirPath: dirPath || '', // 记录磁盘相对目录，重命名/删除时用于定位已打开的标签页（此前缺失，导致嵌套笔记对应不上）
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
    finalizeLocalNote(result.id, { filename, dirPath: dirPath || '' })
    return result
  } catch (err) {
    // 写盘失败：回滚内存占位
    console.error('本地笔记写盘失败:', err)
    noteList.value = noteList.value.filter(n => n.id !== result.id)
    if (activeId.value === result.id) activeId.value = openTabs.value[0]?.id || ''
    useModalStore().showToast('新建笔记失败: ' + err.message, 'error')
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
    note.dirPath = persistedData.dirPath || ''
    note.timeStamp = Date.now()
    noteList.value[idx] = note // 触发响应式更新
  }
}

// ==================== 本地笔记「磁盘位置」同步（磁盘即事实来源下的唯一手动同步点） ====================
// 重命名本地笔记：仅更新已打开笔记的磁盘位置(filename/dirPath)与标题这一处；侧边栏由 FolderTree.refreshScan 从磁盘重读后自然反映新名字。
// 不再在多处手动同步变量——操作已落到本地磁盘，网页只是投影。
const updateLocalNoteLocation = (oldFilename, oldDirPath, newFilename, newDirPath) => {
  const note = noteList.value.find(n => n.filename === oldFilename && (n.dirPath || '') === oldDirPath)
  if (!note) return
  note.filename = newFilename
  note.dirPath = newDirPath || ''
  note.title = newFilename.replace(/\.md$/i, '')
  noteList.value = [...noteList.value] // 触发响应式：标签页标题/位置更新
}

// 重命名本地文件夹：批量把该目录下已打开笔记的 dirPath 前缀从旧路径改为新路径（一处更新，避免逐笔记同步）。
const updateLocalNotesDirPath = (oldDirPath, newDirPath) => {
  let changed = false
  const next = noteList.value.map(n => {
    if (!n.isLocal || !n.dirPath) return n
    if (n.dirPath === oldDirPath) { changed = true; return { ...n, dirPath: newDirPath } }
    if (n.dirPath.startsWith(oldDirPath + '/')) { changed = true; return { ...n, dirPath: newDirPath + n.dirPath.slice(oldDirPath.length) } }
    return n
  })
  if (changed) noteList.value = next
}

// ==================== 单例导出 ====================
const instance = {
  noteList, openTabs, activeId, aiConfig, currentNote, getUnsortedNotes,
  loadNotes, loadAiConfig, saveAiConfig,
  autoSaveEnabled, loadAutoSave, setAutoSave,
  addNote, delNote, updateNote, openNote, closeTab, moveNoteToFolder, removeLocalNote,
  persistNote, updateNoteContent,
  addLocalNoteDirectly, createLocalNote, finalizeLocalNote,
  updateLocalNoteLocation, updateLocalNotesDirPath,
  createNote, importNote, importFiles, SUPPORTED_IMPORT_EXT,
  getDeletedNotes, restoreNote, purgeNote, emptyRecycleBin,
  removeNotesFromListByFolder
}

export function useNoteStore() { return instance }