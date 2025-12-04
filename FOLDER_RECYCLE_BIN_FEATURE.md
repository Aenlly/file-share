# 文件夹回收站功能

## 功能概述

实现了完整的文件夹回收站功能，支持文件和文件夹的统一回收和还原。

## 主要特性

### 1. 文件夹删除
- 删除文件夹时，文件夹及其所有文件都会移至回收站
- 使用 `batchId` 将文件夹和文件关联在一起
- 保留文件夹的原始信息（alias, path, owner等）

### 2. 回收站显示
- 回收站中显示文件夹（而不是单个文件）
- 文件夹显示包含的文件数量
- 区分文件和文件夹类型（使用 Tag 标签）
- 文件夹内的文件不单独显示在列表中

### 3. 智能还原

#### 文件还原
- 检查目标文件夹是否存在
- 如果文件夹不存在，提示错误
- 如果文件夹存在，恢复文件到原位置

#### 文件夹还原
- **情况1：原文件夹不存在**
  - 重新创建文件夹（使用原始的 alias 和 path）
  - 将所有文件恢复到新文件夹中
  
- **情况2：原文件夹已存在**
  - 不重新创建文件夹
  - 只恢复文件内容到现有文件夹
  - 跳过已存在的文件（通过 savedName 判断）

## 数据结构

### RecycleBin 表结构扩展

```javascript
{
  id: number,
  itemType: 'file' | 'folder',  // 新增：项目类型
  
  // 文件夹特有字段
  batchId: string,               // 新增：批次ID，关联文件夹和文件
  folderAlias: string,           // 新增：文件夹名称
  folderPath: string,            // 新增：文件夹路径
  fileCount: number,             // 新增：包含的文件数量
  originalFolderId: number,      // 新增：原文件夹ID
  
  // 文件特有字段
  parentRecycleId: number,       // 新增：父文件夹回收记录ID
  originalFileId: number,        // 原文件ID
  originalName: string,          // 文件名
  savedName: string,             // 保存的文件名
  size: number,                  // 文件大小
  mimeType: string,              // MIME类型
  folderId: number,              // 所属文件夹ID
  owner: string,                 // 所有者
  hash: string,                  // 文件哈希
  
  // 公共字段
  deletedAt: string,             // 删除时间
}
```

## API 接口

### 1. 获取回收站列表
```
GET /api/folders/trash
```

返回顶层项目（文件夹或独立文件），不包括文件夹内的文件。

### 2. 还原项目
```
POST /api/folders/trash/restore/:itemId
```

自动识别项目类型（文件或文件夹）并执行相应的还原逻辑。

### 3. 永久删除
```
DELETE /api/folders/trash/:itemId
```

永久删除文件或文件夹（包括其中的所有文件）。

### 4. 清空回收站
```
DELETE /api/folders/trash/clear
```

清空用户的所有回收站项目。

## 实现细节

### 后端模型 (RecycleBinModel)

#### moveFolderToRecycleBin(folderRecord, files)
- 创建文件夹回收记录
- 为所有文件创建回收记录并关联到文件夹
- 使用 `batchId` 和 `parentRecycleId` 建立关联

#### findByOwner(owner, itemType)
- 只返回顶层项目（文件夹或独立文件）
- 过滤掉文件夹内的文件（通过 parentRecycleId 判断）

#### restoreFolder(recycleBinId)
- 获取文件夹信息和所有关联文件
- 检查原文件夹是否存在
- 根据情况创建文件夹或只恢复文件
- 清理回收站记录

### 前端显示 (RecycleBin.jsx)

- 添加"类型"列，显示文件/文件夹标签
- 文件夹显示 📁 图标和文件数量
- 文件夹不显示大小信息

## 使用流程

### 删除文件夹
1. 用户在文件夹管理页面点击删除
2. 系统将文件夹和所有文件移至回收站
3. 显示提示："文件夹已移至回收站（包含 N 个文件）"

### 还原文件夹
1. 用户在回收站中点击还原文件夹
2. 系统检查原文件夹是否存在
3. 如果不存在，创建新文件夹并恢复所有文件
4. 如果存在，只恢复文件内容到现有文件夹

### 还原单个文件
1. 用户在回收站中点击还原文件
2. 系统检查目标文件夹是否存在
3. 如果不存在，提示错误
4. 如果存在，恢复文件到原位置

## 注意事项

1. **文件夹ID变化**：如果原文件夹被删除后又重新创建，新文件夹的ID会不同
2. **文件去重**：还原时会检查文件是否已存在（通过 savedName）
3. **权限检查**：还原时会检查用户是否有权限访问目标文件夹
4. **过期清理**：回收站中的项目30天后自动删除

## 测试建议

1. 测试删除空文件夹
2. 测试删除包含文件的文件夹
3. 测试还原到不存在的文件夹
4. 测试还原到已存在的文件夹
5. 测试文件名冲突的情况
6. 测试权限检查
7. 测试清空回收站功能
