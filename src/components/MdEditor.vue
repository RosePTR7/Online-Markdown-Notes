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
let isBusy = false

onMounted(async () => {
  await nextTick()
  if (!vditorRef.value || vditor) return

  try {
    vditor = new Vditor(vditorRef.value, {
      height: '100%',
      mode: 'ir',
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