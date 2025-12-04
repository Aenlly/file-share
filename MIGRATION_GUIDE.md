# 代码优化迁移指南

## 快速开始

本指南帮助开发者将现有代码迁移到新的统一工具和最佳实践。

---

## 1. 文件名处理迁移

### 导入工具
```javascript
const {
    decodeUrlFilename,
    encodeUrlFilename,
    isFilenameSafe,
    sanitizeFilename,
    getFileExtension
} = require('../utils/filenameUtils');
```

### 场景1: URL参数中的文件名
```javascript
// ❌ 旧代码
router.get('/download/:filename', async (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    // ...
});

// ✅ 新代码
router.get('/download/:filename', asyncHandler(async (req, res) => {
    const filename = decodeUrlFilename(req.params.filename);
    
    if (!isFilenameSafe(filename)) {
        throw createValidationError('文件名包含非法字符', 'INVALID_FILENAME');
    }
    // ...
}));
```

### 场景2: 用户上传的文件名
```javascript
// ❌ 旧代码
const filename = req.body.filename;
// 直接使用，可能存在安全风险

// ✅ 新代码
const rawFilename = req.body.filename;
const filename = sanitizeFilename(rawFilename);

if (!filename) {
    throw createValidationError('文件名无效', 'INVALID_FILENAME');
}
```

### 场景3: 文件扩展名检查
```javascript
// ❌ 旧代码
const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

// ✅ 新代码
const ext = getFileExtension(filename); // 返回 '.txt'
```

---

## 2. 错误处理迁移

### 导入工具
```javascript
const {
    asyncHandler,
    createValidationError,
    createAuthenticationError,
    createAuthorizationError,
    createNotFoundError,
    batchExecute
} = require('../utils/errorHandler');
```

### 场景1: 异步路由处理
```javascript
// ❌ 旧代码
router.get('/files/:id', async (req, res, next) => {
    try {
        const file = await FileModel.findById(req.params.id);
        if (!file) {
            return sendError(res, 'NOT_FOUND', '文件不存在');
        }
        res.json(file);
    } catch (error) {
        logger.error('获取文件失败:', error);
        next(error);
    }
});

// ✅ 新代码
router.get('/files/:id', asyncHandler(async (req, res) => {
    const file = await FileModel.findById(req.params.id);
    
    if (!file) {
        throw createNotFoundError('文件不存在', 'FILE_NOT_FOUND');
    }
    
    res.json(file);
}));
```

### 场景2: 参数验证
```javascript
// ❌ 旧代码
if (!req.body.filename) {
    return sendError(res, 'VALIDATION_ERROR', '文件名不能为空');
}

// ✅ 新代码
if (!req.body.filename) {
    throw createValidationError('文件名不能为空', 'EMPTY_FILENAME');
}
```

### 场景3: 权限检查
```javascript
// ❌ 旧代码
if (folder.owner !== req.user.username) {
    return sendError(res, 'FORBIDDEN', '无权访问此文件夹');
}

// ✅ 新代码
if (folder.owner !== req.user.username) {
    throw createAuthorizationError('无权访问此文件夹', 'FOLDER_ACCESS_DENIED');
}
```

### 场景4: 批量操作
```javascript
// ❌ 旧代码
router.post('/files/batch-delete', async (req, res, next) => {
    try {
        const { fileIds } = req.body;
        const deletedIds = [];
        const errorIds = [];
        
        for (const fileId of fileIds) {
            try {
                await FileModel.delete(fileId, req.user.username);
                deletedIds.push(fileId);
            } catch (error) {
                logger.error(`删除文件失败: ${fileId}`, error);
                errorIds.push(fileId);
            }
        }
        
        res.json({
            success: true,
            deletedCount: deletedIds.length,
            errorCount: errorIds.length,
            deletedIds,
            errorIds
        });
    } catch (error) {
        next(error);
    }
});

// ✅ 新代码
router.post('/files/batch-delete', asyncHandler(async (req, res) => {
    const { fileIds } = req.body;
    
    const { success, failed } = await batchExecute(
        fileIds,
        async (fileId) => await FileModel.delete(fileId, req.user.username),
        'file'
    );
    
    res.json({
        success: true,
        deletedCount: success.length,
        errorCount: failed.length,
        deletedIds: success.map(s => s.item),
        errors: failed
    });
}));
```

---

## 3. 配置使用迁移

### 场景1: 使用新配置项
```javascript
const config = require('../config');

// 存储配额
const userQuota = config.defaultUserQuota; // 10GB

// 回收站保留期
const retentionDays = config.recycleBinRetentionDays; // 30天

// 会话超时
const sessionTimeout = config.sessionTimeoutMs; // 1小时

// 最大并发上传
const maxConcurrent = config.maxConcurrentUploads; // 5
```

### 场景2: 环境变量配置
```bash
# 在 .env 文件中配置
DEFAULT_USER_QUOTA=53687091200  # 50GB
RECYCLE_BIN_RETENTION_DAYS=60   # 60天
MAX_CONCURRENT_UPLOADS=10       # 10个并发
```

---

## 4. 日志记录迁移

### 场景1: 基本日志
```javascript
// ❌ 旧代码
console.log('用户登录:', username);
console.error('登录失败:', error);

// ✅ 新代码
const logger = require('../utils/logger');

logger.info('用户登录:', { username });
logger.error('登录失败:', error);
```

### 场景2: 带上下文的日志
```javascript
// ✅ 推荐写法
logger.info('文件上传成功', {
    filename: file.originalName,
    size: file.size,
    user: req.user.username,
    folderId: file.folderId
});
```

### 场景3: 错误日志（包含堆栈）
```javascript
// ✅ 推荐写法
try {
    // ...
} catch (error) {
    logger.error('操作失败:', error); // 自动包含堆栈信息
}
```

---

## 5. 完整示例

### 文件下载路由（完整迁移）

```javascript
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, createNotFoundError, createAuthorizationError } = require('../utils/errorHandler');
const { decodeUrlFilename, isFilenameSafe } = require('../utils/filenameUtils');
const FileModel = require('../models/FileModel');
const FolderModel = require('../models/FolderModel');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * 下载文件
 */
router.get('/download/:folderId/:filename',
    authenticateToken,
    asyncHandler(async (req, res) => {
        const folderId = parseInt(req.params.folderId);
        const filename = decodeUrlFilename(req.params.filename);
        
        // 验证文件名安全性
        if (!isFilenameSafe(filename)) {
            throw createValidationError('文件名包含非法字符', 'INVALID_FILENAME');
        }
        
        // 检查文件夹权限
        const folder = await FolderModel.findById(folderId);
        if (!folder) {
            throw createNotFoundError('文件夹不存在', 'FOLDER_NOT_FOUND');
        }
        
        if (folder.owner !== req.user.username) {
            throw createAuthorizationError('无权访问此文件夹', 'FOLDER_ACCESS_DENIED');
        }
        
        // 查找文件
        const file = await FileModel.findByFolderAndName(folderId, filename);
        if (!file) {
            throw createNotFoundError('文件不存在', 'FILE_NOT_FOUND');
        }
        
        // 构建文件路径
        const filePath = path.join(config.database.json.dataDir, 'files', file.savedName);
        
        // 检查文件是否存在
        if (!await fs.pathExists(filePath)) {
            logger.error('文件物理路径不存在', { filePath, fileId: file.id });
            throw createNotFoundError('文件已损坏或丢失', 'FILE_MISSING');
        }
        
        // 记录下载日志
        logger.info('文件下载', {
            filename: file.originalName,
            size: file.size,
            user: req.user.username,
            folderId
        });
        
        // 发送文件
        res.download(filePath, file.originalName);
    })
);

module.exports = router;
```

---

## 6. 注册错误处理中间件

在 `app.js` 或 `server.js` 中注册全局错误处理器：

```javascript
const express = require('express');
const app = express();
const { errorHandlerMiddleware } = require('./utils/errorHandler');

// ... 其他中间件和路由

// 注册所有路由之后
app.use(errorHandlerMiddleware);

// 启动服务器
app.listen(3000);
```

---

## 7. 测试建议

### 单元测试示例
```javascript
const { isFilenameSafe, sanitizeFilename } = require('../utils/filenameUtils');

describe('filenameUtils', () => {
    describe('isFilenameSafe', () => {
        it('应该拒绝包含路径遍历的文件名', () => {
            expect(isFilenameSafe('../etc/passwd')).toBe(false);
            expect(isFilenameSafe('..\\windows\\system32')).toBe(false);
        });
        
        it('应该接受安全的文件名', () => {
            expect(isFilenameSafe('document.pdf')).toBe(true);
            expect(isFilenameSafe('我的文件.txt')).toBe(true);
        });
    });
    
    describe('sanitizeFilename', () => {
        it('应该清理危险字符', () => {
            expect(sanitizeFilename('../file.txt')).toBe('__file.txt');
            expect(sanitizeFilename('file<>:"|?*.txt')).toBe('file_______.txt');
        });
    });
});
```

---

## 8. 常见问题

### Q1: 是否需要立即迁移所有代码？
**A**: 不需要。新工具是向后兼容的，可以逐步迁移。建议优先迁移：
1. 新开发的功能
2. 高频使用的路由
3. 安全敏感的代码

### Q2: 迁移后性能会受影响吗？
**A**: 不会。新工具的性能开销极小，某些场景下甚至更快（如批量操作）。

### Q3: 如何处理现有的错误码？
**A**: 新的错误处理器兼容现有的 `sendError` 函数，可以继续使用现有错误码。

### Q4: 是否需要修改前端代码？
**A**: 不需要。API响应格式保持不变，前端无需修改。

---

## 9. 检查清单

迁移完成后，请检查：

- [ ] 所有 `console.log` 已替换为 `logger`
- [ ] 文件名处理使用 `filenameUtils`
- [ ] 异步路由使用 `asyncHandler` 包装
- [ ] 错误抛出使用统一的 `create*Error` 函数
- [ ] 批量操作使用 `batchExecute`
- [ ] 全局错误处理中间件已注册
- [ ] 环境变量配置已更新
- [ ] 单元测试已更新
- [ ] 代码已通过 lint 检查
- [ ] 功能测试通过

---

## 10. 获取帮助

- 查看 `CODE_QUALITY_IMPROVEMENTS.md` 了解详细设计
- 查看 `backend/src/utils/` 目录下的工具源码
- 提交 Issue 或联系开发团队

**祝迁移顺利！** 🚀
