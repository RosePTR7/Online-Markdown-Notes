// ==================== 每笔记独立的后台预保存调度 ====================
// 设计目标（来自用户的修复方案）：
//   1. 标签栏里每篇「已打开的笔记」各自维护独立的待保存内容与计时器；
//   2. 切换笔记时，旧笔记的预保存与计时器「不被取消」，继续在后台计时并落盘；
//   3. 把「保存 + 防抖计时」从 App.vue 抽出来，成为可被任意笔记独立调用的单元。
//
// 并发安全性说明：
//   - JS 单线程：多个笔记各自挂的 setTimeout 到点后由事件循环「逐个串行」执行，
//     回调永远不会真正并行，不存在两个回调同时改同一块内存的竞争。
//   - 真正的隐患是「全局共享一个 pendingSave / 一个 saveTimer」——本模块改用
//     Map<noteId, entry> 按笔记隔离状态，切走 A 只动 map.get(A)，B/C 互不影响。
//   - 每个笔记通过 (dirPath, filename) 解析出「独立文件句柄」再写盘，不同文件并发写安全。
//   - 唯一真实危险是「同一文件被两次同时在途写」：用 saving 单飞标志 + flush 前
//     clearTimeout 保证同一笔记同一时刻只有一个写在途。

const DEBOUNCE_DELAY = 1500

// noteId -> { content, timer, saving }
const pending = new Map()

// 由调用方注入：persist(noteId, content) 真正落盘；afterSave(noteId, content) 落盘后回调
let persistFn = null
let afterSaveFn = null

export function initSaveManager({ persist, afterSave } = {}) {
  persistFn = persist
  afterSaveFn = afterSave
}

async function runSave(noteId) {
  const entry = pending.get(noteId)
  if (!entry) return
  if (entry.saving) return // 单飞：同一笔记不重叠写（flush 与计时器撞车时返回，在途那次已含最新 content）
  entry.saving = true
  entry.timer = null
  const content = entry.content
  try {
    if (persistFn) await persistFn(noteId, content)
    if (afterSaveFn) afterSaveFn(noteId, content)
  } catch (e) {
    console.error('保存失败:', noteId, e)
  } finally {
    entry.saving = false
    // 若期间没有新的待保存（timer 仍为空），清理条目；否则保留，让新 timer 继续
    const e2 = pending.get(noteId)
    if (e2 && !e2.timer) pending.delete(noteId)
  }
}

// 编辑发生时调用：更新该笔记的最新待保存内容并重置其独立防抖计时器
export function scheduleSave(noteId, content) {
  if (!noteId) return
  let entry = pending.get(noteId)
  if (!entry) {
    entry = { content, timer: null, saving: false }
    pending.set(noteId, entry)
  }
  entry.content = content
  if (entry.timer) clearTimeout(entry.timer)
  entry.timer = setTimeout(() => runSave(noteId), DEBOUNCE_DELAY)
}

// 仅标记脏、不挂计时器。关闭自动保存时使用：内容进 pending 但需手动保存，
// 卸载/关标签时的 flushAll / flushNote 仍能把它落盘（防数据丢失）。
export function markDirty(noteId, content) {
  if (!noteId) return
  let entry = pending.get(noteId)
  if (!entry) {
    entry = { content, timer: null, saving: false }
    pending.set(noteId, entry)
  }
  entry.content = content
  if (entry.timer) {
    clearTimeout(entry.timer)
    entry.timer = null
  }
}

// 立即落盘某笔记（切走/关标签时可调用；不取消其它笔记的后台保存）
export async function flushNote(noteId) {
  const entry = pending.get(noteId)
  if (!entry) return
  if (entry.timer) {
    clearTimeout(entry.timer)
    entry.timer = null
  }
  await runSave(noteId)
}

// 落盘全部脏笔记（beforeunload / 卸载时尽力而为）
export async function flushAll() {
  const ids = Array.from(pending.keys())
  await Promise.all(ids.map(flushNote))
}

// 撤销某笔记的待保存（内容被改回原值、或标签关闭且无需保存时清理计时器）
export function removePending(noteId) {
  const entry = pending.get(noteId)
  if (entry && entry.timer) clearTimeout(entry.timer)
  pending.delete(noteId)
}

export function useSaveManager() {
  return { initSaveManager, scheduleSave, flushNote, flushAll, removePending, markDirty }
}
