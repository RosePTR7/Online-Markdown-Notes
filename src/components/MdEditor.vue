<template>
  <div class="h-full">
    <div ref="vditorRef" style="min-height: 400px;"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Vditor from 'vditor'

const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue', 'change'])

let vditor = null
const vditorRef = ref(null)

onMounted(async () => {
  // 等待DOM完全渲染完成
  await nextTick()
  // 节点为空直接退出
  if (!vditorRef.value) return

  // 捕获Vditor内部所有初始化报错，不会阻塞页面全局JS
  try {
    // 防止重复创建实例
    if (vditor) return
    vditor = new Vditor(vditorRef.value, {
      height: '100%',
      mode: 'ir',
      // 兜底：确保一定传入字符串，不传null/undefined
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

watch(() => props.modelValue, (val) => {
  if (vditor && val !== vditor.getValue()) {
    vditor.setValue(val ?? '')
  }
})

onUnmounted(() => {
  if (vditor) {
    vditor.destroy()
    vditor = null
  }
})
</script>