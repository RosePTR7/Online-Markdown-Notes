import matter from 'gray-matter'
import { marked } from 'marked'
import { noteTable, folderTable } from './db'

// ==================== 导出功能 ====================

// 导出单条笔记为 Markdown
export function exportNoteAsMarkdown(note) {
  const lines = []
  lines.push(`# ${note.title}`)
  lines.push('')
  lines.push(note.content)
  return lines.join('\n')
}

// 导出单条笔记为带 Frontmatter 的 Markdown
export function exportNoteAsFrontmatterMarkdown(note) {
  const frontmatter = {
    title: note.title,
    created: note.createTime ? new Date(note.createTime).toISOString() : '',
    updated: note.updateTime ? new Date(note.updateTime).toISOString() : '',
    folderId: note.folderId || ''
  }
  return matter.stringify(note.content, frontmatter)
}

// 导出单条笔记为 HTML
export function exportNoteAsHTML(note) {
  const htmlContent = marked.parse(note.content)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(note.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }
  </style>
</head>
<body>
  <h1>${escapeHtml(note.title)}</h1>
  ${htmlContent}
</body>
</html>`
}

// 导出全部数据为 JSON
export async function exportAllAsJSON() {
  const notes = await noteTable.toArray()
  const folders = await folderTable.toArray()
  return JSON.stringify({ notes, folders, exportTime: Date.now() }, null, 2)
}

// 触发文件下载
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ==================== 导入功能 ====================

// 导入 Markdown 文件（纯 Markdown）
export async function importMarkdown(file, folderId = null) {
  const content = await readFile(file)
  const title = file.name.replace(/\.md$/i, '')
  return { title, content, folderId }
}

// 导入带 Frontmatter 的 Markdown 文件
export async function importFrontmatterMarkdown(file, folderId = null) {
  const raw = await readFile(file)
  const { data, content } = matter(raw)
  return {
    title: data.title || file.name.replace(/\.md$/i, ''),
    content,
    folderId: data.folderId || folderId,
    createTime: data.created ? new Date(data.created).getTime() : Date.now(),
    updateTime: data.updated ? new Date(data.updated).getTime() : Date.now()
  }
}

// 导入 TXT 文件
export async function importTxt(file, folderId = null) {
  const content = await readFile(file)
  const title = file.name.replace(/\.txt$/i, '')
  return { title, content, folderId }
}

// 导入 JSON 备份文件
export async function importJSON(file) {
  const raw = await readFile(file)
  const data = JSON.parse(raw)
  if (!data.notes || !Array.isArray(data.notes)) {
    throw new Error('无效的备份文件格式')
  }
  return data
}

// 读取文件为文本
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// HTML 转义
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}