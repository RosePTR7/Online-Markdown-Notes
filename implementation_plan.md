# Implementation Plan

## Overview
为在线Markdown笔记应用添加多层嵌套文件夹功能，支持拖拽归类、展开/折叠、右键菜单操作，以及未分类区域。

## Types

### 新增数据结构

```javascript
// 文件夹数据结构
{
  id: string,           // nanoid 生成的唯一ID
  name: string,         // 文件夹名称
  parentId: string | null,  // 父文件夹ID，null表示顶级文件夹
  isExpanded: boolean,  // 是否展开状态
  order: number,        // 排序序号
  createTime: number,   // 创建时间戳
  updateTime: number    // 更新时间戳
}

// 笔记数据结构（新增字段）
{
  id: string,
  title: string,
  content: string,
  folderId: string | null,  // 所属文件夹ID，null表示未分类
  createTime: number,
  updateTime: number
}
```

### 状态类型

```javascript
// 拖拽状态
{
  isDragging: boolean,
  dragItem: { type: 'note' | 'folder', id: string } | null,
  dragOverId: string | null,
  dragOverPosition: 'before' | 'inside' | 'after' | null
}

// 右键菜单状态
{
  menuVisible: boolean,
  menuX: number,
  menuY: number,
  targetType: 'folder' | 'note',
  targetId: string
}
```

## Files

### 新增文件

1. **src/stores/useFolderStore.js**
   - 文件夹状态管理
   - 文件夹的增删改查操作
   - 文件夹展开/折叠状态管理
   - 拖拽状态管理

2. **src/components/FolderTree.vue**
   - 文件夹树形组件
   - 递归渲染文件夹层级
   - 支持展开/折叠
   - 支持拖拽放置

3. **src/components/FolderItem.vue**
   - 单个文件夹项组件
   - 文件夹图标、名称、展开箭头
   - 右键菜单触发
   - 拖拽交互

4. **src/components/UnsortedNotes.vue**
   - 未分类笔记区域组件
   - 显示 folderId 为 null 的笔记

### 修改文件

1. **src/utils/db.js**
   - 新增 folders 表
   - 升级数据库版本
   - notes 表新增 folderId 索引

2. **src/stores/useNoteStore.js**
   - 笔记新增 folderId 字段
   - 新增 moveNoteToFolder 方法
   - 修改 addNote 方法支持指定文件夹

3. **src/components/Sidebar.vue**
   - 重构为文件夹树 + 未分类笔记的组合布局
   - 集成拖拽功能
   - 集成文件夹和笔记的右键菜单

4. **src/App.vue**
   - 初始化时加载文件夹数据
   - 提供拖拽相关的全局状态

## Functions

### 新增函数

**useFolderStore.js:**
- `loadFolders()` - 从数据库加载所有文件夹
- `addFolder(parentId, name)` - 创建新文件夹
- `deleteFolder(id)` - 删除文件夹（级联删除子文件夹和笔记）
- `updateFolder(id, payload)` - 更新文件夹信息
- `toggleFolder(id)` - 切换文件夹展开/折叠
- `moveFolder(id, targetParentId, position)` - 移动文件夹
- `moveNoteToFolder(noteId, folderId)` - 移动笔记到文件夹

**FolderTree.vue:**
- `renderTree(folderId)` - 递归渲染文件夹树
- `handleDragStart(item, type)` - 拖拽开始
- `handleDragOver(item, position)` - 拖拽经过
- `handleDrop(target, position)` - 拖拽释放

**FolderItem.vue:**
- `handleContextMenu(e)` - 右键菜单
- `handleToggle()` - 展开/折叠
- `handleDragStart()` - 开始拖拽文件夹

**UnsortedNotes.vue:**
- `handleDrop()` - 拖拽笔记到未分类区域

### 修改函数

**useNoteStore.js:**
- `addNote()` - 增加 folderId 参数
- `updateNote()` - 支持更新 folderId
- `delNote()` - 无需修改，但删除时保持 folderId 逻辑

## Classes

### 无需新增类
项目使用 Vue Composition API + Pinia 风格的状态管理，不涉及类定义。

## Dependencies

### 新增依赖
无需新增外部依赖，使用现有的：
- Vue 3 (Composition API)
- Dexie.js (IndexedDB)
- nanoid (ID生成)
- UnoCSS (样式)

### 数据库升级
```javascript
db.version(2).stores({
  notes: 'id, folderId',  // 新增 folderId 索引
  folders: 'id, parentId, order',  // 新增 folders 表
  aiConfig: 'id'
})
```

## Testing

### 测试场景

1. **文件夹基础操作**
   - 创建顶级文件夹
   - 创建子文件夹
   - 重命名文件夹
   - 删除文件夹（含子文件夹和笔记）

2. **笔记归类**
   - 拖拽笔记到文件夹
   - 拖拽笔记到未分类区域
   - 右键菜单移动笔记

3. **文件夹层级**
   - 多层嵌套创建
   - 展开/折叠状态持久化
   - 拖拽文件夹移动层级

4. **数据持久化**
   - 刷新后文件夹数据保留
   - 刷新后展开状态保留
   - 刷新后笔记归属保留

### 测试文件
- src/stores/__tests__/useFolderStore.spec.js
- src/components/__tests__/FolderTree.spec.js

## Implementation Order

1. **数据库升级**
   - 修改 db.js，新增 folders 表
   - notes 表添加 folderId 索引

2. **文件夹 Store**
   - 创建 useFolderStore.js
   - 实现文件夹的 CRUD 操作
   - 实现展开/折叠状态管理

3. **笔记 Store 更新**
   - 修改 useNoteStore.js
   - 笔记数据添加 folderId 字段
   - 实现 moveNoteToFolder 方法

4. **文件夹树组件**
   - 创建 FolderItem.vue（单个文件夹）
   - 创建 FolderTree.vue（文件夹树）
   - 实现递归渲染

5. **未分类区域**
   - 创建 UnsortedNotes.vue
   - 显示未归类笔记

6. **拖拽功能**
   - 在 FolderTree.vue 实现拖拽逻辑
   - 支持笔记拖拽到文件夹
   - 支持文件夹拖拽排序/移动

7. **右键菜单**
   - 文件夹右键菜单（新建子文件夹、重命名、删除）
   - 笔记右键菜单增加"移动到"选项

8. **侧边栏整合**
   - 修改 Sidebar.vue 整合所有组件
   - 调整布局结构

9. **数据迁移**
   - 处理现有笔记的 folderId 默认值
   - 确保向后兼容