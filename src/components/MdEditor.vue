<template>
  <div class="h-full">
    <div ref="vditorRef"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import Vditor from 'vditor'

const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue', 'change'])

let vditor = null
const vditorRef = ref(null)

onMounted(() => {
  vditor = new Vditor(vditorRef.value, {
    height: '100%',
    mode: 'ir',
    value: props.modelValue,
    input: (val) => {
      emit('update:modelValue', val)
      emit('change', val)
    }
  })
})

watch(() => props.modelValue, (val) => {
  if (vditor && val !== vditor.getValue()) {
    vditor.setValue(val)
  }
})
</script>