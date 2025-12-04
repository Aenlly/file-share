# 路由重构说明

## 问题
`backend/src/routes/folderRoutes.js` 文件过大（1310行），包含了文件夹、文件、回收站等多种操作，难以维护。

## 解决方案
将路由拆分为多个独立的文件：

### 1. 已完成的拆分

#### recycleBinRoutes.js（新建）
- `GET /api/recycle-bin/` - 获取回收站文件列表
- `POST /api/recycle-bin/restore/:fileId` - 恢复文件
- `DELETE /api/recycle-bin/clear` - 清空回收站
- `DELETE /api/recycle-bin/:fileId` - 永久删除文件

**权限控制：**
- 所有操作都需要相应的 `recycle:*:own` 或 `recycle:manage:all` 权限
- 使用 `canAccessResource('recycle', 'view|restore|delete')` 中间件

### 2. 需要手动完成的工作

#### 从 folderRoutes.js 中删除以下路由：
```javascript
// 删除这些路由定义（约第298-447行）
router.get('/trash/files', ...)
router.post('/trash/restore/:fileId', ...)
router.delete('/trash/clear', ...)
router.delete('/trash/:fileId', ...)
```

#### 更新前端 API 调用
需要将前端中所有 `/api/folders/trash/*` 的调用改为 `/api/recycle-bin/*`：

**文件位置：**
- `frontend/src/pages/RecycleBin.jsx`
- 其他可能调用回收站 API 的组件

**修改示例：**
```javascript
// 旧的
api.get('/folders/trash/files')
api.post(`/folders/trash/restore/${fileId}`)
api.delete('/folders/trash/clear')
api.delete(`/folders/trash/${fileId}`)

// 新的
api.get('/recycle-bin')
api.post(`/recycle-bin/restore/${fileId}`)
api.delete('/recycle-bin/clear')
api.delete(`/recycle-bin/${fileId}`)
```

### 3. 建议的进一步拆分

#### fileRoutes.js（建议创建）
将文件相关操作从 folderRoutes.js 中分离：
- 文件上传（普通上传、分片上传）
- 文件下载
- 文件删除
- 文件移动
- 文件预览

路由结构：
- `POST /api/files/upload` - 上传文件
- `POST /api/files/chunk/init` - 初始化分片上传
- `POST /api/files/chunk` - 上传分片
- `POST /api/files/chunk/complete` - 完成分片上传
- `GET /api/files/:fileId/download` - 下载文件
- `GET /api/files/:fileId/preview` - 预览文件
- `DELETE /api/files/:fileId` - 删除文件
- `POST /api/files/:fileId/move` - 移动文件

#### folderRoutes.js（保留并简化）
只保留文件夹相关操作：
- `GET /api/folders` - 获取文件夹列表
- `POST /api/folders` - 创建文件夹
- `GET /api/folders/:folderId` - 获取文件夹详情
- `DELETE /api/folders/:folderId` - 删除文件夹
- `GET /api/folders/:folderId/files` - 获取文件夹内的文件
- `GET /api/folders/:folderId/subfolders` - 获取子文件夹

## 权限控制更新

所有路由都已添加权限控制中间件：

### 回收站路由
```javascript
const { canAccessResource } = require('../middleware/permission');

router.get('/', authenticate, canAccessResource('recycle', 'view'), ...)
router.post('/restore/:fileId', authenticate, canAccessResource('recycle', 'restore'), ...)
router.delete('/clear', authenticate, canAccessResource('recycle', 'delete'), ...)
router.delete('/:fileId', authenticate, canAccessResource('recycle', 'delete'), ...)
```

### 用户路由
```javascript
const { requirePermission } = require('../middleware/permission');
const { PERMISSIONS } = require('../config/permissions');

router.get('/', authenticate, requirePermission(PERMISSIONS.USER_VIEW_LIST), ...)
router.post('/', authenticate, requirePermission(PERMISSIONS.USER_CREATE), ...)
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.USER_DELETE), ...)
```

### 分享路由
```javascript
router.get('/', authenticate, canAccessResource('share', 'view'), ...)
router.post('/', authenticate, canAccessResource('share', 'create'), ...)
router.put('/:shareId', authenticate, canAccessResource('share', 'update'), ...)
router.delete('/:shareId', authenticate, canAccessResource('share', 'delete'), ...)
```

## 测试清单

完成重构后需要测试：

- [ ] 回收站功能
  - [ ] 查看回收站文件列表
  - [ ] 恢复文件
  - [ ] 永久删除单个文件
  - [ ] 清空回收站
  
- [ ] 权限控制
  - [ ] 普通用户只能操作自己的回收站
  - [ ] 管理员可以管理所有回收站
  - [ ] 无权限用户被正确拒绝

- [ ] 用户管理
  - [ ] 创建用户需要 USER_CREATE 权限
  - [ ] 删除用户需要 USER_DELETE 权限
  - [ ] 修改密码权限控制正确

- [ ] 分享管理
  - [ ] 创建分享需要权限
  - [ ] 删除分享权限控制正确
  - [ ] 批量操作权限控制正确

## 注意事项

1. **向后兼容**：旧的 `/api/folders/trash/*` 路由在删除前，确保前端已全部更新
2. **权限迁移**：运行 `node backend/scripts/migrate-permissions.js` 为现有用户设置权限
3. **数据库**：无需修改数据库结构，只是路由重构
4. **日志**：所有操作都有详细的日志记录

## 下一步

1. 更新前端 RecycleBin.jsx 中的 API 调用
2. 从 folderRoutes.js 中删除回收站相关路由
3. 测试回收站功能
4. 考虑进一步拆分 fileRoutes.js
