// 本地模式笔记：从文件名（含 .md）解析标题与激活态的共享 helper
// FolderTree 与 FolderItem 共用，消除重复的 stripMd + localNotesMap 查找逻辑
//
// map 参数约定：传入 localNotesMap 的 .value（即 { 去后缀文件名: note } 对象），可能为空

export const stripMd = (name) => name.replace(/\.md$/i, '')

// 解析本地文件的显示标题：命中内存笔记则取标题，否则回退为去后缀文件名
export const resolveLocalTitle = (map, filename) => {
  const note = map?.[stripMd(filename)]
  return note ? note.title : stripMd(filename)
}

// 判断本地文件是否对应当前激活笔记
export const isLocalActive = (map, filename, activeId) => {
  const note = map?.[stripMd(filename)]
  return note ? activeId === note.id : false
}
