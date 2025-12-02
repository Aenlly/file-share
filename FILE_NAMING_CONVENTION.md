# 文件命名约定 - 关键设计决策

## 核心原则

**`savedName` 是文件的唯一标识符，用于所有操作。`originalName` 仅用于展示。**

## 文件名的两种表示方式

### 1. `savedName` - 唯一标识符
- **定义**：服务器保存文件时生成的唯一名称
- **格式**：`originalName_timestamp.ext`（例如：`test_1234567890.txt`）
- **特点**：
  - 全局唯一
  - 不会重复
  - 包含时间戳
- **用途**：
  - ✅ 物理文件操作（读、写、删除）
  - ✅ 数据库查询
  - ✅ API调用（移动、删除、下载等）
  - ✅ 文件系统操作

### 2. `originalName` - 展示名称
- **定义**：用户上传时的原始文件名
- **格式**：用户输入的文件名（例如：`test.txt`）
- **特点**：
  - 可能重复
  - 用户可读
  - 可能包含特殊字符
- **用途**：
  - ✅ 前端UI展示
  - ✅ 下载时的文件名
  - ✅ 用户交互提示
  - ❌ 不能用于唯一标识

## 为什么这样设计？

### 问题场景
如果使用 `originalName` 作为唯一标识符：
1. 用户上传两个同名文件（`test.txt`）
2. 系统无法区分这两个文件
3. 移动、删除等操作会出现歧义

### 解决方案
使用 `savedName` 作为唯一标识符：
1. 每个文件都有唯一的 `savedName`
2. 即使 `originalName` 相同，也能正确识别
3. 所有操作都基于 `savedName` 进行

## API调用规范

### ✅ 正确的做法

#### 移动文件
```javascript
// 前端
moveFileMutation.mutate({
  filename: selectedFile.savedName,  // ✅ 使用 savedName
  targetFolderId: targetFolder
})

// 后端
const fileRecord = await FileModel.findBySavedName(filename, folderId);
```

#### 删除文件
```javascript
// 前端
deleteFile(folderId, file.savedName)  // ✅ 使用 savedName

// 后端
const fileRecord = await FileModel.findBySavedName(filename, folderId);
```

#### 下载文件
```javascript
// 前端
window.location.href = `/api/folders/${folderId}/download/${encodeURIComponent(file.savedName)}`

// 后端
const fileRecord = await FileModel.findBySavedName(filename, folderId);
```

### ❌ 错误的做法

```javascript
// ❌ 不要使用 originalName 作为唯一标识符
moveFileMutation.mutate({
  filename: selectedFile.originalName,  // ❌ 错误！
  targetFolderId: targetFolder
})

// ❌ 不要使用 originalName 查询
const fileRecord = await FileModel.findByOriginalName(filename, folderId);
```

## 文件操作检查清单

在实现任何文件操作时，检查以下项目：

- [ ] 使用 `savedName` 作为唯一标识符
- [ ] 使用 `findBySavedName()` 查询文件
- [ ] 物理文件操作使用 `savedName`
- [ ] 数据库操作使用 `savedName`
- [ ] 仅在UI展示时使用 `originalName`
- [ ] 下载时使用 `originalName` 作为文件名，但查询使用 `savedName`

## 已修复的操作

| 操作 | 文件 | 修改 | 状态 |
|------|------|------|------|
| 移动文件 | `backend/src/routes/folderRoutes.js` | 改用 `findBySavedName` | ✅ 完成 |
| 删除文件 | `backend/src/routes/folderRoutes.js` | 已使用 `findBySavedName` | ✅ 正确 |
| 下载文件 | `backend/src/routes/folderRoutes.js` | 已使用 `findBySavedName` | ✅ 正确 |

## 需要检查的操作

以下操作需要验证是否正确使用了 `savedName`：

- [ ] 文件预览
- [ ] 文件分享
- [ ] 文件搜索
- [ ] 文件排序
- [ ] 其他文件操作

## 数据库字段说明

### files 表
```
id              - 文件记录ID（主键）
folderId        - 所属文件夹ID
originalName    - 原始文件名（用于展示）
savedName       - 保存的文件名（唯一标识符）✅ 使用这个
size            - 文件大小
mimeType        - 文件类型
owner           - 文件所有者
uploadTime      - 上传时间
```

## 总结

**记住这个原则：**

```
savedName = 唯一标识符（用于所有操作）
originalName = 展示名称（仅用于UI）
```

**在实现任何文件操作时，始终使用 `savedName`！**
