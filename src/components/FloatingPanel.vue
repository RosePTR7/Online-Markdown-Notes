<template>
  <div
    v-if="visible"
    class="fixed z-50 bg-white border border-slate-300 rounded-lg shadow-lg"
    :class="panelClass"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
  >
    <!-- 拖拽手柄 -->
    <div
      class="flex items-center justify-between px-4 py-2 cursor-move bg-slate-50 rounded-t-lg border-b border-slate-200"
      @mousedown="startDrag"
    >
      <span class="text-sm font-medium text-slate-700">{{ title }}</span>
      <button class="px-2 py-0.5 text-slate-400 hover:text-slate-600 text-lg leading-none" @click="close" title="关闭">✕</button>
    </div>
    <!-- 内容区域 -->
    <div class="px-4 py-3">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  panelClass: {
    type: String,
    default: 'min-w-[400px]'
  },
  defaultPosition: {
    type: Object,
    default: () => ({ x: 100, y: 80 })
  }
})

const emit = defineEmits(['close', 'update:visible'])

const position = ref({ ...props.defaultPosition })
let isDragging = false
let dragOffset = { x: 0, y: 0 }

const startDrag = (e) => {
  isDragging = true
  dragOffset.x = e.clientX - position.value.x
  dragOffset.y = e.clientY - position.value.y
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

const handleDrag = (e) => {
  if (!isDragging) return
  position.value.x = e.clientX - dragOffset.x
  position.value.y = e.clientY - dragOffset.y
}

const stopDrag = () => {
  isDragging = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const close = () => {
  emit('close')
  emit('update:visible', false)
}

// 组件卸载时清理事件
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
})

// 暴露重置位置方法
const resetPosition = () => {
  position.value = { ...props.defaultPosition }
}

defineExpose({ resetPosition })
</script>