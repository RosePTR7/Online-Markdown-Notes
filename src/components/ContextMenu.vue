<template>
  <Teleport to="body">
    <!-- 遮罩：点击任意处关闭 -->
    <div
      v-if="visible"
      class="fixed inset-0 z-[100]"
      @click="close"
      @contextmenu.prevent="close"
    >
      <!-- 菜单本体：按坐标定位 -->
      <div
        class="fixed z-[101] shadow-lg border rounded-xl py-1 transition-colors duration-300"
        :class="[menuClass, isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200']"
        :style="{ left: x + 'px', top: y + 'px' }"
      >
        <slot></slot>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { inject, ref } from 'vue'

const isDark = inject('isDark', ref(false))

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  x: {
    type: Number,
    default: 0
  },
  y: {
    type: Number,
    default: 0
  },
  menuClass: {
    type: String,
    default: 'w-40'
  }
})

const emit = defineEmits(['close'])

const close = () => emit('close')
</script>
