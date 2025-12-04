# HTTP状态码迁移到APF业务错误码

## 已完成
- ✅ errorCodes.js - 新增 APF0000 成功码和 sendSuccess 函数
- ✅ rateLimiter.js - 速率限制使用 APF901
- ✅ auth.js - 认证中间件使用 APF102/103/104/202
- ✅ loginProtection.js - 登录保护使用 APF902
- ✅ userRoutes.js - 登录接口使用 APF101/107

## 待修改文件

### 1. userRoutes.js (剩余部分)
需要修改的错误响应：
- `res.status(400)` → `sendError(res, 'PARAM_MISSING')`
- `res.status(403)` → `sendError(res, 'PERMISSION_DENIED')`
- `res.status(404)` → `sendError(res, 'USER_NOT_FOUND')`
- `res.status(409)` → `sendError(res, 'USER_ALREADY_EXISTS')`

### 2. shareRoutes.js
需要修改的错误响应：
- `res.status(400)` → `sendError(res, 'PARAM_MISSING')`
- `res.status(403)` → `sendError(res, 'PERMISSION_DENIED')`

### 3. recycleBinRoutes.js
需要修改的错误响应：
- `res.status(403)` → `sendError(res, 'PERMISSION_DENIED')`
- `res.status(404)` → `sendError(res, 'RESOURCE_NOT_FOUND')`

### 4. publicShareRoutes.js
需要修改的错误响应：
- `res.status(400)` → `sendError(res, 'PARAM_MISSING')`
- `res.status(403)` → `sendError(res, 'PERMISSION_DENIED')`
- `res.status(404)` → `sendError(res, 'RESOURCE_NOT_FOUND')`
- `res.status(410)` → `sendError(res, 'SHARE_EXPIRED')`
- `res.status(500)` → `sendError(res, 'SERVER_ERROR')`

### 5. permissionRoutes.js
需要修改的错误响应：
- `res.status(403)` → `sendError(res, 'PERMISSION_DENIED')`
- `res.status(404)` → `sendError(res, 'RESOURCE_NOT_FOUND')`

### 6. chunkUploadRoutes.js
需要修改的错误响应：
- `res.status(400)` → `sendError(res, 'PARAM_MISSING')`
- `res.status(404)` → `sendError(res, 'RESOURCE_NOT_FOUND')`
- `res.status(409)` → 文件已存在的特殊处理

### 7. fileRoutes.js, imageRoutes.js, folderRoutes.js
需要全面检查并修改所有HTTP错误状态码

## 修改步骤

1. 在每个路由文件顶部引入：
```javascript
const { sendError, sendSuccess } = require('../config/errorCodes');
```

2. 替换所有 `res.status(4xx/5xx).json({ error: ... })` 为：
```javascript
return sendError(res, 'ERROR_CODE_KEY', '可选的自定义消息');
```

3. 成功响应可选使用：
```javascript
return sendSuccess(res, data, '操作成功');
// 或保持原样
res.json({ success: true, data: ... });
```

## 注意事项

- 文件下载、图片预览等二进制响应不需要修改
- 健康检查等简单接口可以保持原样
- 确保前端能正确处理新的响应格式
