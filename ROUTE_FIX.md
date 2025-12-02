# 路由注册修复说明

## 问题描述
文件移动API返回404错误，提示 `POST http://localhost:8001/api/folders/2/move 404 (Not Found)`。

## 根本原因
路由冲突问题：
1. `fileMoveRoutes` 和 `folderRoutes` 都被注册在 `/api/folders` 路径下
2. Express 路由匹配顺序导致 `GET /:folderId` 先被匹配，而不是 `POST /:folderId/move`
3. 这是因为 Express 按照注册顺序匹配路由，而 `GET /:folderId` 可能会拦截 `POST /:folderId/move` 的请求

## 解决方案
将文件移动功能集成到 `folderRoutes` 中，而不是作为单独的路由文件。

## 修改内容

### 1. 文件夹路由 (`backend/src/routes/folderRoutes.js`)
- 添加了 `POST /:folderId/move` 路由
- 该路由包含完整的权限检查和文件移动逻辑
- 使用相同的 `isFolderOwnedByUser()` 权限检查函数

### 2. 应用程序主文件 (`backend/src/app.js`)
- 移除了 `fileMoveRoutes` 的导入
- 移除了 `app.use('/api/folders', fileMoveRoutes)` 的注册

### 3. 文件移动路由文件 (`backend/src/routes/fileMoveRoutes.js`)
- 该文件现在已不再使用，可以删除

## 路由结构

现在所有文件夹相关的操作都在一个路由文件中：

```
POST   /api/folders              - 创建文件夹
GET    /api/folders              - 获取用户的所有文件夹
GET    /api/folders/:folderId    - 获取文件夹详情
DELETE /api/folders/:folderId    - 删除文件夹
GET    /api/folders/:folderId/files       - 获取文件夹内的文件
POST   /api/folders/:folderId/upload      - 上传文件
DELETE /api/folders/:folderId/file        - 删除文件
GET    /api/folders/:folderId/download/:filename - 下载文件
POST   /api/folders/:folderId/move        - 移动文件（新增）
GET    /api/folders/:folderId/subfolders  - 获取子文件夹
```

## 测试

现在可以正常调用文件移动API：

```bash
POST /api/folders/2/move
Content-Type: application/json

{
    "filename": "test.txt",
    "targetFolderId": 1
}
```

预期响应：
```json
{
    "success": true,
    "message": "文件移动成功",
    "file": {
        "id": 1,
        "originalName": "test.txt",
        "folderId": 1
    },
    "sourceFolder": {
        "id": 2,
        "alias": "子文件夹"
    },
    "targetFolder": {
        "id": 1,
        "alias": "父文件夹"
    }
}
```

## 清理

可以删除不再使用的文件：
- `backend/src/routes/fileMoveRoutes.js`
- `backend/test-subfolder-move.js`（可选，用于测试）
