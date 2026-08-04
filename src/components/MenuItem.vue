<template>
  <div
    ref="rootEl"
    class="cursor-pointer text-sm rounded-lg mx-1 transition-colors duration-300 flex items-center gap-2 relative"
    :class="[
      padding,
      danger
        ? (isDark ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-500')
        : (active
            ? (isDark ? 'bg-slate-600 text-slate-200' : 'bg-slate-100 text-slate-700')
            : (isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-slate-100 text-slate-700'))
    ]"
    @click="onClick"
  >
    <Icon v-if="icon" :name="icon" class="w-4 h-4 shrink-0" />
    <slot>{{ label }}</slot>
  </div>
</template>

<script setup>
import { inject, ref } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  icon: { type: String, default: '' },
  label: { type: String, default: '' },
  danger: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  // 子菜单触发项需阻止冒泡，避免点击后顶层菜单被关闭
  stopPropagation: { type: Boolean, default: false },
  padding: { type: String, default: 'px-3 py-2' }
})

const emit = defineEmits(['click'])
const isDark = inject('isDark', ref(false))

// 暴露根元素，便于父组件（如导出子菜单定位）取 getBoundingClientRect
const rootEl = ref(null)
defineExpose({
  rootEl,
  getBoundingClientRect: () => rootEl.value?.getBoundingClientRect()
})

const onClick = (e) => {
  if (props.stopPropagation) e.stopPropagation()
  emit('click')
}
</script>
