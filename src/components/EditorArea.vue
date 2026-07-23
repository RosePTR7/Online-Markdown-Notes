<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-white relative">
    <div v-if="currentNote" class="p-2 border-b flex items-center shrink-0 gap-4">
      <div class="flex-1 flex gap-1 overflow-x-auto">
        <div
          v-for="tab in openTabs"
          :key="tab.id"
          class="px-3 py-1 rounded-t cursor-pointer flex items-center gap-1 shrink-0 max-w-[140px]"
          :class="activeId === tab.id
            ? 'bg-slate-100 text-indigo-600 border-b-2 border-indigo-500'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          @click="openNote(tab.id)"
          @contextmenu.prevent="openTabContextMenu(tab.id, $event)"
        >
          <!-- 增加?. 防止时序报错 核心修改 -->
          <span class="truncate">{{ noteList?.find(n => n.id === tab.id)?.title || '' }}</span>
          <span @click.stop="closeTab(tab.id)" class="hover:text-red-500 shrink-0">×</span>
        </div>
      </div>
      <button class="bg-indigo-500 hover:bg-indigo-600 text-white rounded px-3 py-1 shrink-0" @click="handlePolish">AI一键润色</button>
    </div>

    <!-- 标签右键菜单 独立遮罩关闭 -->
    <div
      v-if="tabMenuVisible"
      class="fixed inset-0 z-40"
      @click="tabMenuVisible = false"
    >
      <div
        class="fixed bg-white shadow-lg border rounded py-1 z-50 w-32"
        :style="{ left: tabMenuX + 'px', top: tabMenuY + 'px' }"
        @click.stop
      >
        <div class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm" @click="tabRename">重命名</div>
        <div class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm" @click="closeOtherTabs">删除其他</div>
        <div class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm text-red-500" @click="closeAllTabs">删除所有</div>
      </div>
    </div>

    <!-- 保存状态状态栏 -->
    <div v-if="currentNote" class="px-3 py-1 text-xs border-b border-gray-100">
      <span :class="isUnsaved ? 'text-red-500' : 'text-green-600'">
        {{ isUnsaved ? '有未保存修改' : '已保存' }}
      </span>
    </div>

    <!-- 查找/替换悬浮窗口 - fixed 定位在右上角 -->
    <div
      v-if="findPanelVisible"
      class="fixed top-20 right-8 z-50 bg-white border border-slate-300 rounded-lg shadow-lg px-4 py-3 min-w-[400px]"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-slate-700">{{ showReplace ? '替换' : '查找' }}</span>
        <button class="px-2 py-0.5 text-slate-400 hover:text-slate-600 text-lg leading-none" @click="closeFindPanel" title="关闭">✕</button>
      </div>
      <div class="flex items-center gap-2 mb-2">
        <input
          v-model="findKeyword"
          type="text"
          placeholder="查找内容..."
          class="flex-1 px-2 py-1 border border-slate-300 rounded text-sm outline-none focus:border-indigo-400"
          @keyup.enter="doFind"
          ref="findInputRef"
        />
        <span v-if="findCount !== null" class="text-xs text-slate-500 whitespace-nowrap">{{ findCount }} 处</span>
        <button class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm shrink-0" @click="doFind">查找</button>
      </div>
      <div v-if="showReplace" class="flex items-center gap-2">
        <input
          v-model="replaceKeyword"
          type="text"
          placeholder="替换为..."
          class="flex-1 px-2 py-1 border border-slate-300 rounded text-sm outline-none focus:border-indigo-400"
          @keyup.enter="doReplaceAll"
        />
        <button class="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-sm shrink-0" @click="doReplaceAll">替换全部</button>
      </div>
    </div>

    <MdEditor
      ref="mdEditor"
      v-if="currentNote"
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      class="flex-1 overflow-hidden"
    />
    <div v-else class="flex items-center justify-center flex-1 text-gray-400">请新建/选择一条笔记</div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useNoteStore } from '../stores/useNoteStore'
import MdEditor from './MdEditor.vue'
import { polishMarkdown } from '../utils/aiApi'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  isUnsaved: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:modelValue'])

const mdEditor = ref(null)

const getVditor = () => mdEditor.value?.getVditor?.()

const handleUndo = () => getVditor()?.undo?.()
const handleRedo = () => getVditor()?.redo?.()

const handleFind = (keyword) => {
  if (!keyword) return 0
  const content = getVditor()?.getValue?.() || ''
  const lower = content.toLowerCase()
  const kw = keyword.toLowerCase()
  let count = 0
  let idx = lower.indexOf(kw)
  while (idx !== -1) { count++; idx = lower.indexOf(kw, idx + 1) }
  return count
}

const handleReplace = (keyword, replacement) => {
  if (!keyword) return
  const vditor = getVditor()
  if (!vditor) return
  const content = vditor.getValue()
  const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
  const newContent = content.replace(regex, replacement)
  if (newContent !== content) {
    vditor.setValue(newContent)
  }
}

// 设置编辑器内容（供撤销/恢复使用）
const setContent = (content) => {
  const vditor = getVditor()
  if (vditor) {
    vditor.setValue(content)
  }
}

// ==========查找/替换悬浮窗口==========
const findPanelVisible = ref(false)
const showReplace = ref(false)
const findKeyword = ref('')
const replaceKeyword = ref('')
const findCount = ref(null)
const findInputRef = ref(null)

const openFindReplacePanel = (mode) => {
  // 切换功能时，先关闭之前的悬浮窗并清除高亮
  if (findPanelVisible.value) {
    clearHighlight()
  }
  findPanelVisible.value = true
  showReplace.value = (mode === 'replace')
  findKeyword.value = ''
  replaceKeyword.value = ''
  findCount.value = null
  nextTick(() => {
    findInputRef.value?.focus()
  })
}

const closeFindPanel = () => {
  findPanelVisible.value = false
  findKeyword.value = ''
  replaceKeyword.value = ''
  findCount.value = null
  clearHighlight()
}

// 清除高亮
const clearHighlight = () => {
  const vditor = getVditor()
  if (vditor) {
    // 使用 Vditor 的 search 方法，传入空字符串清除高亮
    try {
      vditor.search('', '', { isCaseSensitive: false })
    } catch (e) {
      // 忽略错误
    }
  }
}

const doFind = () => {
  const keyword = findKeyword.value
  if (!keyword) {
    findCount.value = 0
    clearHighlight()
    return
  }
  findCount.value = handleFind(keyword) ?? 0
  // 使用 Vditor 的 search 方法进行高亮
  const vditor = getVditor()
  if (vditor) {
    try {
      vditor.search(keyword, '', { isCaseSensitive: false })
    } catch (e) {
      // 忽略错误
    }
  }
}

const doReplaceAll = () => {
  handleReplace(findKeyword.value, replaceKeyword.value)
  doFind()
}

defineExpose({ handleUndo, handleRedo, handleFind, handleReplace, openFindReplacePanel, setContent, closeFindPanel })

const noteStore = useNoteStore()
const {
  noteList, openTabs, activeId, aiConfig, currentNote,
  updateNote, openNote, closeTab
} = noteStore

// ==========标签右键菜单==========
const tabMenuVisible = ref(false)
const tabMenuX = ref(0)
const tabMenuY = ref(0)
let rightClickTabId = null

const openTabContextMenu = (tabId, e) => {
  e.stopPropagation()
  tabMenuVisible.value = true
  rightClickTabId = tabId
  tabMenuX.value = e.clientX
  tabMenuY.value = e.clientY
}

// 重命名 - 复用侧边栏的重命名弹窗逻辑
const tabRename = () => {
  tabMenuVisible.value = false
  const targetNote = noteList.value.find(n => n.id === rightClickTabId)
  if (!targetNote) return
  const newName = prompt('请输入新名称', targetNote.title)
  if (newName && newName.trim()) {
    updateNote(rightClickTabId, { title: newName.trim() })
  }
}

// 删除其他标签
const closeOtherTabs = () => {
  tabMenuVisible.value = false
  Array.from(openTabs.value).forEach(t => {
    if (t.id !== rightClickTabId) {
      closeTab(t.id)
    }
  })
}

// 删除全部标签
const closeAllTabs = () => {
  tabMenuVisible.value = false
  Array.from(openTabs.value).forEach(t => closeTab(t.id))
}

// AI润色
const handlePolish = async () => {
  if (!currentNote.value) {
    alert('请先选择一条笔记再执行润色')
    return
  }
  if (!confirm('确定要AI润色并覆盖当前笔记内容吗？')) return
  try {
    const result = await polishMarkdown(currentNote.value.content, aiConfig.baseUrl, aiConfig.apiKey)
    // 通过 emit 更新内容
    defineEmits(['update:modelValue'])
    // 直接保存
    updateNote(currentNote.value.id, { content: result })
  } catch (err) {
    alert('润色失败：' + err.message)
  }
}
</script>