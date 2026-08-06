import matter from 'gray-matter'
import { marked } from 'marked'
import { noteTable, folderTable } from './db'
import { buildZip } from './zip'

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

// 触发 Blob 下载（用于 ZIP 等二进制内容）
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ==================== 整库导出（ZIP，保留目录结构） ====================
// 仅导出「在线 + 未软删除」的笔记/文件夹（与回收站、本地模式范围一致）。
// ZIP 内：每个笔记按其所属文件夹层级导出为 <标题>.md（带 Frontmatter）；
// 另含 backup.json 用于完整精确恢复（含时间戳、folderId 等）。
export async function exportAllAsZip() {
  const notes = await noteTable.toArray()
  const folders = await folderTable.toArray()
  const liveNotes = notes.filter(n => !n.deletedAt && !n.isLocal)
  const liveFolders = folders.filter(f => !f.deletedAt)

  // folderId -> 目录路径（按 parentId 链向上回溯）
  const folderPathOf = (folderId) => {
    const parts = []
    const seen = new Set()
    let cur = liveFolders.find(f => f.id === folderId)
    while (cur && !seen.has(cur.id)) {
      parts.unshift(cur.name)
      seen.add(cur.id)
      cur = cur.parentId ? liveFolders.find(f => f.id === cur.parentId) : null
    }
    return parts
  }

  const usedNames = new Set()
  const uniqueName = (base, ext) => {
    let name = `${base}.${ext}`
    if (!usedNames.has(name)) { usedNames.add(name); return name }
    let i = 1
    let candidate
    do { candidate = `${base} (${i}).${ext}`; i++ } while (usedNames.has(candidate))
    usedNames.add(candidate)
    return candidate
  }

  const safeName = (s) => (s || '无标题笔记').replace(/[\/\\:*?"<>|]/g, '_')

  const files = []
  for (const note of liveNotes) {
    const content = exportNoteAsFrontmatterMarkdown(note)
    let dir = ''
    if (note.folderId) {
      const p = folderPathOf(note.folderId)
      if (p.length) dir = p.join('/') + '/'
    }
    files.push({ name: uniqueName(dir + safeName(note.title), 'md'), content })
  }

  // 完整备份（JSON），便于精确恢复
  files.push({
    name: 'backup.json',
    content: JSON.stringify({ notes: liveNotes, folders: liveFolders, exportTime: Date.now() }, null, 2)
  })

  return buildZip(files)
}

// ==================== 导入功能 ====================

// 导入文本文件（Markdown / TXT），可选解析 Frontmatter
export async function importTextFile(file, { parseFrontmatter = false, folderId = null } = {}) {
  const raw = await readFile(file)
  const baseTitle = file.name.replace(/\.(md|markdown|txt)$/i, '')
  if (parseFrontmatter) {
    const { data, content } = matter(raw)
    return {
      title: data.title || baseTitle,
      content,
      folderId: data.folderId || folderId,
      createTime: data.created ? new Date(data.created).getTime() : Date.now(),
      updateTime: data.updated ? new Date(data.updated).getTime() : Date.now()
    }
  }
  return { title: baseTitle, content: raw, folderId }
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