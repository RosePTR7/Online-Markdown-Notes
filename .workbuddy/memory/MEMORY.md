# 项目架构笔记：Online Markdown Notes

## 项目定位
一个基于 **Vue 3 + Vite** 的纯前端「在线 Markdown 笔记」应用。数据存在浏览器 **IndexedDB (Dexie)** 中；另支持「本地模式」用 **File System Access API** 直接读写用户磁盘文件夹。部署 base 为 `/Online-Markdown-Notes/`（GitHub Pages 风格）。

## 目录结构
- `index.html` / `vite.config.js` / `uno.config.js`：入口、Vite 配置（vue + UnoCSS 插件）、base 路径。
- `src/main.js`：加载 UnoCSS、Vditor、highlight.js（亮/暗）样式，挂载 App。
- `src/App.vue`：根组件。加载数据（loadNotes/loadFolders/loadAiConfig）、侧边栏宽度拖拽、主题（light/dark/system，localStorage 持久化 + 跟随系统）、**按 noteId 隔离的内容后台防抖自动保存（2s，useSaveManager，切换笔记不打断旧笔记计时器、旧笔记后台继续落盘）**、**每笔记撤销/重做历史栈（最多50步，saveHistoryMap）**、beforeunload/onBeforeUnmount flushAll 落盘全部脏笔记。
- `src/stores/`：四个模块级单例（非 Pinia）：
  - `useNoteStore`：笔记列表/打开标签/激活笔记、CRUD、AI 配置、本地笔记内存占位+写盘（addLocalNoteDirectly/finalizeLocalNote）。
  - `useFolderStore`：文件夹树 CRUD、拖拽移动（moveFolder 支持 inside/before/after、防环）、展开状态本地持久化。
  - `useModalStore`：全局 confirm/prompt 模态框 + toast。
  - `useLocalModeStore`：本地模式核心（mode online/local、folderHandle、目录读写删、缓存 folderCache、renameDirectory 用复制+删除实现）。
  - `useSaveManager`：保存调度器（非 Pinia 单例）。`Map<noteId,{content,timer,saving}>`；`scheduleSave/flushNote/flushAll/removePending`；`initSaveManager({persist, afterSave})` 注入落盘与落盘后回调。每笔记独立防抖计时 + `saving` 单飞。
- `src/utils/`：
  - `db.js`：Dexie 定义，notes(含 folderId 索引)、folders、aiConfig。**version3 加 `deletedAt` 软删除索引**（0/undefined=未删，>0=删除时间戳，回收站用）。
  - `aiApi.js`：polishMarkdown —— 调 OpenAI 兼容 `/chat/completions` 润色。
  - `importExport.js`：导出 MD/Frontmatter-MD/HTML/JSON，导入 MD/TXT/JSON（gray-matter + marked）；`exportAllAsZip` 整库 ZIP（仅在线+未软删，按文件夹层级 + backup.json）；`downloadBlob`。
  - `zip.js`：无依赖极简 ZIP 写入器（STORE 法、UTF-8 文件名、CRC32）。
- `src/components/`：
  - `Sidebar.vue`：标题、新建笔记/文件夹、**回收站按钮**、搜索（标题+内容，高亮）、模式切换开关、更改本地路径、删除确认弹窗。
  - `RecycleBin.vue`：回收站覆盖层（Teleport，复用 Modal 卡片风格），列出已软删的笔记/文件夹，支持逐个恢复/彻底删除 + 清空回收站（彻底删除/清空走 confirmDanger 二次确认）。
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
- **保存机制（useSaveManager）**：编辑触发 `scheduleSave(noteId, content)` → 按 noteId 独立防抖 2s 后 `persistNote`。`persistNote`：本地笔记重建 frontmatter 走 `writeFile` 落盘（**本地编辑内容必须显式落盘，否则只存内存**）；在线走 `updateNote`。切换笔记**不 flush** 旧笔记，旧笔记计时器后台继续；`closeTab`/`beforeunload`/`onBeforeUnmount` 才 flush。**`updateNoteContent`/`updateNote`/`persistNote` 必须原地改属性，绝不能 `noteList.value[idx]={...}` 替换元素**——否则 `currentNote` 计算属性引用变化，每键触发「切换笔记」watch（重置 originContent/isUnsaved、关闭查找面板）。
- **MdEditor 同步坑**：`watch(modelValue)` 只保留 `val===currentVal` 防回环，**不要加 `isBusy` 提前 return**——否则切到站 B 时若 80ms 内刚在 A 敲过字，对 B 的 setValue 会被丢弃，编辑器仍显示 A 内容（显示串味）。
- 搜索、未分类、文件夹树均排除 `isLocal`（本地笔记）标记。
- **回收站（软删除）**：仅针对「在线」笔记/文件夹（IndexedDB）。`delNote`/`deleteFolder` 置 `deletedAt` 并移出内存列表，**不真删**；`loadNotes`/`loadFolders` 启动时过滤 `deletedAt`，回收站内容重启后不回列表。`useNoteStore` 的 `restoreNote`/`purgeNote`/`emptyRecycleBin` + `useFolderStore` 的 `restoreFolder`(级联)/`purgeFolder`/`emptyRecycleBinFolders` 提供恢复与彻底删除。**本地笔记/文件夹删除保持永久**（走 `removeLocalNote`/`deleteLocalFolder`，不碰回收站）。`useFolderStore` 反向 import `useNoteStore`（无循环：useNoteStore 不 import useFolderStore）。
- 部署产物在 `dist/`，public 放 favicon/icons svg。
