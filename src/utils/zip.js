// 极简 ZIP 写入器（STORE 法，无压缩），无第三方依赖。
// 支持 UTF-8 文件名（general purpose bit flag 0x0800），满足整库导出需求。
// files: Array<{ name: string, content: string }>，name 可用 "/" 表示目录层级。
// 返回 Blob（application/zip）。

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF]
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

export function buildZip(files) {
  const encoder = new TextEncoder()
  const chunks = []   // 本地文件头 + 数据
  const central = []  // 中央目录记录
  let offset = 0      // 本地文件头运行偏移

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const dataBytes = encoder.encode(file.content)
    const crc = crc32(dataBytes)
    const size = dataBytes.length

    // 本地文件头（30 字节 + 文件名）
    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)   // 签名
    lv.setUint16(4, 20, true)            // version needed
    lv.setUint16(6, 0x0800, true)        // 通用标志：UTF-8 文件名
    lv.setUint16(8, 0, true)             // 压缩方法：store
    lv.setUint16(10, 0, true)            // 修改时间
    lv.setUint16(12, 0, true)            // 修改日期
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)         // 压缩后大小
    lv.setUint32(22, size, true)         // 未压缩大小
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)            // 扩展字段长度
    local.set(nameBytes, 30)
    chunks.push(local, dataBytes)

    // 中央目录记录（46 字节 + 文件名）
    const cen = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, 0x02014b50, true)    // 签名
    cv.setUint16(4, 20, true)            // version made by
    cv.setUint16(6, 20, true)            // version needed
    cv.setUint16(8, 0x0800, true)        // 通用标志：UTF-8
    cv.setUint16(10, 0, true)            // 压缩方法
    cv.setUint16(12, 0, true)            // 修改时间
    cv.setUint16(14, 0, true)            // 修改日期
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)            // 扩展字段长度
    cv.setUint16(32, 0, true)            // 注释长度
    cv.setUint16(34, 0, true)            // 起始磁盘号
    cv.setUint16(36, 0, true)            // 内部文件属性
    cv.setUint32(38, 0, true)            // 外部文件属性
    cv.setUint32(42, offset, true)       // 本地文件头偏移
    cen.set(nameBytes, 46)
    central.push(cen)

    offset += local.length + dataBytes.length
  }

  // 中央目录结束记录（22 字节）
  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)      // 签名
  ev.setUint16(4, 0, true)               // 当前磁盘号
  ev.setUint16(6, 0, true)               // 中央目录起始磁盘号
  ev.setUint16(8, files.length, true)    // 本磁盘条目数
  ev.setUint16(10, files.length, true)   // 总条目数
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)         // 中央目录偏移
  ev.setUint16(20, 0, true)              // 注释长度

  const total = offset + centralSize + eocd.length
  const out = new Uint8Array(total)
  let pos = 0
  for (const c of [...chunks, ...central, eocd]) {
    out.set(c, pos)
    pos += c.length
  }
  return new Blob([out], { type: 'application/zip' })
}
