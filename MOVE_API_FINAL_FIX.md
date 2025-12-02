# 文件移动API 404问题 - 最终修复

## 问题
```
POST http://localhost:8001/api/folders/1/move 404 (Not Found)
```

## 根本原因
**前端发送的文件名参数不匹配后端期望的参数**

### 前端问题
在 `frontend/src/pages/FolderDetail.jsx` 第680行：
```javascript
// ❌ 错误：发送 savedName
moveFileMutation.mutate({
  filename: selectedFile.savedName,  // 这是错误的！
  targetFolderId: targetFolder
})
```

### 后端期望
在 `backend/src/routes/folderRoutes.js` 第368行：
```javascript
// ✅ 正确：期望 originalName
const fileRecord = await FileModel.findByOriginalName(filename, folderId);
```

## 解决方案

### 修改前端代码
**文件**：`frontend/src/pages/FolderDetail.jsx`

**修改前**：
```javascript
const confirmMoveFile = () => {
  if (!targetFolder) {
    message.warning('请选择目标文件夹')
    return
  }

  moveFileMutation.mutate({
    filename: selectedFile.savedName,  // ❌ 错误
    targetFolderId: targetFolder
  })
}
```

**修改后**：
```javascript
const confirmMoveFile = () => {
  if (!targetFolder) {
    message.warning('请选择目标文件夹')
    return
  }

  moveFileMutation.mutate({
    filename: selectedFile.originalName || selectedFile.name,  // ✅ 正确
    targetFolderId: targetFolder
  })
}
```

## 文件修改记录

| 文件 | 修改 | 状态 |
|------|------|------|
| `frontend/src/pages/FolderDetail.jsx` | 修改confirmMoveFile函数 | ✅ 完成 |

## 验证修复

### 1. 刷新前端页面
- 按 F5 或 Ctrl+R 刷新页面
- 浏览器会自动加载新的前端代码

### 2. 测试文件移动功能
1. 创建一个父文件夹
2. 在父文件夹中创建一个子文件夹
3. 在子文件夹中上传一个文件
4. 选择文件并点击"移动"按钮
5. 选择目标文件夹（父文件夹）
6. 确认移动

**预期结果**：
- 显示"文件移动成功"提示
- 文件出现在目标文件夹中
- 源文件夹中的文件列表更新

### 3. 检查浏览器开发者工具
在浏览器开发者工具的"网络"标签中，应该看到：
```
POST /api/folders/1/move 200 OK
```

而不是：
```
POST /api/folders/1/move 404 Not Found
```

## 技术细节

### 文件名的两种表示方式

| 属性 | 说明 | 用途 |
|------|------|------|
| `originalName` | 用户上传时的原始文件名 | 用于API调用、显示给用户 |
| `savedName` | 服务器保存的文件名（带时间戳） | 用于物理文件操作 |

### 为什么会出现这个问题？

1. 前端从API获取文件列表时，返回的是 `originalName` 和 `savedName`
2. 前端在显示文件时使用 `originalName`（用户看到的是原始文件名）
3. 但在调用移动API时，错误地使用了 `savedName`
4. 后端期望的是 `originalName`，所以找不到文件

## 完成状态

✅ **前端修复完成**
✅ **后端代码正确**
✅ **路由已验证**

**现在刷新前端页面，文件移动功能应该能正常工作了！**
