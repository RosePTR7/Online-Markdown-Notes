<template>
  <div class="h-full flex flex-col overflow-hidden md-editor-wrapper" :class="{ 'is-dark': isDark }">
    <div ref="vditorRef" class="flex-1 overflow-hidden"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick, inject } from 'vue'
import Vditor from 'vditor'

const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue', 'change'])

// 注入主题
const isDark = inject('isDark', ref(false))

let vditor = null
const vditorRef = ref(null)
let isBusy = false

onMounted(async () => {
  await nextTick()
  if (!vditorRef.value || vditor) return

  try {
    vditor = new Vditor(vditorRef.value, {
      height: '100%',
      mode: 'ir',
      theme: isDark.value ? 'dark' : 'classic',
      value: props.modelValue ?? '',
      cache: {
        id: "note-editor"
      },
      input: (val) => {
        emit('update:modelValue', val)
      }
    })
  } catch (err) {
    console.error('Vditor初始化失败详细错误:', err)
  }
})

// 监听主题变化，切换 Vditor 主题
watch(isDark, (newVal) => {
  if (vditor) {
    vditor.setTheme(newVal ? 'dark' : 'classic')
  }
})

watch(() => props.modelValue, (val) => {
  if (!vditor || isBusy) return
  const currentVal = vditor.getValue()
  if (val === currentVal) return

  isBusy = true
  vditor.setValue(val ?? '')
  setTimeout(() => {
    isBusy = false
  }, 80)
})

defineExpose({
  getVditor: () => vditor
})

onUnmounted(() => {
  if (vditor) {
    vditor.destroy()
    vditor = null
  }
})
</script>