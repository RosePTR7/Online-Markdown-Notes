<template>
  <svg
    :class="rootClass"
    :viewBox="icon.viewBox"
    :fill="icon.mode === 'fill' ? 'currentColor' : 'none'"
    :stroke="icon.mode === 'stroke' ? 'currentColor' : 'none'"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <!-- 加载转圈：多元素，单独处理 -->
    <template v-if="name === 'spinner'">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </template>
    <template v-else>
      <path
        v-for="(p, i) in icon.paths"
        :key="i"
        :d="p.d"
        :fill-rule="p.fillRule"
        :clip-rule="p.clipRule"
        :stroke-linecap="icon.mode === 'stroke' ? 'round' : undefined"
        :stroke-linejoin="icon.mode === 'stroke' ? 'round' : undefined"
        :stroke-width="icon.mode === 'stroke' ? 2 : undefined"
      />
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

// 图标只接收名字 + 外部 class（尺寸/颜色由调用方用 unocss class 控制）
const props = defineProps({
  name: { type: String, required: true },
  // 便捷开关：加载动画用，等价于外部传 class="animate-spin"
  spin: { type: Boolean, default: false }
})

// 图标登记表：集中存放项目真实用到的全部 SVG，
// 彻底消除各组件里复制粘贴的 path 数据。
// 24x24 = Heroicons outline（描边）；20x20 = Heroicons solid（填充）
const ICONS = {
  // —— 24x24 描边风格 ——
  rename: {
    viewBox: '0 0 24 24', mode: 'stroke',
    paths: [{ d: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' }]
  },
  'add-folder': {
    viewBox: '0 0 24 24', mode: 'stroke',
    paths: [{ d: 'M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z' }]
  },
  'add-note': {
    viewBox: '0 0 24 24', mode: 'stroke',
    paths: [{ d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }]
  },
  delete: {
    viewBox: '0 0 24 24', mode: 'stroke',
    paths: [{ d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' }]
  },
  'move-unsorted': {
    viewBox: '0 0 24 24', mode: 'stroke',
    paths: [{ d: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' }]
  },
  refresh: {
    viewBox: '0 0 24 24', mode: 'stroke',
    paths: [{ d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' }]
  },
  // 导入：文件拖入箭头（向上进入托盘）
  import: {
    viewBox: '0 0 24 24', mode: 'stroke',
    paths: [{ d: 'M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2' }]
  },
  // —— 20x20 填充风格 ——
  doc: {
    viewBox: '0 0 20 20', mode: 'fill',
    paths: [{ d: 'M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z', fillRule: 'evenodd', clipRule: 'evenodd' }]
  },
  folder: {
    viewBox: '0 0 20 20', mode: 'fill',
    paths: [{ d: 'M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z' }]
  }
}

// 找不到名字时回退到 doc，避免渲染空 svg
const icon = computed(() => {
  if (props.name === 'spinner') return { viewBox: '0 0 24 24', mode: 'stroke' }
  return ICONS[props.name] || ICONS.doc
})

const rootClass = computed(() => (props.spin ? 'animate-spin' : ''))
</script>
