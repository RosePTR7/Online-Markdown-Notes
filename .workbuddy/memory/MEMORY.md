# 项目架构笔记：Online Markdown Notes

## 项目定位
一个基于 **Vue 3 + Vite** 的纯前端「在线 Markdown 笔记」应用。数据存在浏览器 **IndexedDB (Dexie)** 中；另支持「本地模式」用 **File System Access API** 直接读写用户磁盘文件夹。部署 base 为 `/Online-Markdown-Notes/`（GitHub Pages 风格）。

## 目录结构
- `index.html` / `vite.config.js` / `uno.config.js`：入口、Vite 配置（vue + UnoCSS 插件）、base 路径。
- `src/main.js`：加载 UnoCSS、Vditor、highlight.js（亮/暗）样式，挂载 App。
- `src/App.vue`：根组件。加载数据（loadNotes/loadFolders/loadAiConfig）、侧边栏宽度拖拽、主题（light/dark/system，localStorage 持久化 + 跟随系统）、**内容防抖自动保存（2s）**、**每笔记撤销/重做历史栈（最多50步，saveHistoryMap）**、beforeunload 强存。
- `src/stores/`：四个模块级单例（非 Pinia）：
  - `useNoteStore`：笔记列表/打开标签/激活笔记、CRUD、AI 配置、本地笔记内存占位+写盘（addLocalNoteDirectly/finalizeLocalNote）。
  - `useFolderStore`：文件夹树 CRUD、拖拽移动（moveFolder 支持 inside/before/after、防环）、展开状态本地持久化。
  - `useModalStore`：全局 confirm/prompt 模态框 + toast。
  - `useLocalModeStore`：本地模式核心（mode online/local、folderHandle、目录读写删、缓存 folderCache、renameDirectory 用复制+删除实现）。
- `src/utils/`：
  - `db.js`：Dexie 定义，notes(含 folderId 索引)、folders、aiConfig。version2 加文件夹。
  - `aiApi.js`：polishMarkdown —— 调 OpenAI 兼容 `/chat/completions` 润色。
  - `importExport.js`：导出 MD/Frontmatter-MD/HTML/JSON，导入 MD/TXT/JSON（gray-matter + marked）。
- `src/components/`：
  - `Sidebar.vue`：标题、新建笔记/文件夹、搜索（标题+内容，高亮）、模式切换开关、更改本地路径、删除确认弹窗。
  - `EditorArea.vue`：顶部工具栏（文件/编辑/查看/AI配置 菜单）、标签页（draggable 可拖拽排序、右键重命名/删其他/删所有）、保存状态、查找替换浮动窗、AI润色流程、导入导出、各类浮动输入框。
  - `MdEditor.vue`：封装 Vditor（IR 即时渲染模式，关闭缓存，theme 随 isDark 切换）。
  - `FloatingPanel.vue`：通用可拖拽浮动面板。
  - `Modal.vue`：全局模态框+toast（Teleport 到 body）。
  - `FolderTree.vue` + `FolderItem.vue`：在线模式文件夹树（递归、拖拽）。
  - `UnsortedNotes.vue`：未分类笔记区（可拖入）。
  - `LocalFolderTree.vue` + `LocalFolderItem.vue`：本地模式文件树（懒加载、递归、临时内存笔记区）。

## 关键设计点 / 坑
- 编辑器内容双向同步：App 持有 editorContent，EditorArea 通过 `update:modelValue` 与 MdEditor 的 `setContent` 同步；撤销/重做直接操作 Vditor setValue。
- 本地模式写盘是「内存占位(isTemp)→异步 writeFile→finalizeLocalNote」两阶段，避免 UI 卡顿。
- 防抖保存 2s；切换笔记/关闭页面 flushSave 强存。
- 搜索、未分类、文件夹树均排除 `isLocal`（本地笔记）标记。
- 部署产物在 `dist/`，public 放 favicon/icons svg。
