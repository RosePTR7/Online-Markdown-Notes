import { ref } from 'vue'

// 模态框状态
const modalState = ref({
  visible: false,
  type: 'confirm', // 'confirm' | 'prompt'
  title: '',
  message: '',
  placeholder: '',
  defaultValue: '',
  confirmText: '确定',
  cancelText: '取消',
  confirmDanger: false,
  resolve: null
})

export function useModalStore() {
  // 显示确认框
  const confirm = (options) => {
    return new Promise((resolve) => {
      modalState.value = {
        visible: true,
        type: 'confirm',
        title: options.title || '确认',
        message: options.message || '',
        placeholder: '',
        defaultValue: '',
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消',
        confirmDanger: options.confirmDanger || false,
        resolve
      }
    })
  }

  // 显示输入框
  const prompt = (options) => {
    return new Promise((resolve) => {
      modalState.value = {
        visible: true,
        type: 'prompt',
        title: options.title || '输入',
        message: options.message || '',
        placeholder: options.placeholder || '',
        defaultValue: options.defaultValue || '',
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消',
        confirmDanger: false,
        resolve
      }
    })
  }

  // 关闭模态框
  const closeModal = () => {
    if (modalState.value.resolve) {
      modalState.value.resolve(null)
    }
    modalState.value.visible = false
  }

  // 确认
  const confirmModal = (value) => {
    if (modalState.value.resolve) {
      if (modalState.value.type === 'prompt') {
        modalState.value.resolve(value)
      } else {
        modalState.value.resolve(true)
      }
    }
    modalState.value.visible = false
  }

  // 取消
  const cancelModal = () => {
    if (modalState.value.resolve) {
      if (modalState.value.type === 'prompt') {
        modalState.value.resolve(null)
      } else {
        modalState.value.resolve(false)
      }
    }
    modalState.value.visible = false
  }

  return {
    modalState,
    confirm,
    prompt,
    closeModal,
    confirmModal,
    cancelModal
  }
}