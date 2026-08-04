import matter from 'gray-matter'

// 生成本地笔记的磁盘文件名与完整文件内容（frontmatter + 正文）。
// 集中此前散落在 Sidebar / FolderTree / useLocalModeStore 三处的 frontmatter 构建逻辑，
// 确保「内存笔记占位文件名」与「实际落盘文件名 / 内容」完全一致。
export const buildLocalNoteFile = (title, content = '') => {
  const safe = (title || 'untitled').trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_') || 'untitled'
  const filename = `${safe}.md`
  const fm = {
    title: (title || '').trim(),
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  }
  return { filename, fileContent: matter.stringify(content, fm) }
}
