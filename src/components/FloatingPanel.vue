<template>
  <div
    v-if="visible"
    ref="panelEl"
    class="fixed z-50 rounded-lg shadow-lg transition-colors duration-300"
    :class="[panelClass, isDark ? 'bg-slate-800 border border-slate-600' : 'bg-white border border-slate-300']"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
  >
    <!-- 拖拽手柄 -->
    <div
      class="flex items-center justify-between px-4 py-2 cursor-move rounded-t-lg border-b transition-colors duration-300"
      :class="isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'"
      @mousedown="startDrag"
    >
      <span class="text-sm font-medium transition-colors duration-300" :class="isDark ? 'text-slate-200' : 'text-slate-700'">{{ title }}</span>
      <button class="px-2 py-0.5 text-lg leading-none transition-colors duration-300" :class="isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'" @click="close" title="关闭">✕</button>
    </div>
    <!-- 内容区域 -->
    <div class="px-4 py-3 overflow-hidden">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount, inject } from 'vue'

const isDark = inject('isDark', ref(false))

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
const panelEl = ref(null)
let isDragging = false
let dragOffset = { x: 0, y: 0 }

// 将面板钳制在视口内，避免超出右/下边界导致显示不全（例如被拖到右侧后再次打开）。
const clampToViewport = () => {
  const el = panelEl.value
  if (!el) return
  const margin = 8
  const pw = el.offsetWidth || 0
  const ph = el.offsetHeight || 0
  const maxX = Math.max(margin, window.innerWidth - pw - margin)
  const maxY = Math.max(margin, window.innerHeight - ph - margin)
  position.value.x = Math.min(Math.max(position.value.x, margin), maxX)
  position.value.y = Math.min(Math.max(position.value.y, margin), maxY)
}

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
  clampToViewport()
}

const stopDrag = () => {
  isDragging = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 面板显示时，重新锚定到传入的 defaultPosition（如 AI 配置按按钮坐标定位），
// 等 DOM 挂载后测量并钳制在视口内，避免溢出右/下边界。
watch(() => props.visible, async (v) => {
  if (v) {
    position.value = { ...props.defaultPosition }
    await nextTick()
    clampToViewport()
  }
})

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
  clampToViewport()
}

defineExpose({ resetPosition })
</script>