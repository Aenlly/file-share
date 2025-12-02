# 子文件夹权限修复说明

## 问题描述
1. 子文件夹中的文件无法移动到父文件夹，显示无权限
2. 父文件夹中的文件可以移动，但响应中不显示子文件夹的ID

## 根本原因
权限校验逻辑只检查了文件夹的直接所有者，没有考虑到子文件夹的情况。当用户在子文件夹中操作时，子文件夹的所有者是用户，但权限校验没有正确处理这种层级关系。

## 修复内容

### 1. 文件移动路由 (`backend/src/routes/fileMoveRoutes.js`)

#### 新增权限检查函数
```javascript
async function isFolderOwnedByUser(folderId, username) {
    const folder = await FolderModel.findById(folderId);
    if (!folder) {
        return false;
    }

    // 检查是否是所有者
    if (folder.owner === username) {
        return true;
    }

    // 检查是否是子文件夹（通过遍历父文件夹链）
    let currentFolder = folder;
    const allFolders = await FolderModel.getAll();

    while (currentFolder.parentId) {
        const parentFolder = allFolders.find(f => f.id === currentFolder.parentId);
        if (!parentFolder) {
            break;
        }

        if (parentFolder.owner === username) {
            return true;
        }

        currentFolder = parentFolder;
    }

    return false;
}
```

#### 改进的权限校验
- 使用 `isFolderOwnedByUser()` 替代简单的所有者检查
- 支持子文件夹的权限检查
- 更详细的错误响应

#### 改进的响应格式
```javascript
res.json({
    success: true,
    message: '文件移动成功',
    file: {
        id: fileRecord.id,
        originalName: filename,
        folderId: targetFolderId
    },
    sourceFolder: {
        id: sourceFolder.id,
        alias: sourceFolder.alias
    },
    targetFolder: {
        id: targetFolder.id,
        alias: targetFolder.alias
    }
});
```

### 2. 文件夹路由 (`backend/src/routes/folderRoutes.js`)

添加了相同的 `isFolderOwnedByUser()` 函数，并更新了以下路由的权限校验：
- `GET /:folderId` - 获取文件夹详情
- `GET /:folderId/files` - 获取文件夹内的文件
- `POST /:folderId/upload` - 上传文件
- `DELETE /:folderId/file` - 删除文件
- `GET /:folderId/download/:filename` - 下载文件
- `GET /:folderId/subfolders` - 获取子文件夹

## 权限检查逻辑

权限检查现在支持以下场景：

1. **直接所有者**：用户是文件夹的直接所有者
2. **子文件夹**：用户是文件夹的所有者，且该文件夹是另一个用户拥有的文件夹的子文件夹
3. **层级链**：通过遍历整个父文件夹链来确定权限

## 修复后的行为

### 文件移动
- ✓ 用户可以在自己的文件夹中移动文件
- ✓ 用户可以在子文件夹中移动文件到父文件夹
- ✓ 用户可以在父文件夹中移动文件到子文件夹
- ✓ 响应包含源文件夹和目标文件夹的ID和别名

### 文件夹访问
- ✓ 用户可以访问自己拥有的文件夹
- ✓ 用户可以访问自己拥有的子文件夹
- ✓ 用户可以在子文件夹中执行所有操作

## 测试建议

1. 创建一个父文件夹
2. 在父文件夹中创建一个子文件夹
3. 在子文件夹中上传文件
4. 尝试将文件移动到父文件夹
5. 验证操作成功，响应包含正确的文件夹ID

## 运行测试脚本

```bash
node backend/test-subfolder-move.js
```

这个脚本会测试：
- 创建父文件夹和子文件夹
- 在子文件夹中创建文件
- 权限检查
- 文件移动
- 验证结果
