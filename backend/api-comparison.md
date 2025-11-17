# API端点对比

## 原始server.js中的API端点

### 用户相关
- POST /api/login
- GET /api/users
- POST /api/users
- PUT /api/users/:id
- PUT /api/users/:id/password
- DELETE /api/users/:id

### 文件夹相关
- GET /api/folders
- POST /api/folders
- DELETE /api/folders/:id
- POST /api/folders/:folderId/upload
- GET /api/folders/:folderId/files
- DELETE /api/folders/:folderId/file
- POST /api/folders/:folderId/move

### 分享相关
- POST /api/shares
- GET /api/shares
- PUT /api/shares/:id
- DELETE /api/shares/:id
- GET /api/share/:code
- GET /api/share/:code/download
- GET /api/share/:code/file/:filename

## 模块化版本中的API端点

### 用户相关 (userRoutes.js)
- POST /api/login ✓
- GET /api/users ✓
- POST /api/users ✓
- PUT /api/users/:id ✓
- PUT /api/users/:id/password ✓
- DELETE /api/users/:id ✓

### 文件夹相关 (folderRoutes.js)
- GET /api/folders ✓
- POST /api/folders ✓
- DELETE /api/folders/:id ✓
- POST /api/folders/:folderId/upload ✓
- GET /api/folders/:folderId/files ✓
- DELETE /api/folders/:folderId/file ✓
- POST /api/folders/:folderId/move ✓ (已添加)

### 分享相关 (shareRoutes.js)
- POST /api/shares ✓
- GET /api/shares ✓
- PUT /api/shares/:id ✓
- DELETE /api/shares/:id ✓
- GET /api/share/:code ✓
- GET /api/share/:code/download ✓
- GET /api/share/:code/file/:filename ✓

## 结论

所有API端点都已实现，包括之前缺失的文件移动功能。