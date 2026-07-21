<template>
  <div class="h-screen flex flex-col overflow-hidden bg-slate-50 font-['system-ui','-apple-system','PingFang SC','Microsoft YaHei',sans-serif]" @click="closeNoteMenu">
    <!-- 顶部导航栏：仅标题+AI配置按钮，移除标签 -->
    <div class="flex items-center border-b border-slate-200 bg-white pl-10 pr-4 py-2 gap-10 shrink-0">
      <span class="font-bold text-slate-800 text-xl">在线Markdown笔记</span>
      <div class="flex-1"></div>
      <button class="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded shrink-0" @click="showSetting=true">AI配置</button>
    </div>

    <!-- 主体两栏布局 -->
    <div class="flex flex-1 overflow-hidden mt-3">
      <!-- 左侧侧边栏 -->
      <div class="w-60 border-r border-slate-200 flex flex-col shrink-0 bg-white">
        <button class="m-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-base" @click="addNote">+ 新建笔记</button>
        <div class="flex-1 overflow-auto relative">
          <div
            v-for="note in noteList"
            :key="note.id"
            class="p-2 cursor-pointer hover:bg-slate-100 text-slate-700 rounded-lg mx-1 flex justify-between items-center group"
            :class="activeId === note.id ? 'bg-indigo-100 text-indigo-700' : ''"
            @click="openNote(note.id)"
          >
            <span>{{ note.title }}</span>
            <button
              class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-gray-300 flex items-center justify-center text-lg text-gray-600"
              @click="openNoteMenu(note, $event)"
            >
              ···
            </button>
          </div>

          <!-- 三点下拉菜单 -->
          <div
            v-if="menuVisible"
            class="fixed bg-white shadow-lg border rounded py-1 z-50 w-28"
            :style="{ left: menuX + 'px', top: menuY + 'px' }"
            @click.stop
          >
            <div v-if="!showRenameInput">
              <div class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm" @click="showRenameInput = true">重命名</div>
              <div class="px-3 py-2 hover:bg-red-100 cursor-pointer text-sm text-red-500" @click="delNote(activeMenuNoteId); closeNoteMenu()">删除笔记</div>
            </div>
            <div v-else class="p-2">
              <input
                v-model="renameInputValue"
                class="border w-full px-1 py-1 text-sm mb-2 outline-none"
                @keyup.enter="submitRename"
              />
              <div class="flex gap-1 justify-end">
                <button class="text-xs px-1 border rounded" @click="closeNoteMenu">取消</button>
                <button class="text-xs px-1 bg-blue-500 text-white rounded" @click="submitRename">确定</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧编辑器区域 -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- 标签页 + AI润色按钮同行 -->
        <div v-if="currentNote" class="p-2 border-b flex items-center shrink-0 gap-4">
          <div class="flex-1 flex gap-1 overflow-x-auto">
            <div
              v-for="tab in openTabs"
              :key="tab.id"
              class="px-3 py-1 rounded-t cursor-pointer flex items-center gap-1 shrink-0"
              :class="activeId === tab.id
                ? 'bg-slate-100 text-indigo-600 border-b-2 border-indigo-500'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              @click="openNote(tab.id)"
            >
              {{ tab.title }}
              <span @click.stop="closeTab(tab.id)" class="hover:text-red-500">×</span>
            </div>
          </div>
          <button class="bg-indigo-500 hover:bg-indigo-600 text-white rounded px-3 py-1 shrink-0" @click="handlePolish">AI一键润色</button>
        </div>
        <MdEditor
          :key="activeId"
          v-if="currentNote"
          :model-value="currentNote.content"
          class="flex-1 overflow-hidden"
          @update:model-value="(val) => updateNote(currentNote.id, { content: val })"
        />
        <div v-else class="flex items-center justify-center flex-1 text-gray-400">请新建/选择一条笔记</div>
      </div>
    </div>

    <!-- AI配置弹窗 -->
    <div v-if="showSetting" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white p-5 rounded w-96">
        <h3 class="text-lg font-bold mb-3 text-slate-800">AI接口配置</h3>
        <div class="mb-2">
          <label class="text-slate-700">API BaseURL</label>
          <input v-model="aiConfig.aiBaseUrl" class="w-full border border-slate-300 p-2 mt-1 rounded outline-none focus:border-indigo-400"/>
        </div>
        <div class="mb-3">
          <label class="text-slate-700">API Key</label>
          <input v-model="aiConfig.apiKey" class="w-full border border-slate-300 p-2 mt-1 rounded outline-none focus:border-indigo-400"/>
        </div>
        <div class="flex justify-end gap-2">
          <button class="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700" @click="showSetting=false">取消</button>
          <button class="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded" @click="saveConfig">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useNoteStore } from './stores/useNoteStore'
import MdEditor from './components/MdEditor.vue'
import { polishMarkdown } from './utils/aiApi'

const {
  noteList, openTabs, activeId, aiConfig, currentNote,
  addNote, delNote, updateNote, openNote, closeTab, saveAiConfig
} = useNoteStore()

const showSetting = ref(false)

const menuVisible = ref(false)
const activeMenuNoteId = ref('')
const renameInputValue = ref('')
const showRenameInput = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const openNoteMenu = (note, e) => {
  e.stopPropagation()
  const rect = e.target.getBoundingClientRect()
  menuX.value = rect.right + 10
  menuY.value = rect.top
  activeMenuNoteId.value = note.id
  renameInputValue.value = note.title
  showRenameInput.value = false
  menuVisible.value = true
}

const closeNoteMenu = () => {
  menuVisible.value = false
  activeMenuNoteId.value = ''
}

const submitRename = () => {
  const name = renameInputValue.value.trim()
  if (!name) return
  updateNote(activeMenuNoteId.value, { title: name })
  closeNoteMenu()
}

const saveConfig = () => {
  saveAiConfig()
  showSetting.value = false
  alert('配置保存成功')
}

const handlePolish = async () => {
  if (!currentNote.value) {
    alert('请先选择一条笔记再执行润色')
    return
  }
  if(!confirm('确定要AI润色并覆盖当前笔记内容吗?')) return
  try {
    const resContent = await polishMarkdown(currentNote.value.content, aiConfig.value.aiBaseUrl, aiConfig.value.apiKey)
    updateNote(currentNote.value.id, { content: resContent })
    alert('润色完成！')
  } catch(err) {
    alert('润色失败：' + err.message)
  }
}
</script>