const NOTE_KEY = 'vue-online-note-list'
const AI_CONFIG_KEY = 'vue-note-ai-config'
// 笔记CRUD本地存储
export const noteStorage = {
  getAll() {
    const data = localStorage.getItem(NOTE_KEY)
    return data ? JSON.parse(data) : []
  },
  save(list) {
    localStorage.setItem(NOTE_KEY, JSON.stringify(list))
  }
}
// AI配置存储
export const aiConfigStorage = {
  get() {
    const cfg = localStorage.getItem(AI_CONFIG_KEY)
    return cfg ? JSON.parse(cfg) : { aiBaseUrl: '', apiKey: '' }
  },
  save(obj) {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(obj))
  }
}