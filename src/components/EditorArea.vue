<template>
  <div class="flex-1 flex flex-col overflow-hidden relative transition-colors duration-300" :class="isDark ? 'bg-slate-900' : 'bg-white'">
    <!-- 顶部工具栏区域 -->
    <div v-if="currentNote" class="flex flex-col shrink-0 transition-colors duration-300" :class="isDark ? 'bg-slate-800' : 'bg-slate-50'">
      <!-- 按钮栏 - 最上面 -->
      <div class="flex items-center px-3 py-2 gap-3">
        <!-- 文件/编辑/查看/AI配置 按钮组 - 圆角矩形包裹 -->
        <div class="flex items-center gap-1 rounded-xl px-2 py-1.5 transition-colors duration-300" :class="isDark ? 'bg-slate-700' : 'bg-slate-50'">
          <!-- 文件按钮 -->
          <button class="px-4 py-1.5 rounded-lg text-base border transition-colors duration-300" :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-200 border-slate-500' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'" @click="(e) => togglePanel('file', e.currentTarget)">文件</button>

          <!-- 顶栏下拉菜单 & 导出子菜单 - 统一复用 ContextMenu -->
          <ContextMenu :visible="activePanel !== null" :x="dropdownX" :y="dropdownY" @close="activePanel = null">
            <template v-if="activePanel === 'file'">
              <MenuItem label="导入" @click="doImport" />
              <MenuItem ref="exportMenuItemRef" :active="showSubMenu === 'export'" stop-propagation @click="toggleSubMenu('export')">
                导出
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs">▶</span>
              </MenuItem>
              <div class="my-1 transition-colors duration-300" :class="isDark ? 'border-t border-slate-600' : 'border-t border-slate-200'"></div>
              <MenuItem @click="toggleAutoSave">
                自动保存
                <span v-if="autoSaveEnabled" class="absolute right-2 top-1/2 -translate-y-1/2 text-xs">✓</span>
              </MenuItem>
            </template>
            <template v-if="activePanel === 'edit'">
              <MenuItem label="撤销" @click="doUndo()" />
              <MenuItem label="恢复" @click="doRedo()" />
              <div class="my-1 transition-colors duration-300" :class="isDark ? 'border-t border-slate-600' : 'border-t border-slate-200'"></div>
              <MenuItem label="查找和替换" @click="openFindReplacePanel()" />
            </template>
            <template v-if="activePanel === 'view'">
              <MenuItem :active="themeMode === 'light'" label="☀️ 亮色" @click="setTheme('light')" />
              <MenuItem :active="themeMode === 'dark'" label="🌙 暗色" @click="setTheme('dark')" />
              <div class="my-1 transition-colors duration-300" :class="isDark ? 'border-t border-slate-600' : 'border-t border-slate-200'"></div>
              <MenuItem :active="themeMode === 'system'" label="💻 跟随系统" @click="setTheme('system')" />
            </template>
          </ContextMenu>

          <ContextMenu :visible="showSubMenu === 'export'" :x="subMenuPosition.x" :y="subMenuPosition.y" @close="showSubMenu = null; activePanel = null">
            <MenuItem label="导出当前笔记为 MD" @click="exportCurrentNote('md')" />
            <MenuItem label="导出为带 Frontmatter 的 MD" @click="exportCurrentNote('fm-md')" />
            <MenuItem label="导出当前笔记为 HTML" @click="exportCurrentNote('html')" />
            <div class="h-px mx-2 my-1" :class="isDark ? 'bg-slate-600' : 'bg-slate-200'"></div>
            <MenuItem label="导出全部数据为 JSON" @click="exportAllJSON" />
            <MenuItem label="导出全部为 ZIP" @click="exportAllZip" />
          </ContextMenu>
          <!-- 编辑按钮 -->
          <button class="px-4 py-1.5 rounded-lg text-base border transition-colors duration-300" :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-200 border-slate-500' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'" @click="(e) => togglePanel('edit', e.currentTarget)">编辑</button>
          <!-- 查看按钮 -->
          <button class="px-4 py-1.5 rounded-lg text-base border transition-colors duration-300" :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-200 border-slate-500' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'" @click="(e) => togglePanel('view', e.currentTarget)">查看</button>
          <!-- AI配置按钮 -->
          <button ref="aiConfigRef" class="px-4 py-1.5 rounded-lg text-base border transition-colors duration-300" :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-200 border-slate-500' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'" @click="openAiConfig">AI配置</button>
        </div>
        <div class="flex-1"></div>

        <!-- 手动保存按钮（紧贴状态块左侧，点完即可见状态翻绿） -->
        <button
          class="shrink-0 px-3 py-1.5 rounded-lg text-sm border transition-colors duration-300"
          :class="isDark
            ? 'bg-slate-600 hover:bg-slate-500 text-slate-200 border-slate-500'
            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'"
          title="保存 (Ctrl/Cmd+S)"
          @click="emit('manual-save')"
        >保存</button>

        <!-- 保存状态区域 -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- 加载转圈动画 - 仅「自动保存开启且未保存」时显示 -->
          <Icon name="spinner" class="animate-spin h-4 w-4 text-indigo-500" v-if="isUnsaved && autoSaveEnabled" />
          <!-- 保存状态 - 圆角矩形色块 -->
          <div 
            class="px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-300"
            :class="isUnsaved ? 'bg-red-500 text-white' : 'bg-green-500 text-white'"
          >
            {{ isUnsaved ? '未保存' : '已保存' }}
          </div>
        </div>
        
        <!-- AI一键润色按钮 - 圆角矩形 -->
        <button class="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl px-4 py-1 text-sm shrink-0 border border-indigo-500" @click="handlePolish">AI一键润色</button>
      </div>
      
      <!-- 标签页区域 - 紧贴编辑器 -->
      <div class="flex items-end px-2 border-b transition-colors duration-300" :class="isDark ? 'border-slate-600' : 'border-slate-400'">
        <div class="flex-1 flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-transparent transition-colors duration-300" :class="isDark ? 'scrollbar-thumb-slate-500' : 'scrollbar-thumb-slate-300'">
          <draggable
            v-model="tabList"
            item-key="id"
            class="flex gap-1"
            ghost-class="opacity-50"
            @end="onTabDragEnd"
          >
            <template #item="{ element: tab }">
              <div
                class="px-4 py-1.5 rounded-t-lg cursor-pointer flex items-center gap-2 shrink-0 max-w-[200px] border border-b-0 -mb-px transition-colors duration-300"
                :class="isDark
                  ? (activeId === tab.id ? 'bg-slate-900 text-indigo-300 border-slate-600' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 border-slate-500')
                  : (activeId === tab.id ? 'bg-white text-indigo-600 border-slate-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 border-slate-400')"
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

    <!-- 标签右键菜单 - 复用通用 ContextMenu 组件 -->
    <ContextMenu :visible="tabMenuVisible" :x="tabMenuX" :y="tabMenuY" @close="tabMenuVisible = false">
      <MenuItem label="重命名" @click="tabRename" />
      <MenuItem label="删除其他" @click="closeOtherTabs" />
      <MenuItem danger label="删除所有" @click="closeAllTabs" />
    </ContextMenu>

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
            class="w-6 h-6 flex items-center justify-center transition-colors duration-300"
            :class="[showReplace ? 'rotate-90' : '', isDark ? 'text-slate-400 hover:text-indigo-400' : 'text-slate-500 hover:text-indigo-500']"
            @click="showReplace = !showReplace"
            title="展开/收起替换"
          >▶</button>
          <input
            v-model="findKeyword"
            type="text"
            placeholder="查找内容..."
            class="flex-1 box-border px-2 py-1 border rounded text-sm outline-none focus:border-indigo-400 transition-colors duration-300"
            :class="isDark ? 'bg-slate-600 border-slate-500 text-slate-200 placeholder-slate-400' : 'border-slate-300 bg-white'"
            @keyup.enter="doFind"
            ref="findInputRef"
          />
          <span v-if="findCount !== null" class="text-xs whitespace-nowrap transition-colors duration-300" :class="isDark ? 'text-slate-400' : 'text-slate-500'">{{ findCount }} 处</span>
          <button class="px-3 py-1 rounded text-sm shrink-0 transition-colors duration-300" :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'" @click="doFind">查找</button>
        </div>
        <!-- 替换行（可展开） -->
        <div v-if="showReplace" class="flex items-center gap-2 pl-8">
          <input
            v-model="replaceKeyword"
            type="text"
            placeholder="替换为..."
            class="flex-1 box-border px-2 py-1 border rounded text-sm outline-none focus:border-indigo-400 transition-colors duration-300"
            :class="isDark ? 'bg-slate-600 border-slate-500 text-slate-200 placeholder-slate-400' : 'border-slate-300 bg-white'"
            @keyup.enter="doReplaceAll"
          />
          <button class="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-sm shrink-0" @click="doReplaceAll">替换全部</button>
        </div>
      </div>
    </FloatingPanel>

    <!-- AI润色加载悬浮窗 -->
    <FloatingPanel
      :visible="polishLoading"
      title="AI润色"
      panel-class="min-w-[300px]"
    >
      <div class="flex flex-col items-center gap-3 py-4">
        <!-- 加载动画 -->
        <Icon name="spinner" class="animate-spin h-8 w-8 text-indigo-500" />
        <p class="text-sm transition-colors duration-300" :class="isDark ? 'text-slate-200' : 'text-slate-700'">AI润色中...</p>
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
          class="w-full box-border h-64 px-3 py-2 border rounded-lg text-sm outline-none focus:border-indigo-400 resize-none transition-colors duration-300"
          :class="isDark ? 'bg-slate-600 border-slate-500 text-slate-200 placeholder-slate-400' : 'border-slate-300 bg-white'"
          placeholder="润色后的内容..."
        ></textarea>
        <div class="flex justify-end gap-3">
          <button
            class="px-5 py-2 rounded-xl text-sm border transition-colors duration-300"
            :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-200 border-slate-500' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'"
            @click="discardPolish"
          >丢弃</button>
          <button
            class="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm border border-indigo-500"
            @click="applyPolish"
          >覆盖</button>
        </div>
      </div>
    </FloatingPanel>

    <!-- AI配置悬浮窗 - 复用通用悬浮窗组件 -->
    <FloatingPanel
      :visible="showSetting"
      title="AI接口配置"
      panel-class="w-96"
      :default-position="aiConfigPos"
      @close="showSetting = false"
    >
      <div class="flex flex-col gap-3">
        <div>
          <label class="block text-sm transition-colors duration-300" :class="isDark ? 'text-slate-300' : 'text-slate-700'">API BaseURL</label>
          <input v-model="aiConfig.baseUrl" class="w-full box-border border p-2 mt-1 rounded-lg outline-none focus:border-indigo-400 transition-colors duration-300" :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'border-slate-300 bg-white'"/>
        </div>
        <div>
          <label class="block text-sm transition-colors duration-300" :class="isDark ? 'text-slate-300' : 'text-slate-700'">API Key</label>
          <input v-model="aiConfig.apiKey" class="w-full box-border border p-2 mt-1 rounded-lg outline-none focus:border-indigo-400 transition-colors duration-300" :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'border-slate-300 bg-white'"/>
        </div>
        <div>
          <label class="block text-sm transition-colors duration-300" :class="isDark ? 'text-slate-300' : 'text-slate-700'">AI模型</label>
          <input v-model="aiConfig.model" class="w-full box-border border p-2 mt-1 rounded-lg outline-none focus:border-indigo-400 transition-colors duration-300" :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400' : 'border-slate-300 bg-white'" placeholder="例如: qwen3.7-plus"/>
        </div>
        <div class="flex justify-end gap-2">
          <button class="px-3 py-1 rounded-lg transition-colors duration-300" :class="isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'" @click="showSetting=false">取消</button>
          <button class="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded-lg" @click="saveAiConfig()">保存</button>
        </div>
      </div>
    </FloatingPanel>

    <!-- 消息提示悬浮窗 -->
    <FloatingPanel
      :visible="messagePanelVisible"
      :title="messagePanelTitle"
      panel-class="min-w-[300px] max-w-[400px]"
      @close="closeMessagePanel"
    >
      <div class="flex flex-col gap-3">
        <p class="text-sm transition-colors duration-300" :class="isDark ? 'text-slate-200' : 'text-slate-700'">{{ messagePanelContent }}</p>
        <div class="flex justify-end">
          <button class="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm" @click="closeMessagePanel">确定</button>
        </div>
      </div>
    </FloatingPanel>

    <!-- 输入悬浮窗 -->
    <FloatingPanel
      :visible="inputPanelVisible"
      :title="inputPanelTitle"
      panel-class="min-w-[350px]"
      @close="closeInputPanel"
    >
      <div class="flex flex-col gap-3">
        <input
          v-model="inputPanelValue"
          type="text"
          class="w-full box-border px-3 py-2 border rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors duration-300"
          :class="isDark ? 'bg-slate-600 border-slate-500 text-slate-200 placeholder-slate-400' : 'border-slate-300 bg-white'"
          :placeholder="inputPanelPlaceholder"
          @keyup.enter="confirmInputPanel"
          ref="inputPanelRef"
        />
        <div class="flex justify-end gap-2">
          <button class="px-4 py-1.5 rounded-lg text-sm border transition-colors duration-300" :class="isDark ? 'bg-slate-600 hover:bg-slate-500 text-slate-200 border-slate-500' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'" @click="closeInputPanel">取消</button>
          <button class="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm" @click="confirmInputPanel">确定</button>
        </div>
      </div>
    </FloatingPanel>

    <MdEditor
      ref="mdEditor"
      v-if="currentNote"
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      class="flex-1 overflow-hidden"
    />
    <div v-else class="flex items-center justify-center flex-1 transition-colors duration-300" :class="isDark ? 'text-slate-500' : 'text-gray-400'">请新建/选择一条笔记</div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed, inject } from 'vue'
import { useNoteStore } from '../stores/useNoteStore'
import { useModalStore } from '../stores/useModalStore'
import MdEditor from './MdEditor.vue'
import FloatingPanel from './FloatingPanel.vue'
import ContextMenu from './ContextMenu.vue'
import MenuItem from './MenuItem.vue'
import Icon from './Icon.vue'
import { polishMarkdown } from '../utils/aiApi'
import draggable from 'vuedraggable'
import { 
  exportNoteAsMarkdown, 
  exportNoteAsFrontmatterMarkdown, 
  exportNoteAsHTML, 
  exportAllAsJSON, 
  exportAllAsZip,
  downloadFile,
  downloadBlob
} from '../utils/importExport'

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

const emit = defineEmits(['update:modelValue', 'undo', 'redo', 'set-theme', 'manual-save'])

// 注入主题
const isDark = inject('isDark', ref(false))
const themeMode = inject('themeMode', ref('light'))

// 设置主题 - 通过emit通知App.vue更改
const setTheme = (mode) => {
  emit('set-theme', mode)
}

const mdEditor = ref(null)

const getVditor = () => mdEditor.value?.getVditor?.()

// 撤销/恢复 - 通过emit调用App.vue的逻辑
const doUndo = () => emit('undo')
const doRedo = () => emit('redo')

// ==========编辑/查看/文件面板==========
const activePanel = ref(null) // 'edit' | 'view' | 'file' | null
const exportMenuItemRef = ref(null)
const showSubMenu = ref(null) // 'export' | null
const subMenuPosition = ref({ x: 0, y: 0 })
const dropdownX = ref(0)
const dropdownY = ref(0)

const togglePanel = (panel, btnRef) => {
  if (activePanel.value === panel) {
    activePanel.value = null
    showSubMenu.value = null
  } else {
    // btnRef 由模板事件 @click="(e) => togglePanel(panel, e.currentTarget)" 传入，
    // 即被点击的按钮 DOM 元素本身，始终持有正确的 getBoundingClientRect，
    // 据此在按钮正下方生成菜单，避免落到网页左上角 (0,0)。
    const el = btnRef && btnRef.getBoundingClientRect ? btnRef : null
    if (el) {
      const rect = el.getBoundingClientRect()
      dropdownX.value = rect.left
      dropdownY.value = rect.bottom + 4
    }
    activePanel.value = panel
    showSubMenu.value = null
  }
}

// 切换子菜单（导出）
const toggleSubMenu = (type) => {
  if (showSubMenu.value === type) {
    showSubMenu.value = null
  } else {
    showSubMenu.value = type
    // 计算子菜单位置（在对应项的右侧）
    const menuItemRef = exportMenuItemRef
    if (menuItemRef.value) {
      const rect = menuItemRef.value.getBoundingClientRect()
      subMenuPosition.value = { x: rect.right + 4, y: rect.top }
    }
  }
}

// ==========导入功能==========
// 直接弹出文件选择器，支持多种格式（导入编排统一走 store.importFiles，与侧边栏拖拽共用）
const doImport = () => {
  showSubMenu.value = null
  activePanel.value = null
  const input = document.createElement('input')
  input.type = 'file'
  // 支持所有可导入的文件类型
  input.accept = '.md,.markdown,.txt,.json'
  input.multiple = false
  input.onchange = (e) => noteStore.importFiles(e.target.files)
  input.click()
}

// 菜单的点击外部关闭由 ContextMenu 组件的遮罩层处理，无需额外监听

// AI配置弹窗
const showSetting = ref(false)
// AI配置面板锚定在按钮正下方：打开时按按钮坐标算位置，避免固定 (100,80) 在窄屏/缩放下溢出右边界
const aiConfigRef = ref(null)
const aiConfigPos = ref({ x: 100, y: 80 })
const openAiConfig = () => {
  const el = aiConfigRef.value
  if (el) {
    const rect = el.getBoundingClientRect()
    aiConfigPos.value = { x: rect.left, y: rect.bottom + 4 }
  }
  showSetting.value = true
}

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

// 获取编辑器渲染区域 - 使用更可靠的方式
const getEditorElement = () => {
  // 直接通过 DOM 查询获取编辑区域
  // vditor ir 模式下的编辑区域是 [contenteditable] 元素
  const editableElement = document.querySelector('.vditor-ir .vditor-reset[contenteditable]')
  if (editableElement) return editableElement
  
  // 备用方案：尝试通过 vditor 实例获取
  const vditor = getVditor()
  if (vditor?.vditor?.ir?.element) {
    return vditor.vditor.ir.element
  }
  
  // 最后尝试
  return document.querySelector('.vditor-reset')
}

// 清除高亮 - 将所有高亮 span 还原为文本
const clearHighlight = () => {
  const editorElement = getEditorElement()
  if (!editorElement) return
  
  const highlights = editorElement.querySelectorAll('.vditor-search-highlight')
  highlights.forEach(span => {
    const parent = span.parentNode
    if (parent) {
      // 用文本内容替换 span
      const textNode = document.createTextNode(span.textContent || '')
      parent.replaceChild(textNode, span)
      // 合并相邻的文本节点
      parent.normalize()
    }
  })
}

// 高亮匹配的文本
const highlightMatches = (keyword) => {
  if (!keyword) return
  
  const editorElement = getEditorElement()
  if (!editorElement) return
  
  // 先清除之前的高亮
  clearHighlight()
  
  // 创建高亮正则表达式（转义特殊字符）
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escapedKeyword, 'gi')
  
  // 收集所有文本节点（排除高亮 span 内的）
  const textNodes = []
  const walker = document.createTreeWalker(
    editorElement,
    NodeFilter.SHOW_TEXT,
    null,
    false
  )
  
  let node
  while (node = walker.nextNode()) {
    // 跳过空文本节点
    if (!node.textContent || node.textContent.trim() === '') continue
    // 跳过已经在高亮 span 内的文本节点
    if (node.parentElement?.classList.contains('vditor-search-highlight')) continue
    textNodes.push(node)
  }
  
  // 处理每个文本节点
  textNodes.forEach(textNode => {
    const text = textNode.textContent
    if (!text) return
    
    // 检查是否有匹配
    regex.lastIndex = 0
    if (!regex.test(text)) return
    
    const fragment = document.createDocumentFragment()
    let lastIndex = 0
    let match
    
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      // 添加匹配前的文本
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
      }
      
      // 添加高亮的匹配文本
      const span = document.createElement('span')
      span.className = 'vditor-search-highlight'
      span.style.backgroundColor = '#fbbf24'
      span.style.color = '#1f2937'
      span.style.padding = '0 2px'
      span.style.borderRadius = '2px'
      span.textContent = match[0]
      fragment.appendChild(span)
      
      lastIndex = regex.lastIndex
    }
    
    // 添加剩余的文本
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
    }
    
    // 替换原始文本节点
    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode)
    }
  })
  
}

const doFind = () => {
  const keyword = findKeyword.value
  if (!keyword) {
    findCount.value = 0
    clearHighlight()
    return
  }
  findCount.value = handleFind(keyword) ?? 0
  // 使用手动高亮功能
  highlightMatches(keyword)
}

const doReplaceAll = () => {
  handleReplace(findKeyword.value, replaceKeyword.value)
  doFind()
}

defineExpose({ handleFind, handleReplace, openFindReplacePanel, setContent, closeFindPanel, doFind, doReplaceAll })

const noteStore = useNoteStore()
const {
  noteList, openTabs, activeId, aiConfig, currentNote,
  updateNote, openNote, closeTab,
  autoSaveEnabled, setAutoSave
} = noteStore

// 文件菜单「自动保存」开关：切换并持久化（默认开，关闭后记住习惯）
const toggleAutoSave = () => setAutoSave(!autoSaveEnabled.value)

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

// 重命名 - 使用输入悬浮窗
const tabRename = () => {
  tabMenuVisible.value = false
  const targetNote = noteList.value.find(n => n.id === rightClickTabId)
  if (!targetNote) return
  showInputPanel('重命名', targetNote.title, '请输入新名称', (newName) => {
    if (newName && newName.trim()) {
      updateNote(rightClickTabId, { title: newName.trim() })
    }
  })
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

// ==========消息提示悬浮窗==========
const messagePanelVisible = ref(false)
const messagePanelTitle = ref('提示')
const messagePanelContent = ref('')

const showMessagePanel = (title, content) => {
  messagePanelTitle.value = title
  messagePanelContent.value = content
  messagePanelVisible.value = true
}

const closeMessagePanel = () => {
  messagePanelVisible.value = false
  messagePanelContent.value = ''
}

// ==========输入悬浮窗==========
const inputPanelVisible = ref(false)
const inputPanelTitle = ref('输入')
const inputPanelValue = ref('')
const inputPanelPlaceholder = ref('')
const inputPanelRef = ref(null)
let inputPanelCallback = null

const showInputPanel = (title, defaultValue, placeholder, callback) => {
  inputPanelTitle.value = title
  inputPanelValue.value = defaultValue || ''
  inputPanelPlaceholder.value = placeholder || ''
  inputPanelCallback = callback
  inputPanelVisible.value = true
  nextTick(() => {
    inputPanelRef.value?.focus()
  })
}

const closeInputPanel = () => {
  inputPanelVisible.value = false
  inputPanelValue.value = ''
  inputPanelCallback = null
}

const confirmInputPanel = () => {
  if (inputPanelCallback) {
    inputPanelCallback(inputPanelValue.value)
  }
  closeInputPanel()
}

// ==========AI润色悬浮窗==========
const polishPanelVisible = ref(false)
const polishedContent = ref('')
const polishLoading = ref(false)

const handlePolish = async () => {
  if (!currentNote.value) {
    showMessagePanel('提示', '请先选择一条笔记再执行润色')
    return
  }
  if (!aiConfig.value.baseUrl || !aiConfig.value.apiKey || !aiConfig.value.model) {
    showMessagePanel('提示', '请先配置AI接口（点击"AI配置"按钮）')
    return
  }
  // 显示加载悬浮窗
  polishLoading.value = true
  try {
    const result = await polishMarkdown(currentNote.value.content, aiConfig.value.baseUrl, aiConfig.value.apiKey, aiConfig.value.model)
    polishedContent.value = result
    polishPanelVisible.value = true
  } catch (err) {
    console.error('Polish error:', err)
    showMessagePanel('错误', '润色失败：' + err.message)
  } finally {
    // 关闭加载悬浮窗
    polishLoading.value = false
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
  // 只需通过 emit 更新内容：editorContent 变化会触发按笔记独立的后台保存（含本地落盘），
  // 不必再直接 updateNote（那会让本地笔记写 Dexie 而漏掉磁盘 frontmatter）。
  emit('update:modelValue', result)
  // 关闭悬浮窗
  discardPolish()
}

// ==========导入导出功能==========
const modalStore = useModalStore()

// 导出当前笔记
const exportCurrentNote = (type) => {
  showSubMenu.value = null
  activePanel.value = null
  const note = currentNote.value
  if (!note) {
    modalStore.showToast('请先选择一条笔记', 'warning')
    return
  }
  
  let content, filename, mimeType
  const safeTitle = note.title.replace(/[\\/:*?"<>|]/g, '_')
  
  switch (type) {
    case 'md':
      content = exportNoteAsMarkdown(note)
      filename = `${safeTitle}.md`
      mimeType = 'text/markdown;charset=utf-8'
      break
    case 'fm-md':
      content = exportNoteAsFrontmatterMarkdown(note)
      filename = `${safeTitle}.md`
      mimeType = 'text/markdown;charset=utf-8'
      break
    case 'html':
      content = exportNoteAsHTML(note)
      filename = `${safeTitle}.html`
      mimeType = 'text/html;charset=utf-8'
      break
  }
  
  if (content) {
    downloadFile(content, filename, mimeType)
  }
}

// 导出全部数据为 JSON
const exportAllJSON = async () => {
  showSubMenu.value = null
  activePanel.value = null
  try {
    const content = await exportAllAsJSON()
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(content, `notes-backup-${date}.json`, 'application/json')
  } catch (err) {
    console.error('Export error:', err)
    modalStore.showToast('导出失败: ' + err.message, 'error')
  }
}

// 导出全部为 ZIP（保留文件夹层级 + backup.json）
const exportAllZip = async () => {
  showSubMenu.value = null
  activePanel.value = null
  try {
    const blob = await exportAllAsZip()
    const date = new Date().toISOString().slice(0, 10)
    downloadBlob(blob, `notes-backup-${date}.zip`)
    modalStore.showToast('导出成功', 'success')
  } catch (err) {
    console.error('ZIP 导出失败:', err)
    modalStore.showToast('导出失败: ' + err.message, 'error')
  }
}
</script>
