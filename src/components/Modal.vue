<template>
  <Teleport to="body">
    <div
      v-if="modalState.visible"
      class="fixed inset-0 z-[200] flex items-center justify-center"
      @click.self="handleClose"
    >
      <!-- 遮罩层 -->
      <div class="absolute inset-0 bg-black/50 transition-opacity duration-200"></div>
      
      <!-- 模态框内容 -->
      <div
        class="relative rounded-xl shadow-xl p-5 w-80 max-w-[90vw] transition-colors duration-300"
        :class="isDark ? 'bg-slate-800' : 'bg-white'"
      >
        <!-- 标题 -->
        <h3
          v-if="modalState.title"
          class="text-lg font-bold mb-3 transition-colors duration-300"
          :class="isDark ? 'text-slate-100' : 'text-slate-800'"
        >
          {{ modalState.title }}
        </h3>
        
        <!-- 内容 -->
        <div
          class="mb-5 transition-colors duration-300"
          :class="isDark ? 'text-slate-400' : 'text-slate-600'"
        >
          <!-- 文本内容 -->
          <p v-if="modalState.message">{{ modalState.message }}</p>
          
          <!-- 输入框 -->
          <input
            v-if="modalState.type === 'prompt'"
            ref="inputRef"
            v-model="inputValue"
            class="w-full px-3 py-2 border rounded-lg outline-none focus:border-indigo-400 text-sm transition-colors duration-300"
            :class="isDark 
              ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500' 
              : 'bg-white border-slate-300 text-slate-800'"
            :placeholder="modalState.placeholder"
            @keyup.enter="handleConfirm"
            @keyup.escape="handleClose"
          />
        </div>
        
        <!-- 按钮区域 -->
        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-1.5 rounded-lg text-sm transition-colors duration-300"
            :class="isDark 
              ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' 
              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'"
            @click="handleClose"
          >
            {{ modalState.cancelText }}
          </button>
          <button
            class="px-4 py-1.5 rounded-lg text-sm text-white transition-colors duration-300"
            :class="modalState.confirmDanger 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-indigo-500 hover:bg-indigo-600'"
            @click="handleConfirm"
          >
            {{ modalState.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, inject } from 'vue'
import { useModalStore } from '../stores/useModalStore'

const isDark = inject('isDark', ref(false))
const { modalState, confirmModal, cancelModal } = useModalStore()

const inputValue = ref('')
const inputRef = ref(null)

// 监听 visible 变化，自动聚焦输入框
watch(() => modalState.value.visible, (val) => {
  if (val) {
    inputValue.value = modalState.value.defaultValue || ''
    if (modalState.value.type === 'prompt') {
      nextTick(() => {
        setTimeout(() => {
          inputRef.value?.focus()
          inputRef.value?.select()
        }, 50)
      })
    }
  }
})

const handleClose = () => {
  cancelModal()
}

const handleConfirm = () => {
  if (modalState.value.type === 'prompt') {
    confirmModal(inputValue.value)
  } else {
    confirmModal(true)
  }
}
</script>