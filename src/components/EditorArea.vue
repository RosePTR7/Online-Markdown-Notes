<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-white relative">
    <!-- 顶部工具栏区域 -->
    <div v-if="currentNote" class="flex flex-col shrink-0 bg-slate-50">
      <!-- 按钮栏 - 最上面 -->
      <div class="flex items-center px-3 py-2 gap-3">
        <!-- 编辑/查看按钮组 - 圆角矩形包裹 -->
        <div class="flex items-center gap-1 bg-slate-100 rounded-xl px-2 py-1.5">
          <div class="relative" ref="editMenuRef">
            <button class="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-base border border-slate-200" @click="togglePanel('edit')">编辑</button>
            <!-- 编辑下拉菜单 -->
            <div v-if="activePanel === 'edit'" class="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-40">
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700 rounded-lg mx-1" @click="doUndo()">撤销</div>
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700 rounded-lg mx-1" @click="doRedo()">恢复</div>
              <div class="border-t border-slate-200 my-1"></div>
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700 rounded-lg mx-1" @click="openFindReplacePanel()">查找和替换</div>
            </div>
          </div>
          <div class="relative" ref="viewMenuRef">
            <button class="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-base border border-slate-200" @click="togglePanel('view')">查看</button>
            <!-- 查看下拉菜单 -->
            <div v-if="activePanel === 'view'" class="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 w-36">
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700 rounded-lg mx-1" @click="themeMode = 'light'">☀️ 亮色</div>
              <div class="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700 rounded-lg mx-1" @click="themeMode = 'dark'">🌙 暗色</div>
            </div>
          </div>
        </div>
        
        <!-- AI配置按钮 -->
        <button class="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-base border border-slate-300" @click="showSetting=true">AI配置</button>
        <div class="flex-1"></div>
        
        <!-- 保存状态 - 圆角矩形色块 -->
        <div 
          class="px-3 py-1 rounded-lg text-sm font-medium shrink-0"
          :class="isUnsaved ? 'bg-red-500 text-white' : 'bg-green-500 text-white'"
        >
          {{ isUnsaved ? '未保存' : '已保存' }}
        </div>
        
        <!-- AI一键润色按钮 - 圆角矩形 -->
        <button class="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl px-4 py-1 text-sm shrink-0 border border-indigo-500" @click="handlePolish">AI一键润色</button>
      </div>
      
      <!-- 标签页区域 - 紧贴编辑器 -->
      <div class="flex items-end px-2 border-b border-slate-400">
        <div class="flex-1 flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <draggable
            v-model="tabList"
            item-key="id"
            class="flex gap-1"
            ghost-class="opacity-50"
            @end="onTabDragEnd"
          >
            <template #item="{ element: tab }">
              <div
                class="px-4 py-1.5 rounded-t-lg cursor-pointer flex items-center gap-2 shrink-0 max-w-[200px] border border-b-0 -mb-px"
                :class="activeId === tab.id
                  ? 'bg-white text-indigo-600 border-slate-200'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300 border-slate-400'"
                @click="openNote(tab.id)"
                @contextmenu.prevent="openTabContextMenu(tab.id, $event)"
              >
                <span class="truncate text-lg">{{ noteList?.find(n => n.id === tab.id)?.title || '' }}</span>
                <span @click.stop="closeTab(tab.id)" class="hover:text-red-500 shrink-0 text-xl leading-none">×</span>
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </div>

    <!-- 标签右键菜单 独立遮罩关闭 -->
    <div
      v-if="tabMenuVisible"
      class="fixed inset-0 z-40"
      @click="tabMenuVisible = false"
    >
      <div
        class="fixed bg-white shadow-lg border rounded-xl py-1 z-50 w-32"
        :style="{ left: tabMenuX + 'px', top: tabMenuY + 'px' }"
        @click.stop
      >
        <div class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm rounded-lg mx-1" @click="tabRename">重命名</div>
        <div class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm rounded-lg mx-1" @click="closeOtherTabs">删除其他</div>
        <div class="px-3 py-2 hover:bg-red-50 cursor-pointer text-sm text-red-500 rounded-lg mx-1" @click="closeAllTabs">删除所有</div>
      </div>
    </div>

    <!-- 查找/替换悬浮窗口 - 使用通用悬浮窗组件 -->
    <FloatingPanel
      :visible="findPanelVisible"
      title="查找和替换"
      panel-class="min-w-[400px]"
      @close="closeFindPanel"
    >
      <div class="flex flex-col gap-2">
        <!-- 查找行 -->
        <div class="flex items-center gap-2">
          <button 
            class="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-indigo-500 transition-transform"
            :class="{ 'rotate-90': showReplace }"
            @click="showReplace = !showReplace"
            title="展开/收起替换"
          >▶</button>
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
        <!-- 替换行（可展开） -->
        <div v-if="showReplace" class="flex items-center gap-2 pl-8">
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
    </FloatingPanel>

    <!-- AI润色悬浮窗 -->
    <FloatingPanel
      :visible="polishPanelVisible"
      title="AI润色结果"
      panel-class="min-w-[500px] max-w-[700px]"
      @close="discardPolish"
    >
      <div class="flex flex-col gap-3">
        <textarea
          v-model="polishedContent"
          class="w-full h-64 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-400 resize-none"
          placeholder="润色后的内容..."
        ></textarea>
        <div class="flex justify-end gap-3">
          <button
            class="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm border border-slate-300"
            @click="discardPolish"
          >丢弃</button>
          <button
            class="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm border border-indigo-500"
            @click="applyPolish"
          >覆盖</button>
        </div>
      </div>
    </FloatingPanel>

    <!-- AI配置弹窗 -->
    <div v-if="showSetting" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white p-5 rounded-xl w-96">
        <h3 class="text-lg font-bold mb-3 text-slate-800">AI接口配置</h3>
        <div class="mb-2">
          <label class="text-slate-700">API BaseURL</label>
          <input v-model="aiConfig.baseUrl" class="w-full border border-slate-300 p-2 mt-1 rounded-lg outline-none focus:border-indigo-400"/>
        </div>
        <div class="mb-2">
          <label class="text-slate-700">API Key</label>
          <input v-model="aiConfig.apiKey" class="w-full border border-slate-300 p-2 mt-1 rounded-lg outline-none focus:border-indigo-400"/>
        </div>
        <div class="mb-3">
          <label class="text-slate-700">AI模型</label>
          <input v-model="aiConfig.model" class="w-full border border-slate-300 p-2 mt-1 rounded-lg outline-none focus:border-indigo-400" placeholder="例如: qwen3.7-plus"/>
        </div>
        <div class="flex justify-end gap-2">
          <button class="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700" @click="showSetting=false">取消</button>
          <button class="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded-lg" @click="saveAiConfig()">保存</button>
        </div>
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
import { ref, nextTick, computed, onBeforeUnmount } from 'vue'
import { useNoteStore } from '../stores/useNoteStore'
import MdEditor from './MdEditor.vue'
import FloatingPanel from './FloatingPanel.vue'
import { polishMarkdown } from '../utils/aiApi'
import draggable from 'vuedraggable'

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

const emit = defineEmits(['update:modelValue', 'undo', 'redo'])

const mdEditor = ref(null)

const getVditor = () => mdEditor.value?.getVditor?.()

// 撤销/恢复 - 通过emit调用App.vue的逻辑
const doUndo = () => emit('undo')
const doRedo = () => emit('redo')

// ==========编辑/查看面板==========
const activePanel = ref(null) // 'edit' | 'view' | null
const editMenuRef = ref(null)
const viewMenuRef = ref(null)

const togglePanel = (panel) => {
  activePanel.value = activePanel.value === panel ? null : panel
}

// 点击外部关闭菜单
const closePanelOnClickOutside = (e) => {
  if (activePanel.value === 'edit' && editMenuRef.value && !editMenuRef.value.contains(e.target)) {
    activePanel.value = null
  } else if (activePanel.value === 'view' && viewMenuRef.value && !viewMenuRef.value.contains(e.target)) {
    activePanel.value = null
  }
}
document.addEventListener('click', closePanelOnClickOutside)

onBeforeUnmount(() => {
  document.removeEventListener('click', closePanelOnClickOutside)
})

// 主题模式
const themeMode = ref('light')

// AI配置弹窗
const showSetting = ref(false)

const saveAiConfig = () => {
  noteStore.saveAiConfig()
  showSetting.value = false
}

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

const openFindReplacePanel = () => {
  findPanelVisible.value = true
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

defineExpose({ handleFind, handleReplace, openFindReplacePanel, setContent, closeFindPanel, doFind, doReplaceAll })

const noteStore = useNoteStore()
const {
  noteList, openTabs, activeId, aiConfig, currentNote,
  updateNote, openNote, closeTab
} = noteStore

// ==========标签页拖拽排序==========
const tabList = computed({
  get: () => openTabs.value,
  set: (value) => {
    openTabs.value = value
  }
})

const onTabDragEnd = () => {
  // 拖拽结束后，openTabs 已经通过 v-model 更新
  // 这里可以添加额外的逻辑，如保存到 localStorage
}

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

// ==========AI润色悬浮窗==========
const polishPanelVisible = ref(false)
const polishedContent = ref('')

const handlePolish = async () => {
  console.log('handlePolish called', { currentNote: currentNote.value?.id, aiConfig: aiConfig.value })
  if (!currentNote.value) {
    alert('请先选择一条笔记再执行润色')
    return
  }
  if (!aiConfig.value.baseUrl || !aiConfig.value.apiKey || !aiConfig.value.model) {
    alert('请先配置AI接口（点击"AI配置"按钮）')
    return
  }
  try {
    const result = await polishMarkdown(currentNote.value.content, aiConfig.value.baseUrl, aiConfig.value.apiKey, aiConfig.value.model)
    console.log('Polish result:', result)
    polishedContent.value = result
    polishPanelVisible.value = true
  } catch (err) {
    console.error('Polish error:', err)
    alert('润色失败：' + err.message)
  }
}

// 丢弃润色结果
const discardPolish = () => {
  polishPanelVisible.value = false
  polishedContent.value = ''
}

// 应用润色结果（覆盖原内容）
const applyPolish = () => {
  const result = polishedContent.value
  // 通过 emit 更新内容
  emit('update:modelValue', result)
  // 保存笔记
  updateNote(currentNote.value.id, { content: result })
  // 关闭悬浮窗
  discardPolish()
}
</script>