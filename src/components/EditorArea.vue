<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-white">
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

    <MdEditor
      ref="mdEditorRef"
      v-if="currentNote"
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      class="flex-1 overflow-hidden"
    />
    <div v-else class="flex items-center justify-center flex-1 text-gray-400">请新建/选择一条笔记</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
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

const mdEditorRef = ref(null)
defineExpose({ mdEditorRef })

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