# 代码优化快速参考

## 📦 工具导入

```javascript
// 文件名处理
const {
    decodeUrlFilename,      // URL解码
    isFilenameSafe,         // 安全检查
    sanitizeFilename,       // 清理文件名
    getFileExtension        // 获取扩展名
} = require('../utils/filenameUtils');

// 错误处理
const {
    asyncHandler,                    // 异步包装器
    createValidationError,           // 验证错误 (400)
    createAuthenticationError,       // 认证错误 (401)
    createAuthorizationError,        // 授权错误 (403)
    createNotFoundError,             // 未找到 (404)
    batchExecute                     // 批量操作
} = require('../utils/errorHandler');

// 日志
const logger = require('../utils/logger');

// 配置
const config = require('../config');
```

---

## 🔧 常用代码片段

### 1. 安全的文件名处理
```javascript
const filename = decodeUrlFilename(req.params.filename);
if (!isFilenameSafe(filename)) {
    throw createValidationError('文件名不安全');
}
```

### 2. 异步路由（自动错误处理）
```javascript
router.get('/path', asyncHandler(async (req, res) => {
    const data = await Model.getData();
    res.json(data);
}));
```

### 3. 参数验证
```javascript
if (!req.body.name) {
    throw createValidationError('名称不能为空', 'EMPTY_NAME');
}
```

### 4. 权限检查
```javascript
if (resource.owner !== req.user.username) {
    throw createAuthorizationError('无权访问', 'ACCESS_DENIED');
}
```

### 5. 资源未找到
```javascript
const item = await Model.findById(id);
if (!item) {
    throw createNotFoundError('资源不存在', 'NOT_FOUND');
}
```

### 6. 批量操作
```javascript
const { success, failed } = await batchExecute(
    items,
    async (item) => await processItem(item),
    'item'
);

res.json({
    successCount: success.length,
    failedCount: failed.length,
    errors: failed
});
```

### 7. 日志记录
```javascript
// 信息日志
logger.info('操作成功', { user, action });

// 警告日志
logger.warn('配额即将用尽', { user, usage });

// 错误日志（自动包含堆栈）
logger.error('操作失败', error);
```

---

## 🎯 错误码速查

| 错误类型 | HTTP状态码 | 使用场景 |
|---------|-----------|---------|
| `createValidationError` | 400 | 参数验证失败 |
| `createAuthenticationError` | 401 | 未登录/登录过期 |
| `createAuthorizationError` | 403 | 无权限访问 |
| `createNotFoundError` | 404 | 资源不存在 |
| `createConflictError` | 409 | 资源冲突 |
| `createServerError` | 500 | 服务器错误 |

---

## ⚙️ 配置速查

```javascript
// 文件上传
config.maxFileSize              // 最大文件大小
config.chunkSize                // 分片大小

// 存储配额
config.defaultUserQuota         // 默认用户配额 (10GB)

// 回收站
config.recycleBinRetentionDays  // 保留天数 (30天)

// 会话
config.sessionTimeoutMs         // 会话超时 (1小时)
config.uploadSessionTimeoutMs   // 上传会话超时

// 性能
config.maxConcurrentUploads     // 最大并发上传数 (5)

// 缓存
config.previewCacheMaxAge       // 预览缓存时间 (1小时)

// 安全
config.rateLimitWindowMs        // 限流窗口 (1秒)
config.rateLimitMaxRequests     // 最大请求数 (5次/秒)
```

---

## 🚀 完整路由示例

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, createNotFoundError, createAuthorizationError } = require('../utils/errorHandler');
const { decodeUrlFilename, isFilenameSafe } = require('../utils/filenameUtils');
const logger = require('../utils/logger');

router.get('/:id/:filename',
    authenticateToken,
    asyncHandler(async (req, res) => {
        // 1. 解析参数
        const id = parseInt(req.params.id);
        const filename = decodeUrlFilename(req.params.filename);
        
        // 2. 验证文件名
        if (!isFilenameSafe(filename)) {
            throw createValidationError('文件名不安全');
        }
        
        // 3. 查询资源
        const resource = await Model.findById(id);
        if (!resource) {
            throw createNotFoundError('资源不存在');
        }
        
        // 4. 权限检查
        if (resource.owner !== req.user.username) {
            throw createAuthorizationError('无权访问');
        }
        
        // 5. 记录日志
        logger.info('访问资源', {
            resourceId: id,
            filename,
            user: req.user.username
        });
        
        // 6. 返回结果
        res.json(resource);
    })
);

module.exports = router;
```

---

## 📋 迁移检查清单

### 路由迁移
- [ ] 使用 `asyncHandler` 包装异步路由
- [ ] 使用 `create*Error` 抛出错误
- [ ] 使用 `decodeUrlFilename` 处理URL参数
- [ ] 使用 `isFilenameSafe` 验证文件名
- [ ] 使用 `logger` 记录日志

### 配置迁移
- [ ] 更新 `.env` 文件
- [ ] 使用 `config` 对象读取配置
- [ ] 移除硬编码的配置值

### 错误处理迁移
- [ ] 移除 `try-catch` 包装（使用 `asyncHandler`）
- [ ] 统一错误响应格式
- [ ] 使用类型化的错误创建函数

---

## 🔍 调试技巧

### 查看请求ID
```javascript
const { getRequestId } = require('../utils/logger');
const requestId = getRequestId(); // 获取当前请求ID
```

### 批量操作调试
```javascript
const { success, failed } = await batchExecute(items, fn, 'item');
console.log('成功:', success.length);
console.log('失败:', failed.length);
console.log('失败详情:', failed);
```

### 日志级别控制
```bash
# .env 文件
LOG_LEVEL=debug  # error, warn, info, debug
```

---

## 💡 最佳实践

1. **始终验证用户输入**
   ```javascript
   if (!isFilenameSafe(filename)) {
       throw createValidationError('文件名不安全');
   }
   ```

2. **使用类型化错误**
   ```javascript
   // ❌ 不推荐
   throw new Error('未找到');
   
   // ✅ 推荐
   throw createNotFoundError('资源不存在', 'RESOURCE_NOT_FOUND');
   ```

3. **记录有意义的日志**
   ```javascript
   // ❌ 不推荐
   logger.info('操作成功');
   
   // ✅ 推荐
   logger.info('文件上传成功', {
       filename: file.name,
       size: file.size,
       user: req.user.username
   });
   ```

4. **批量操作收集错误**
   ```javascript
   // ✅ 使用 batchExecute 自动收集
   const { success, failed } = await batchExecute(items, fn, 'item');
   ```

5. **配置使用环境变量**
   ```javascript
   // ❌ 不推荐
   const maxSize = 100 * 1024 * 1024;
   
   // ✅ 推荐
   const maxSize = config.maxFileSize;
   ```

---

## 📚 相关文档

- [完整实施报告](CODE_QUALITY_IMPROVEMENTS.md)
- [迁移指南](MIGRATION_GUIDE.md)
- [API参考](API_REFERENCE.md)

---

**快速参考 v1.0** | 最后更新: 2024-12-04
