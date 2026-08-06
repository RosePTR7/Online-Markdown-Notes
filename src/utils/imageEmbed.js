// 将图片文件转为可内嵌 Markdown 的 data URL（带智能缩放，避免超大图撑爆笔记）。
// 在线模式：data URL 随笔记内容存 IndexedDB；本地模式：随 .md 文件落盘，重载后均可直接渲染。

const MAX_EDGE = 1600 // 最长边超过该像素值则缩放

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片解析失败'))
    }
    img.src = url
  })
}

// 单个文件 -> `![名称](dataURL)`
export async function fileToMarkdown(file) {
  const name = (file.name || 'image').replace(/\.[^.]+$/, '')
  const isRaster = /^image\/(png|jpe?g|webp|bmp)$/i.test(file.type)

  let dataUrl
  if (isRaster) {
    try {
      const { img, url } = await loadImage(file)
      const { width, height } = img
      if (width > MAX_EDGE || height > MAX_EDGE) {
        const scale = MAX_EDGE / Math.max(width, height)
        const w = Math.round(width * scale)
        const h = Math.round(height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        // PNG / WebP 可能含透明通道，缩放后仍以 PNG 输出保留透明；其余填充白底转 JPEG 更省体积
        if (file.type === 'image/png' || file.type === 'image/webp') {
          ctx.drawImage(img, 0, 0, w, h)
          dataUrl = canvas.toDataURL('image/png')
        } else {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, w, h)
          ctx.drawImage(img, 0, 0, w, h)
          dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        }
      } else {
        dataUrl = await readAsDataURL(file)
      }
      URL.revokeObjectURL(url)
    } catch (e) {
      // 解析失败则退回原始文件的 base64，保证仍可插入
      dataUrl = await readAsDataURL(file)
    }
  } else {
    // SVG / GIF 等：base64 原样保留（避免丢失矢量或动画特性）
    dataUrl = await readAsDataURL(file)
  }

  return `![${name}](${dataUrl})`
}
