import { ref } from 'vue'

// ==================== 运行时状态（模块级单例） ====================
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

const toastState = ref({
  visible: false,
  message: '',
  type: 'info' // 'info' | 'success' | 'warning' | 'error'
})

let toastTimer = null

// ==================== Actions ====================
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

const closeModal = () => {
  if (modalState.value.resolve) modalState.value.resolve(null)
  modalState.value.visible = false
}

const confirmModal = (value) => {
  if (modalState.value.resolve) {
    modalState.value.type === 'prompt' ? modalState.value.resolve(value) : modalState.value.resolve(true)
  }
  modalState.value.visible = false
}

const cancelModal = () => {
  if (modalState.value.resolve) {
    modalState.value.type === 'prompt' ? modalState.value.resolve(null) : modalState.value.resolve(false)
  }
  modalState.value.visible = false
}

const showToast = (message, type = 'info') => {
  if (toastTimer) clearTimeout(toastTimer)
  toastState.value = { visible: true, message, type }
  toastTimer = setTimeout(() => { toastState.value.visible = false }, 3000)
}

// ==================== 单例导出 ====================
const instance = {
  modalState,
  toastState,
  confirm,
  prompt,
  closeModal,
  confirmModal,
  cancelModal,
  showToast
}

export function useModalStore() {
  return instance
}