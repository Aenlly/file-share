# 错误码迁移进度

## 已完成的文件

### 中间件
- ✅ backend/src/middleware/auth.js
- ✅ backend/src/middleware/rateLimiter.js

### 路由文件
- ✅ backend/src/routes/userRoutes.js
- ✅ backend/src/routes/shareRoutes.js
- ✅ backend/src/routes/recycleBinRoutes.js
- ✅ backend/src/routes/publicShareRoutes.js
- ✅ backend/src/routes/permissionRoutes.js

## 待处理的文件

### 路由文件
- ⏳ backend/src/routes/imageRoutes.js (7处)
- ⏳ backend/src/routes/folderRoutes.js (5处)
- ⏳ backend/src/routes/fileRoutes.js (4处)
- ⏳ backend/src/routes/chunkUploadRoutes.js (7处)

## 需要添加的错误码

已在 errorCodes.js 中添加：
- AUTH_FORBIDDEN (APF201)
- AUTH_INVALID_PASSWORD (APF207)
- SHARE_INVALID_INPUT (APF407)
- USER_INVALID_INPUT (APF408)
- SHARE_CODE_REQUIRED (APF409)
- FILE_NOT_IMAGE (APF410)
- USER_CANNOT_DELETE_SELF (APF803)

## 下一步

继续修改剩余的路由文件，使用统一的 sendError 函数。
