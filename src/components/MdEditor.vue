<template>
  <div class="h-full flex flex-col overflow-hidden md-editor-wrapper" :class="{ 'is-dark': isDark }">
    <div ref="vditorRef" class="flex-1 overflow-hidden"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick, inject } from 'vue'
import Vditor from 'vditor'
import { fileToMarkdown } from '../utils/imageEmbed'

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
      // 图片插入：粘贴 / 拖入 / 点工具栏「上传」均走此 handler。
      // 注意 Vditor 的 handler 返回值只用作「错误提示」（字符串会被当 tip 显示），
      // 内容必须由 handler 自行 insertValue 插入，再主动 emit 触发上层自动保存。
      upload: {
        accept: 'image/*',
        multiple: true, // 必须显式开启，否则 uploadFiles 只传 1 个文件给 handler
        handler: async (files) => {
          const images = Array.from(files).filter(f => f.type.startsWith('image/'))
          if (images.length === 0) {
            return '仅支持插入图片文件（已忽略非图片内容）'
          }
          try {
            const parts = await Promise.all(images.map(f => fileToMarkdown(f)))
            vditor.insertValue(parts.join('\n') + '\n')
            // insertValue 不一定触发 input 回调，主动同步到上层确保自动保存捕获
            emit('update:modelValue', vditor.getValue())
          } catch (err) {
            console.error('图片插入失败:', err)
            return '图片插入失败：' + (err?.message || err)
          }
          return null
        }
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