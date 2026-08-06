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
        enable: false // 关闭 Vditor 本地缓存，避免每次输入写 localStorage 的开销
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
  if (!vditor) return
  const currentVal = vditor.getValue()
  if (val === currentVal) return
  // 直接同步到编辑器。去掉原来的 isBusy 提前 return：否则切到 B 时若 80ms 内刚在 A 敲过字，
  // 对 B 的 setValue 会被丢弃，导致编辑器仍显示 A 的内容（表现为「切换串味」）。
  // 回环防护由上方 val === currentVal 承担：setValue 触发的 input 回写的值与当前值相等即不再处理。
  vditor.setValue(val ?? '')
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