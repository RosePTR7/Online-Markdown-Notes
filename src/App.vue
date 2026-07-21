<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- 顶部栏：项目标题 + 多标签页 + AI配置按钮 -->
    <div class="flex items-center border-b border-gray-200 px-4 py-2 gap-2 shrink-0">
      <span class="font-bold text-lg">在线Markdown笔记</span>
      <div class="flex-1 flex gap-1 overflow-x-auto">
        <!-- 修复点：点击标签执行openNote，实现多标签新增逻辑 -->
        <div
          v-for="tab in openTabs"
          :key="tab.id"
          class="px-3 py-1 rounded cursor-pointer flex items-center gap-1 shrink-0"
          :class="activeId === tab.id ? 'bg-blue-500 text-white' : 'bg-gray-100'"
          @click="openNote(tab.id)"
        >
          {{ tab.title }}
          <!-- stop阻止冒泡，点击关闭仅执行closeTab，不会切换笔记 -->
          <span @click.stop="closeTab(tab.id)" class="hover:text-red-500">×</span>
        </div>
      </div>
      <button class="px-3 py-1 bg-gray-200 rounded shrink-0" @click="showSetting=true">AI配置</button>
    </div>

    <!-- 主体两栏布局：左侧列表 + 右侧编辑区 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 左侧：笔记列表区域 -->
      <div class="w-60 border-r border-gray-200 flex flex-col shrink-0">
        <button class="m-2 py-2 bg-green-500 text-white rounded" @click="addNote">+ 新建笔记</button>
        <div class="flex-1 overflow-auto">
          <div
            v-for="note in noteList"
            :key="note.id"
            class="p-2 border-b cursor-pointer hover:bg-gray-50 flex justify-between items-center"
            :class="activeId === note.id ? 'bg-blue-100' : ''"
            @click="openNote(note.id)"
          >
            <span>{{ note.title }}</span>
            <!-- stop阻断冒泡，删除不会触发选中笔记 -->
            <span @click.stop="delNote(note.id)" class="text-red-400 cursor-pointer">删</span>
          </div>
        </div>
      </div>

      <!-- 右侧：Markdown编辑器详情区域 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div v-if="currentNote" class="p-2 border-b flex gap-3 items-center shrink-0">
          <input
            v-model="currentNote.title"
            class="border px-2 py-1 w-60"
            @input="updateNote(currentNote.id,{title:currentNote.title})"
          />
          <button class="bg-purple-500 text-white px-3 py-1 rounded" @click="handlePolish">AI一键润色</button>
        </div>
        <MdEditor
          v-if="currentNote"
          v-model="currentNote.content"
          class="flex-1 overflow-hidden"
          @change="updateNote(currentNote.id,{content:currentNote.content})"
        />
        <div v-else class="flex items-center justify-center flex-1 text-gray-400">请新建/选择一条笔记</div>
      </div>
    </div>

    <!-- AI配置弹窗 -->
    <div v-if="showSetting" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white p-5 rounded w-96">
        <h3 class="text-lg font-bold mb-3">AI接口配置</h3>
        <div class="mb-2">
          <label>API BaseURL</label>
          <input v-model="aiConfig.aiBaseUrl" class="w-full border p-2 mt-1"/>
        </div>
        <div class="mb-3">
          <label>API Key</label>
          <input v-model="aiConfig.apiKey" class="w-full border p-2 mt-1"/>
        </div>
        <div class="flex justify-end gap-2">
          <button @click="showSetting=false">取消</button>
          <button class="bg-blue-500 text-white px-3 py-1" @click="saveConfig">保存</button>
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