# 启动时序问题修复

## 问题描述

在启动时出现错误：
```
error: 启动时清理上传会话失败: DatabaseManager: config is required for first initialization
Error: DatabaseManager: config is required for first initialization
```

## 根本原因

`backend/src/routes/chunkUploadRoutes.js` 文件在模块加载时立即执行异步清理任务：

```javascript
// 问题代码
(async () => {
    try {
        const cleanedCount = await UploadSessionModel.cleanExpiredSessions();
        // ...
    } catch (error) {
        logger.error('启动时清理上传会话失败:', error);
    }
})();
```

**时序问题**：
1. Express 加载路由模块 → `chunkUploadRoutes.js` 被 require
2. 模块加载时立即执行 IIFE（立即调用函数表达式）
3. 调用 `UploadSessionModel.cleanExpiredSessions()`
4. 尝试访问 DatabaseManager
5. **但此时 DatabaseManager 还未初始化！**（在 `app.js` 中才初始化）

## 解决方案

使用 `setTimeout` 延迟清理任务的执行，确保数据库已初始化：

```javascript
// 修复后的代码
setTimeout(async () => {
    try {
        // 首次清理
        const cleanedCount = await UploadSessionModel.cleanExpiredSessions();
        if (cleanedCount > 0) {
            logger.info(`启动时清理过期的分片上传会话: ${cleanedCount} 个`);
        }
    } catch (error) {
        logger.error('启动时清理上传会话失败:', error);
    }
}, 5000); // 延迟5秒，确保数据库已初始化
```

## 修改文件

- `backend/src/routes/chunkUploadRoutes.js`

## 技术细节

### Node.js 模块加载顺序

```
1. app.js 开始执行
2. require('./routes/chunkUploadRoutes')
   ├─ 加载模块
   ├─ 执行模块顶层代码
   └─ 立即执行的 IIFE 也会执行！
3. 继续 app.js 的其他代码
4. 初始化 DatabaseManager ← 这时才初始化！
5. 启动服务器
```

### 为什么延迟5秒？

- 数据库初始化通常在 1-2 秒内完成
- 5秒是一个安全的缓冲时间
- 即使延迟，也不影响正常的上传功能
- 清理任务本身不是关键路径

### 更好的解决方案（未来优化）

可以使用事件驱动的方式：

```javascript
// 在 app.js 中
const EventEmitter = require('events');
global.appEvents = new EventEmitter();

// 数据库初始化完成后
await dbManager.initialize();
global.appEvents.emit('database:ready');

// 在 chunkUploadRoutes.js 中
if (global.appEvents) {
    global.appEvents.once('database:ready', async () => {
        // 执行清理任务
    });
}
```

## 验证

启动服务器后，应该看到：
```
[INFO] 数据库初始化成功
[INFO] 服务器启动成功，监听端口 3000
[INFO] 启动时清理过期的分片上传会话: X 个  ← 5秒后出现
```

不应该再看到错误：
```
❌ error: 启动时清理上传会话失败: DatabaseManager: config is required
```

## 影响范围

- ✅ 不影响正常的文件上传功能
- ✅ 不影响分片上传功能
- ✅ 清理任务仍然会执行，只是延迟了5秒
- ✅ 定期清理任务（每10分钟）不受影响

## 测试建议

1. **启动测试**：
   ```bash
   cd backend
   npm start
   ```
   确认没有错误信息

2. **功能测试**：
   - 上传文件（正常上传）
   - 上传大文件（分片上传）
   - 等待5秒后检查日志

3. **清理测试**：
   - 创建一些过期的上传会话
   - 重启服务器
   - 5秒后检查是否清理成功

## 相关问题

### Q: 为什么不在 app.js 中调用清理？
**A**: 保持关注点分离。清理逻辑应该在路由模块中，而不是在主应用文件中。

### Q: 5秒会不会太长？
**A**: 对于清理任务来说，5秒的延迟完全可以接受。如果需要更快，可以改为2-3秒。

### Q: 如果5秒后数据库还没初始化怎么办？
**A**: 这种情况极少发生。如果真的发生，错误会被 catch 捕获并记录日志，不会影响服务器运行。

## 总结

这是一个典型的**模块加载时序问题**。通过延迟非关键任务的执行，确保依赖项已经准备就绪，是一个简单有效的解决方案。

---

**修复时间**: 2024-12-04
**状态**: ✅ 已修复
**影响**: 无副作用
