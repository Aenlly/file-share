# savedName 约定应用完成

## 核心原则
**`savedName` 是文件的唯一标识符，用于所有操作。`originalName` 仅用于展示。**

## 修改清单

### 1. 文件移动操作 ✅
**文件**：`backend/src/routes/folderRoutes.js`

```javascript
// 修改前
const fileRecord = await FileModel.findByOriginalName(filename, folderId);

// 修改后
const fileRecord = await FileModel.findBySavedName(filename, folderId);
```

### 2. 文件删除操作 ✅
**文件**：`backend/src/models/FileModel.js` 和 `backend/src/routes/folderRoutes.js`

**修改1**：`FileModel.batchDelete` 返回结构
```javascript
// 修改前
deletedFiles.push(file.originalName);

// 修改后
deletedFiles.push({
    originalName: file.originalName,
    savedName: file.savedName
});
```

**修改2**：`folderRoutes.js` 中的物理文件删除
```javascript
// 修改前
for (const file of result.deletedFiles) {
    const fileRecord = await FileModel.findByOriginalName(file, folderId);
    if (fileRecord) {
        const filePath = path.join(dirPath, fileRecord.savedName);
        // ...
    }
}

// 修改后
for (const file of result.deletedFiles) {
    const filePath = path.join(dirPath, file.savedName);
    // ...
}
```

### 3. 文件下载操作 ✅
**文件**：`backend/src/routes/folderRoutes.js`

```javascript
// 修改前
const fileRecord = await FileModel.findByOriginalName(filename, folderId);
// ...
res.download(filePath, filename);

// 修改后
const fileRecord = await FileModel.findBySavedName(filename, folderId);
// ...
res.download(filePath, fileRecord.originalName);
```

## 文件操作规范总结

| 操作 | 查询方式 | 物理操作 | 返回给用户 |
|------|---------|---------|----------|
| 移动 | `findBySavedName` | 使用 `savedName` | `originalName` |
| 删除 | `findBySavedName` | 使用 `savedName` | `originalName` |
| 下载 | `findBySavedName` | 使用 `savedName` | `originalName` |
| 预览 | `findBySavedName` | 使用 `savedName` | - |
| 上传 | `findByOriginalName` | 检查重复 | - |

## 前端调用规范

### ✅ 正确的做法

```javascript
// 移动文件
moveFileMutation.mutate({
  filename: selectedFile.savedName,  // ✅ 使用 savedName
  targetFolderId: targetFolder
})

// 删除文件
deleteFile(folderId, file.savedName)  // ✅ 使用 savedName

// 下载文件
window.location.href = `/api/folders/${folderId}/download/${encodeURIComponent(file.savedName)}`
```

## 修改的文件

| 文件 | 修改数量 | 状态 |
|------|---------|------|
| `backend/src/routes/folderRoutes.js` | 3处 | ✅ 完成 |
| `backend/src/models/FileModel.js` | 1处 | ✅ 完成 |
| `frontend/src/pages/FolderDetail.jsx` | 0处 | ✅ 正确 |

## 验证步骤

### 1. 重启后端服务器
```bash
cd backend
npm start
```

### 2. 刷新前端页面
- 按 F5 或 Ctrl+R

### 3. 测试所有文件操作
- [ ] 移动文件
- [ ] 删除文件
- [ ] 下载文件
- [ ] 上传文件

## 重要提示

**从现在开始，所有文件操作都必须遵循这个约定：**

1. **查询文件**：使用 `findBySavedName()`
2. **物理操作**：使用 `savedName`
3. **返回用户**：使用 `originalName`
4. **前端调用**：发送 `savedName`

**违反这个约定会导致文件操作失败！**

## 相关文档

- `FILE_NAMING_CONVENTION.md` - 详细的命名约定说明
- `MOVE_API_CORRECTED.md` - 文件移动API修复说明
