<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-40 flex items-center justify-center p-4">
      <!-- 遮罩 -->
      <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>

      <!-- 卡片 -->
      <div
        class="relative w-[640px] max-w-[92vw] max-h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden transition-colors duration-300"
        :class="isDark ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-800'"
      >
        <!-- 头部 -->
        <div class="flex items-center justify-between px-5 py-4 border-b transition-colors duration-300"
             :class="isDark ? 'border-slate-700' : 'border-slate-200'">
          <div class="flex items-center gap-2">
            <Icon name="trash" class="w-5 h-5" :class="isDark ? 'text-slate-300' : 'text-slate-500'" />
            <h3 class="text-base font-semibold">回收站</h3>
            <span v-if="totalCount > 0" class="text-xs px-2 py-0.5 rounded-full"
                  :class="isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'">
              {{ totalCount }} 项
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="totalCount > 0"
              class="px-3 py-1.5 rounded-lg text-sm border transition-colors duration-300"
              :class="isDark
                ? 'border-red-500/60 text-red-300 hover:bg-red-500/10'
                : 'border-red-300 text-red-600 hover:bg-red-50'"
              @click="emptyAll"
            >清空回收站</button>
            <button
              class="w-8 h-8 p-1.2 rounded-full transition-colors duration-300 border"
              :class="isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'"
              @click="emit('close')"
            >
              <Icon name="close" class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- 内容 -->
        <div class="flex-1 overflow-y-auto px-5 py-4">
          <!-- 加载中 -->
          <div v-if="loading" class="text-center py-10 text-sm" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
            加载中…
          </div>

          <!-- 空状态 -->
          <div v-else-if="totalCount === 0" class="flex flex-col items-center justify-center py-14 text-center">
            <Icon name="trash" class="w-12 h-12 mb-3" :class="isDark ? 'text-slate-600' : 'text-slate-300'" />
            <p class="text-sm" :class="isDark ? 'text-slate-400' : 'text-slate-500'">回收站为空</p>
            <p class="text-xs mt-1" :class="isDark ? 'text-slate-500' : 'text-slate-400'">删除的笔记与文件夹会出现在这里，可随时恢复</p>
          </div>

          <!-- 列表 -->
          <div v-else class="space-y-5">
            <!-- 文件夹 -->
            <section v-if="deletedFolders.length">
              <h4 class="text-xs font-medium mb-2" :class="isDark ? 'text-slate-400' : 'text-slate-500'">文件夹</h4>
              <ul class="space-y-2">
                <li
                  v-for="f in deletedFolders" :key="f.id"
                  class="flex items-center justify-between rounded-lg px-3 py-2 transition-colors duration-300"
                  :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'"
                >
                  <div class="min-w-0">
                    <p class="text-sm truncate">{{ f.name }}</p>
                    <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">删除于 {{ fmtTime(f.deletedAt) }}</p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button class="px-3 py-1 rounded-md text-sm transition-colors duration-300 border"
                            :class="isDark ? 'bg-indigo-500/80 hover:bg-indigo-500 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'"
                            @click="restoreFolder(f.id)">恢复</button>
                    <button class="px-3 py-1 rounded-md text-sm border transition-colors duration-300 border"
                            :class="isDark ? 'border-red-500/60 text-red-300 hover:bg-red-500/10' : 'border-red-300 text-red-600 hover:bg-red-50'"
                            @click="purgeFolder(f.id)">彻底删除</button>
                  </div>
                </li>
              </ul>
            </section>

            <!-- 笔记 -->
            <section v-if="deletedNotes.length">
              <h4 class="text-xs font-medium mb-2" :class="isDark ? 'text-slate-400' : 'text-slate-500'">笔记</h4>
              <ul class="space-y-2">
                <li
                  v-for="n in deletedNotes" :key="n.id"
                  class="flex items-center justify-between rounded-lg px-3 py-2 transition-colors duration-300"
                  :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'"
                >
                  <div class="min-w-0">
                    <p class="text-sm truncate">{{ n.title || '无标题笔记' }}</p>
                    <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">删除于 {{ fmtTime(n.deletedAt) }}</p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button class="px-3 py-1 rounded-md text-sm transition-colors duration-300 border"
                            :class="isDark ? 'bg-indigo-500/80 hover:bg-indigo-500 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'"
                            @click="restoreNote(n.id)">恢复</button>
                    <button class="px-3 py-1 rounded-md text-sm border transition-colors duration-300 border"
                            :class="isDark ? 'border-red-500/60 text-red-300 hover:bg-red-500/10' : 'border-red-300 text-red-600 hover:bg-red-50'"
                            @click="purgeNote(n.id)">彻底删除</button>
                  </div>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import Icon from './Icon.vue'
import { useNoteStore } from '../stores/useNoteStore'
import { useFolderStore } from '../stores/useFolderStore'
import { useModalStore } from '../stores/useModalStore'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close'])

const isDark = inject('isDark', ref(false))
const noteStore = useNoteStore()
const folderStore = useFolderStore()
const modalStore = useModalStore()

const deletedNotes = ref([])
const deletedFolders = ref([])
const loading = ref(false)

const totalCount = computed(() => deletedNotes.value.length + deletedFolders.value.length)

const fmtTime = (ts) => {
  if (!ts) return ''
  try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }) } catch { return '' }
}

const refresh = async () => {
  loading.value = true
  try {
    deletedNotes.value = await noteStore.getDeletedNotes()
    deletedFolders.value = await folderStore.getDeletedFolders()
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (v) => { if (v) refresh() })

const restoreNote = async (id) => { await noteStore.restoreNote(id); await refresh() }
const restoreFolder = async (id) => { await folderStore.restoreFolder(id); await refresh() }

const purgeNote = async (id) => {
  const ok = await modalStore.confirm({
    title: '彻底删除笔记',
    message: '该笔记将被永久删除，无法恢复。确定继续吗？',
    confirmText: '彻底删除',
    confirmDanger: true
  })
  if (!ok) return
  await noteStore.purgeNote(id)
  await refresh()
}

const purgeFolder = async (id) => {
  const ok = await modalStore.confirm({
    title: '彻底删除文件夹',
    message: '该文件夹及其下的笔记将被永久删除，无法恢复。确定继续吗？',
    confirmText: '彻底删除',
    confirmDanger: true
  })
  if (!ok) return
  await folderStore.purgeFolder(id)
  await refresh()
}

const emptyAll = async () => {
  const ok = await modalStore.confirm({
    title: '清空回收站',
    message: '回收站中的所有笔记和文件夹将被永久删除，无法恢复。确定继续吗？',
    confirmText: '清空',
    confirmDanger: true
  })
  if (!ok) return
  await noteStore.emptyRecycleBin()
  await folderStore.emptyRecycleBinFolders()
  await refresh()
}
</script>
