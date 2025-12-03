# 回收站路由404错误修复

## 问题描述

清空回收站和永久删除文件时返回404错误：

```
[2025-12-03 17:25:34] warn: DELETE /trash/clear - 404 (2ms)
```

## 根本原因

**路由顺序问题**：在 `folderRoutes.js` 中，路由定义的顺序不正确：

```javascript
// ❌ 错误的顺序
router.delete('/trash/:fileId', ...)      // 先定义动态路由
router.delete('/trash/clear', ...)        // 后定义具体路由
```

当请求 `DELETE /api/folders/trash/clear` 时：
1. Express 按顺序匹配路由
2. 先匹配到 `/trash/:fileId`
3. 把 `clear` 当作 `fileId` 参数
4. 尝试 `parseInt('clear')` 得到 `NaN`
5. 查询数据库失败，返回404

## 解决方案

调整路由顺序，**具体路由必须在动态路由之前定义**：

```javascript
// ✅ 正确的顺序
router.delete('/trash/clear', ...)        // 先定义具体路由
router.delete('/trash/:fileId', ...)      // 后定义动态路由
```

这是 Express 路由的基本原则：
- 更具体的路由应该先定义
- 动态参数路由（如 `:fileId`）会匹配任何值
- 一旦匹配成功，后续路由不会被检查

## 修复内容

### 1. 调整路由顺序

**文件**: `backend/src/routes/folderRoutes.js`

```javascript
/**
 * 清空回收站（必须在 /trash/:fileId 之前定义）
 */
router.delete('/trash/clear', authenticate, async (req, res, next) => {
    try {
        const RecycleBinModel = require('../models/RecycleBinModel');
        const username = req.user.username;
        
        logger.info(`清空回收站请求: 用户=${username}`);
        
        // ... 业务逻辑 ...
        
        logger.info(`清空回收站完成: 用户=${username}, 成功=${deletedCount}, 失败=${errorCount}`);
        
        res.json({ 
            success: true, 
            message: `已清空回收站，删除 ${deletedCount} 个文件`,
            deletedCount,
            errorCount
        });
    } catch (error) {
        logger.error(`清空回收站失败: 用户=${req.user.username}`, error);
        next(error);
    }
});

/**
 * 从回收站永久删除文件
 */
router.delete('/trash/:fileId', authenticate, async (req, res, next) => {
    // ... 业务逻辑 ...
});
```

### 2. 增强日志记录

为两个路由都添加了详细的日志：
- 请求开始时记录参数
- 操作成功时记录结果
- 操作失败时记录错误

## 回收站路由完整顺序

现在 `folderRoutes.js` 中回收站相关路由的正确顺序：

```javascript
// 1. 获取回收站文件列表
router.get('/trash/files', authenticate, ...)

// 2. 恢复文件
router.post('/trash/restore/:fileId', authenticate, ...)

// 3. 清空回收站（具体路由，必须在动态路由之前）
router.delete('/trash/clear', authenticate, ...)

// 4. 永久删除单个文件（动态路由，必须在最后）
router.delete('/trash/:fileId', authenticate, ...)
```

## 测试验证

### 1. 重启后端服务

```bash
cd backend
npm start
```

### 2. 测试清空回收站

在浏览器中：
1. 进入回收站页面
2. 点击"清空回收站"按钮
3. 确认操作

**预期结果**：
- ✅ 操作成功
- ✅ 显示"已清空回收站"消息
- ✅ 回收站列表清空

### 3. 测试永久删除单个文件

在浏览器中：
1. 进入回收站页面
2. 点击某个文件的"永久删除"按钮
3. 确认操作

**预期结果**：
- ✅ 操作成功
- ✅ 显示"文件已永久删除"消息
- ✅ 文件从列表中移除

### 4. 检查日志

```bash
type backend\logs\combined.log
```

应该看到类似的日志：

```
[2025-12-03 17:30:00] info: 清空回收站请求: 用户=admin
[2025-12-03 17:30:00] info: 清空回收站完成: 用户=admin, 成功=5, 失败=0
```

## Express 路由最佳实践

### 路由定义顺序规则

1. **静态路由优先**
   ```javascript
   router.get('/users/me', ...)        // 先定义
   router.get('/users/:id', ...)       // 后定义
   ```

2. **具体路径优先**
   ```javascript
   router.get('/api/special', ...)     // 先定义
   router.get('/api/:type', ...)       // 后定义
   ```

3. **多段路径优先**
   ```javascript
   router.get('/a/b/c', ...)           // 先定义
   router.get('/a/:b', ...)            // 后定义
   ```

4. **HTTP方法无关**
   ```javascript
   // 即使HTTP方法不同，顺序仍然重要
   router.get('/trash/clear', ...)     // GET 具体路由
   router.delete('/trash/clear', ...)  // DELETE 具体路由
   router.get('/trash/:id', ...)       // GET 动态路由
   router.delete('/trash/:id', ...)    // DELETE 动态路由
   ```

### 常见错误示例

```javascript
// ❌ 错误：动态路由会拦截所有请求
router.get('/api/:resource', ...)
router.get('/api/users', ...)         // 永远不会被匹配

// ✅ 正确：具体路由在前
router.get('/api/users', ...)
router.get('/api/:resource', ...)
```

## 相关文件

- `backend/src/routes/folderRoutes.js` - 路由定义
- `frontend/src/pages/RecycleBin.jsx` - 前端页面
- `backend/src/models/RecycleBinModel.js` - 数据模型

## 总结

这是一个经典的 Express 路由顺序问题。修复方法很简单：
1. ✅ 将 `/trash/clear` 移到 `/trash/:fileId` 之前
2. ✅ 添加详细的日志记录
3. ✅ 添加注释说明路由顺序的重要性

修复后，回收站的所有功能都能正常工作。
