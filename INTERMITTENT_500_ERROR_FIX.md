# 间歇性500错误修复报告

## 问题描述

前端请求时不时出现500错误，包括：
- 文件列表获取失败
- 文件上传失败
- 文件删除失败
- 其他API操作失败

**关键特征**：
- 错误是间歇性的，多次请求后又能成功
- 后端日志中没有错误记录
- 相同的请求有时成功有时失败

## 根本原因分析

### 1. JsonAdapter 文件锁竞争条件
**问题**：`JsonAdapter` 使用简单的 Map 实现文件锁，在高并发情况下存在以下问题：
- 无超时机制，可能导致无限等待
- 文件读写操作缺少重试机制
- 异常处理不完善，错误未被正确传播

### 2. 错误处理不完善
**问题**：
- 某些异步操作的异常未被 try-catch 捕获
- 错误处理中间件可能在响应已发送后被调用
- 全局未捕获异常未被记录

### 3. 日志记录不足
**问题**：
- 关键操作缺少日志记录
- 数据库操作失败时没有详细日志
- 无法追踪请求的完整生命周期

## 修复方案

### 1. 增强 JsonAdapter 的健壮性

#### 文件锁超时机制
```javascript
async _acquireLock(collection) {
    const maxWaitTime = 5000; // 最多等待5秒
    const startTime = Date.now();
    
    while (this.locks.get(collection)) {
        if (Date.now() - startTime > maxWaitTime) {
            throw new Error(`数据库操作超时: ${collection}`);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.locks.set(collection, true);
}
```

#### 文件读取重试机制
```javascript
async _readFile(collection) {
    let retries = 3;
    let lastError = null;
    
    while (retries > 0) {
        try {
            const buffer = await fs.readFile(filePath);
            const data = buffer.toString('utf8');
            return JSON.parse(data);
        } catch (error) {
            lastError = error;
            retries--;
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }
    
    throw new Error(`读取数据库文件失败: ${collection}`);
}
```

#### 增强错误处理
- 所有数据库操作都包裹在 try-catch 中
- 错误信息包含详细的上下文
- 临时文件清理更加可靠

### 2. 改进错误处理中间件

```javascript
const errorHandler = (err, req, res, next) => {
    // 防止重复发送响应
    if (res.headersSent) {
        logger.error('响应已发送，但仍有错误:', err);
        return next(err);
    }

    // 记录完整的错误信息
    logger.error(`[ERROR] ${req.method} ${req.path}`, {
        error: err.message,
        stack: err.stack,
        body: req.body,
        params: req.params,
        query: req.query,
        user: req.user ? req.user.username : 'anonymous'
    });

    // 特殊处理数据库错误
    if (err.message && err.message.includes('数据库')) {
        statusCode = 500;
        message = '数据库操作失败，请稍后重试';
    }

    // 安全地发送响应
    try {
        res.status(statusCode).json(errorResponse);
    } catch (sendError) {
        logger.error('发送错误响应失败:', sendError);
    }
};
```

### 3. 添加全局异常处理

```javascript
// 全局未捕获异常处理
process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常:', error);
    logger.error('堆栈:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝:', reason);
    logger.error('Promise:', promise);
});
```

### 4. 增强日志记录

在所有关键路由和模型方法中添加详细日志：
- 请求开始时记录参数
- 操作成功时记录结果
- 操作失败时记录详细错误

**示例**：
```javascript
router.get('/:folderId/files', authenticate, async (req, res, next) => {
    try {
        const folderId = parseInt(req.params.folderId);
        logger.info(`获取文件列表: folderId=${folderId}, user=${req.user.username}`);
        
        // ... 业务逻辑 ...
        
        logger.info(`成功获取文件列表: folderId=${folderId}, count=${files.length}`);
        res.json(files);
    } catch (error) {
        logger.error(`获取文件列表失败: folderId=${req.params.folderId}`, error);
        next(error);
    }
});
```

### 5. 模型层错误处理

所有模型方法都添加 try-catch 和详细错误信息：

```javascript
async findByFolder(folderId) {
    try {
        const files = await this.find({ folderId });
        return files.map(file => {
            // ... 数据转换 ...
        });
    } catch (error) {
        console.error(`FileModel.findByFolder失败: folderId=${folderId}`, error);
        throw new Error(`查询文件列表失败: ${error.message}`);
    }
}
```

## 修复的文件列表

1. **backend/src/database/adapters/JsonAdapter.js**
   - 添加文件锁超时机制
   - 添加文件读取重试机制
   - 增强所有方法的错误处理

2. **backend/src/middleware/errorHandler.js**
   - 防止重复发送响应
   - 增强错误日志记录
   - 特殊处理数据库错误

3. **backend/src/app.js**
   - 添加全局未捕获异常处理
   - 添加未处理的Promise拒绝处理

4. **backend/src/routes/folderRoutes.js**
   - 所有路由添加详细日志
   - 增强错误处理

5. **backend/src/models/FileModel.js**
   - 所有方法添加 try-catch
   - 添加详细错误信息

6. **backend/src/models/FolderModel.js**
   - 所有方法添加 try-catch
   - 添加详细错误信息

## 预期效果

1. **消除间歇性错误**：通过重试机制和超时控制，减少文件锁竞争导致的失败
2. **完整的错误日志**：所有错误都会被记录，便于排查问题
3. **更好的用户体验**：数据库操作失败时返回友好的错误信息
4. **系统稳定性提升**：全局异常处理防止进程崩溃

## 测试建议

1. **并发测试**：使用多个客户端同时访问API，验证文件锁机制
2. **压力测试**：高频率请求同一个接口，观察是否还有500错误
3. **日志验证**：检查 `logs/error.log` 和 `logs/combined.log`，确认所有错误都被记录
4. **错误恢复**：模拟数据库文件损坏，验证重试机制是否生效

## 后续优化建议

1. **考虑使用真实数据库**：如果并发量持续增加，建议迁移到 MySQL/PostgreSQL/MongoDB
2. **添加性能监控**：记录每个API的响应时间，识别性能瓶颈
3. **实现请求队列**：对于写操作，可以考虑使用队列来避免并发冲突
4. **添加健康检查**：定期检查数据库文件的完整性

## 部署说明

修复已完成，需要重启后端服务：

```bash
# Windows
cd backend
npm start

# 或使用项目根目录的启动脚本
start.bat
```

重启后，所有修复将立即生效。建议监控日志文件以确认问题已解决。
